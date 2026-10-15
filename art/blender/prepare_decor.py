"""Prepare CC0 Poly Haven decor for the showroom (run headless in Blender).

  /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
    --python art/blender/prepare_decor.py -- art/blender/decor.json <download-dir> <out-dir>

For each entry in decor.json: import the 1K glTF parts, place them, join,
decimate to a triangle budget, put the origin where the room recipe anchors
it (floor/countertop centre or the back of a wall piece), shrink textures and
export two GLBs (balanced, lightweight) with WebP textures. Metre scale,
+Y up, +Z towards the room. Ambient occlusion baked by the artist stays in the
glTF occlusion channel.
"""

import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1 :]
config = json.loads(Path(argv[0]).read_text())
src, out = Path(argv[1]), Path(argv[2])
out.mkdir(parents=True, exist_ok=True)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_part(part):
    before = set(bpy.data.objects)
    path = src / part["asset"] / f"{part['asset']}_1k.gltf"
    bpy.ops.import_scene.gltf(filepath=str(path))
    new = [o for o in bpy.data.objects if o not in before]
    roots = [o for o in new if o.parent is None or o.parent not in new]
    for root in roots:
        root.location += Vector(part.get("offset", [0, 0, 0]))
        root.rotation_euler.z += part.get("yaw", 0)
        if "scale" in part:
            root.scale *= part["scale"]
    return new


def join_meshes(objects):
    meshes = [o for o in objects if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    for o in list(bpy.data.objects):
        if o != obj:
            bpy.data.objects.remove(o, do_unlink=True)
    return obj


def triangles(obj):
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def place_origin(obj, mode):
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    lo = Vector([min(c[i] for c in corners) for i in range(3)])
    hi = Vector([max(c[i] for c in corners) for i in range(3)])
    centre = (lo + hi) / 2
    # Blender is Z-up and the glTF exporter maps Blender -Y to glTF +Z.
    if mode == "back":  # wall piece: origin on its back plane, centred
        pivot = Vector((centre.x, hi.y, centre.z))
    else:  # floor / countertop / shelf: bottom centre
        pivot = Vector((centre.x, centre.y, lo.z))
    obj.data.transform(__import__("mathutils").Matrix.Translation(-pivot))
    obj.location = (0, 0, 0)
    return hi - lo


def export(obj, path, budget, texture):
    count = triangles(obj)
    mod = None
    if count > budget:
        mod = obj.modifiers.new("decimate", "DECIMATE")
        mod.ratio = budget / count
        mod.use_collapse_triangulate = True
    for image in bpy.data.images:
        if image.size[0] > texture:
            image.scale(texture, texture)
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        export_image_format="WEBP",
        export_image_quality=72,
        export_apply=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        use_selection=False,
    )
    if mod:
        obj.modifiers.remove(mod)


for item in config:
    for detail, budget, texture in [
        ("balanced", item["triangles"], item.get("texture", 512)),
        ("lightweight", item["triangles"] // 2, item.get("texture", 512) // 2),
    ]:
        reset()
        objects = []
        for part in item["parts"]:
            objects += import_part(part)
        obj = join_meshes(objects)
        size = place_origin(obj, item.get("origin", "bottom"))
        export(obj, out / f"{item['id']}-{detail}.glb", budget, texture)
        print("PREPARED", item["id"], detail, [round(v, 3) for v in size])
