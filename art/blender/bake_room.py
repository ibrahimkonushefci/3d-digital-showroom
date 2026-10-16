"""Phase 3: bake a room-shell lightmap for one prepared design (Cycles, Metal GPU).

  /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
    --python art/blender/bake_room.py -- <scene.glb> <scene.json> <out-prefix> \
    [--samples N] [--size PX] [--preview]

Input comes from the live app (scripts/bake-rooms.mjs → window.__bakeExport):
furniture, decor and window fittings as world-space geometry with flat
materials, plus the room and its lights as the runtime resolves them.

The room shell (floor, ceiling, four walls with their openings) is rebuilt
here with one lightmap atlas as its UV layout; nothing else is baked. The
result is irradiance in three.js units (a three.js directional light of
intensity I gives I at normal incidence), so the runtime only multiplies it
by the surface albedo. Writes <out-prefix>.png (8-bit, gamma 2.2 encoded,
scaled by `encodeMax`) and <out-prefix>.json (atlas rects, encodeMax,
statistics). --preview also renders <out-prefix>-preview.png from inside.

Units, calibrated in Blender 5.2 (sun of strength 1 at normal incidence bakes
1/pi; a 100 W point at 1 m bakes 7.96/pi): bake * pi = irradiance; a
three.js point/spot of I candela is a Blender light of 4*pi*I W; a three.js
rect-area light of luminance L over area A is pi*L*A W.
"""

import json
import math
import sys
import time
from pathlib import Path

import bpy
import bmesh
import numpy as np
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1 :]
GLB, JSON_IN, OUT = Path(argv[0]), Path(argv[1]), Path(argv[2])


def option(name, default):
    return type(default)(argv[argv.index(name) + 1]) if name in argv else default


SAMPLES = option("--samples", 768)
SIZE = option("--size", 1024)
PREVIEW = "--preview" in argv
MARGIN_PX = 6
data = json.loads(JSON_IN.read_text())
room = data["room"]
W, D, H = room["width"], room["depth"], room["height"]
ORIGIN = Vector(data["origin"])


def B(v):
    """three.js world (Y up) -> Blender (Z up), same as the glTF importer."""
    return Vector((v[0], -v[2], v[1]))


def room_point(x, y, z):
    """Room-corner frame (metres) -> Blender world."""
    return B(Vector((x, y, z)) + ORIGIN)


def srgb(hexcolor):
    h = hexcolor.lstrip("#")
    c = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


# --- Atlas layout (metres -> one square texture) ---------------------------
GAP = 0.08
layout = {
    "floor": (0, 0, W, D),
    "ceiling": (W + GAP, 0, W, D),
    "back": (0, D + GAP, W, H),
    "front": (W + GAP, D + GAP, W, H),
    "left": (0, D + H + 2 * GAP, D, H),
    "right": (D + GAP, D + H + 2 * GAP, D, H),
}
SPAN = max(max(x + w for x, _, w, _ in layout.values()), max(y + h for _, y, _, h in layout.values()))
RECTS = {k: [x / SPAN, y / SPAN, w / SPAN, h / SPAN] for k, (x, y, w, h) in layout.items()}


def atlas_uv(surface, x, y, z):
    """Room-corner coordinates -> atlas UV (the runtime shader does the same)."""
    rx, ry, rw, rh = RECTS[surface]
    if surface in ("floor", "ceiling"):
        u, v = x / W, z / D
    elif surface in ("back", "front"):
        u, v = x / W, y / H
    else:
        u, v = z / D, y / H
    return (rx + u * rw, ry + v * rh)


# --- Scene -----------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "METAL"
prefs.get_devices()
for device in prefs.devices:
    device.use = True
scene.cycles.device = "GPU"
scene.cycles.samples = SAMPLES
scene.cycles.max_bounces = 6
scene.cycles.diffuse_bounces = 4
scene.cycles.glossy_bounces = 2
scene.cycles.transparent_max_bounces = 2
scene.cycles.sample_clamp_indirect = 6.0
scene.view_settings.view_transform = "Standard"

bpy.ops.import_scene.gltf(filepath=str(GLB))
imported = [o for o in scene.objects if o.type == "MESH"]
for o in imported:
    for slot in o.material_slots:
        m = slot.material
        if not m or "baked_fix" in m:
            continue
        m["baked_fix"] = True
        emission = m.get("emission")
        bsdf = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if bsdf and emission and max(emission) > 0.01:
            strength = max(emission)
            bsdf.inputs["Emission Color"].default_value = [c / strength for c in emission] + [1]
            bsdf.inputs["Emission Strength"].default_value = strength


def make_material(name, color, roughness=0.9, image=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = list(color) + [1]
    bsdf.inputs["Roughness"].default_value = roughness
    if image is not None:
        node = m.node_tree.nodes.new("ShaderNodeTexImage")
        node.image = image
        m.node_tree.nodes.active = node
    return m


atlas = bpy.data.images.new("atlas", SIZE, SIZE, float_buffer=True, alpha=False)
atlas.colorspace_settings.name = "Non-Color"
shell = data.get("shell", {})
wall_rgb = shell.get("wall", srgb("#ece8e1"))
floor_rgb = shell.get("floor", [0.35, 0.27, 0.18])
ceiling_rgb = shell.get("ceiling", [0.88, 0.86, 0.82])
targets = []


def surface_object(name, quads, color):
    """quads: list of 4 room-corner points each (counter-clockwise seen from
    inside), all on one surface."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("atlas")
    for quad in quads:
        verts = [bm.verts.new(room_point(*p)) for p in quad]
        face = bm.faces.new(verts)
        for loop, p in zip(face.loops, quad):
            loop[uv].uv = atlas_uv(name, *p)
    bm.to_mesh(mesh)
    bm.free()
    o = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(o)
    o.data.materials.append(make_material(name, color, image=atlas))
    targets.append(o)
    return o


def wall_spans(side):
    """Wall pieces around the openings, as (a, b, y0, y1) along the wall."""
    length = W if side in ("back", "front") else D
    openings = [o for o in room["openings"] if o["wall"] == side]
    cuts = sorted({0, length, *[min(length, max(0, o["offset"] / 100)) for o in openings],
                   *[min(length, max(0, (o["offset"] + o["width"]) / 100)) for o in openings]})
    pieces = []
    for a, b in zip(cuts, cuts[1:]):
        mid = (a + b) / 2
        holes = sorted((max(0, o["sill"] / 100), min(H, (o["sill"] + o["height"]) / 100))
                       for o in openings if o["offset"] / 100 < mid < (o["offset"] + o["width"]) / 100)
        bottom = 0
        for y0, y1 in holes:
            if y0 > bottom:
                pieces.append((a, b, bottom, y0))
            bottom = max(bottom, y1)
        if bottom < H:
            pieces.append((a, b, bottom, H))
    return pieces


def wall_point(side, s, y, inset=0.0):
    """Point on a wall's room face; s along the wall, inset towards outside."""
    if side == "back":
        return (s, y, -inset)
    if side == "front":
        return (s, y, D + inset)
    if side == "left":
        return (-inset, y, s)
    return (W + inset, y, s)


for side in ("back", "front", "left", "right"):
    quads = []
    for a, b, y0, y1 in wall_spans(side):
        p = [wall_point(side, a, y0), wall_point(side, b, y0), wall_point(side, b, y1), wall_point(side, a, y1)]
        # Face the room: back (z=0) normal +z, front -z, left +x, right -x.
        quads.append(p[::-1] if side in ("front", "left") else p)
    surface_object(side, quads, wall_rgb)
surface_object("floor", [[(0, 0, 0), (0, 0, D), (W, 0, D), (W, 0, 0)]], floor_rgb)
surface_object("ceiling", [[(0, H, 0), (W, H, 0), (W, H, D), (0, H, D)]], ceiling_rgb)

# Outer shell: light-tight slabs behind every surface (not baked), with the
# same openings, overlapping at the corners.
dark = make_material("occluder", (0.05, 0.05, 0.05))


def slab(p0, p1, side=None):
    lo = [min(a, b) for a, b in zip(p0, p1)]
    hi = [max(a, b) for a, b in zip(p0, p1)]
    a, b = room_point(*lo), room_point(*hi)
    centre = (a + b) / 2
    size = Vector([abs(x) for x in (b - a)])
    bpy.ops.mesh.primitive_cube_add(location=centre)
    o = bpy.context.object
    o.scale = size / 2
    o.data.materials.append(dark)
    o["side"] = side or ""


T, E = 0.12, 0.14
slab((-E, -T - 0.002, -E), (W + E, -0.002, D + E))
slab((-E, H + 0.002, -E), (W + E, H + T, D + E))
for side in ("back", "front", "left", "right"):
    length = W if side in ("back", "front") else D
    for a, b, y0, y1 in wall_spans(side):
        a2 = a - E if a <= 0 else a
        b2 = b + E if b >= length else b
        slab(wall_point(side, a2, y0, 0.002), wall_point(side, b2, y1, 0.002 + T), side)

# --- Lights ------------------------------------------------------------------
world = bpy.data.worlds.new("sky")
world.use_nodes = True
background = world.node_tree.nodes["Background"]
SKY = data.get("skyRadiance", 1.6)
background.inputs["Color"].default_value = (0.78, 0.87, 1.0, 1)
background.inputs["Strength"].default_value = SKY
scene.world = world


def add_light(name, kind, energy, color, location=None, direction=None, **settings):
    light = bpy.data.lights.new(name, kind)
    light.energy = energy
    light.color = color
    for key, value in settings.items():
        setattr(light, key, value)
    o = bpy.data.objects.new(name, light)
    scene.collection.objects.link(o)
    if location is not None:
        o.location = location
    if direction is not None:
        # Blender lights shine along their local -Z.
        o.rotation_euler = (-direction).to_track_quat("Z", "Y").to_euler()
    return o


if data.get("sun"):
    sun = data["sun"]
    towards_sun = B(Vector(sun["direction"])).normalized()
    add_light("sun", "SUN", sun["intensity"], srgb(sun["color"]), direction=-towards_sun,
              angle=math.radians(data.get("sunAngleDeg", 1.2)))
if data.get("ceilingKey"):
    key = data["ceilingKey"]
    add_light("ceiling", "SUN", key["intensity"], srgb("#fff0dc"),
              direction=-B(Vector(key["direction"])).normalized(), angle=math.radians(25))
k = data["interiorKey"]
if k["intensity"] > 0:
    position, target = B(Vector(k["position"])), B(Vector(k["target"]))
    add_light("interior-key", "SPOT", 4 * math.pi * k["intensity"], srgb(k["color"]),
              location=position, direction=(target - position).normalized(),
              spot_size=2 * k["angle"], spot_blend=k["penumbra"], shadow_soft_size=0.25)
DOWN = data.get("downlightCandela", 4.0)
for x, y, z in data["downlights"]:
    add_light("downlight", "SPOT", 4 * math.pi * DOWN, srgb("#ffe6c4"),
              location=B(Vector((x, y - 0.02, z))), direction=Vector((0, 0, -1)),
              spot_size=math.radians(90), spot_blend=0.7, shadow_soft_size=0.03)
for i, led in enumerate(data["leds"]):
    yaw, tilt = led["yaw"], led["tilt"]
    # RunLights frame: group at centre (room-corner) rotated by yaw; emitter at
    # offset, tilted about its X; three.js rect lights shine along local -Z.
    group = Matrix.Translation(Vector(led["centre"]) + ORIGIN) @ Matrix.Rotation(yaw, 4, "Y")
    local = Matrix.Translation(Vector(led["offset"])) @ Matrix.Rotation(tilt, 4, "X")
    m = group @ local
    origin = B(m.to_translation())
    x_axis = B(m.to_3x3() @ Vector((1, 0, 0))).normalized()
    shine = B(m.to_3x3() @ Vector((0, 0, -1))).normalized()
    z_axis = -shine
    y_axis = z_axis.cross(x_axis)
    o = add_light(f"led-{i}", "AREA", math.pi * led["intensity"] * led["width"] * led["height"],
                  srgb(led["color"]), shape="RECTANGLE", size=led["width"], size_y=led["height"])
    o.matrix_world = Matrix((
        (x_axis.x, y_axis.x, z_axis.x, origin.x),
        (x_axis.y, y_axis.y, z_axis.y, origin.y),
        (x_axis.z, y_axis.z, z_axis.z, origin.z),
        (0, 0, 0, 1),
    ))

# --- Bake --------------------------------------------------------------------
bpy.ops.object.select_all(action="DESELECT")
for o in targets:
    o.select_set(True)
bpy.context.view_layer.objects.active = targets[0]
started = time.time()
bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT", "INDIRECT"}, margin=MARGIN_PX,
                    margin_type="EXTEND", use_clear=True, uv_layer="atlas")
bake_seconds = time.time() - started

pixels = np.array(atlas.pixels[:], dtype=np.float32).reshape(SIZE, SIZE, 4)[:, :, :3] * math.pi


def blur(img, sigma):
    radius = int(math.ceil(sigma * 3))
    x = np.arange(-radius, radius + 1)
    kernel = np.exp(-(x ** 2) / (2 * sigma * sigma))
    kernel /= kernel.sum()
    pad = np.pad(img, ((radius, radius), (radius, radius), (0, 0)), mode="edge")
    out = np.zeros_like(pad)
    for i, k in enumerate(kernel):
        out[:, radius:-radius] += k * pad[:, i : i + img.shape[1]]
    out2 = np.zeros_like(img)
    for i, k in enumerate(kernel):
        out2 += k * out[i : i + img.shape[0], radius:-radius]
    return out2


# Light denoise: lighting is smooth at 1 cm texels; keeps sun-stripe edges.
pixels = blur(pixels, data.get("blurPx", 1.1))
inside = np.zeros((SIZE, SIZE), dtype=bool)
for rx, ry, rw, rh in RECTS.values():
    inside[int(ry * SIZE) : int((ry + rh) * SIZE), int(rx * SIZE) : int((rx + rw) * SIZE)] = True
# White balance: warm lamps plus bounce off a wood floor tint the whole
# shell beige, which read as yellow walls next to the live-lit furniture.
# The average cast over walls and ceiling is moved (BALANCE of the way) to
# the live lights' own warm white, so both halves of the picture agree.
BALANCE = data.get("balance", 0.85)
tint = np.array(srgb("#fff4e6"), dtype=np.float32)
lit = np.zeros((SIZE, SIZE), dtype=bool)
for name in ("back", "front", "left", "right", "ceiling"):
    rx, ry, rw, rh = RECTS[name]
    lit[int(ry * SIZE) : int((ry + rh) * SIZE), int(rx * SIZE) : int((rx + rw) * SIZE)] = True
cast = pixels[lit].mean(axis=0)
balance = ((tint / tint.mean()) / (cast / cast.mean())) ** BALANCE
pixels = pixels * balance.astype(np.float32)
# Ceiling: light bounced off oak and cashmere fronts tinted it brown in
# patches, which reads as a stain overhead. Keep its brightness gradient,
# drop its colour (lamp tint), and soften its contrast.
rx, ry, rw, rh = RECTS["ceiling"]
rows = slice(int(ry * SIZE), int((ry + rh) * SIZE))
cols = slice(int(rx * SIZE), int((rx + rw) * SIZE))
ceiling = pixels[rows, cols]
level = ceiling @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
mean = float(level.mean())
level = mean * (np.maximum(level, 1e-4) / mean) ** 0.7
pixels[rows, cols] = level[:, :, None] * (tint / (tint @ np.array([0.2126, 0.7152, 0.0722])))
luma = pixels @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
encode_max = float(np.percentile(luma[inside], 99.8) * 1.15)
encoded = np.clip(pixels / encode_max, 0, 1) ** (1 / 2.2)

out_image = bpy.data.images.new("encoded", SIZE, SIZE, alpha=False)
out_image.colorspace_settings.name = "Non-Color"
rgba = np.ones((SIZE, SIZE, 4), dtype=np.float32)
rgba[:, :, :3] = encoded
out_image.pixels[:] = rgba.ravel()
out_image.filepath_raw = str(OUT) + ".png"
out_image.file_format = "PNG"
out_image.save()

stats = {}
for name, (rx, ry, rw, rh) in RECTS.items():
    region = luma[int(ry * SIZE) : int((ry + rh) * SIZE), int(rx * SIZE) : int((rx + rw) * SIZE)]
    stats[name] = {"mean": round(float(region.mean()), 3), "p05": round(float(np.percentile(region, 5)), 3),
                   "p95": round(float(np.percentile(region, 95)), 3)}
result = {
    "signature": data["signature"],
    "size": SIZE,
    "samples": SAMPLES,
    "bakeSeconds": round(bake_seconds, 1),
    "rects": RECTS,
    "room": [W, H, D],
    "origin": data["origin"],
    "encodeMax": round(encode_max, 4),
    "gamma": 2.2,
    "whiteBalance": [round(float(x), 4) for x in balance],
    "stats": stats,
}
Path(str(OUT) + ".json").write_text(json.dumps(result, indent=2))
print("BAKED", json.dumps({k: result[k] for k in ("signature", "bakeSeconds", "encodeMax")}), stats)

if PREVIEW:
    hero = data.get("camera")
    if hero:
        camera = bpy.data.objects.new("camera", bpy.data.cameras.new("camera"))
        scene.collection.objects.link(camera)
        # Like the live view: walls the camera stands beyond are cut away.
        cx, _, cz = Vector(hero["position"]) - ORIGIN
        beyond = {"back": cz < 0, "front": cz > D, "left": cx < 0, "right": cx > W}
        for o in scene.objects:
            if beyond.get(o.name) or beyond.get(o.get("side", "")):
                o.hide_render = True
        position, target = B(Vector(hero["position"])), B(Vector(hero["target"]))
        camera.location = position
        camera.rotation_euler = (target - position).to_track_quat("-Z", "Y").to_euler()
        camera.data.angle_y = math.radians(hero.get("fov", 50))
        camera.data.sensor_fit = "VERTICAL"
        scene.camera = camera
        scene.render.resolution_x, scene.render.resolution_y = 960, 600
        scene.cycles.samples = 128
        scene.cycles.use_denoising = True
        scene.view_settings.view_transform = "AgX"
        scene.render.filepath = str(OUT) + "-preview.png"
        bpy.ops.render.render(write_still=True)
