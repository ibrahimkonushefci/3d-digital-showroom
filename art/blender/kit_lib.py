"""Shared helpers for the Phase 2 scripted kit (run inside headless Blender).

Blender is Z-up and the glTF exporter maps Blender -Y to glTF +Z, so every
model here faces Blender -Y ("front") and the units are metres.
"""

import math
import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

# One palette for every generated object so the kit reads as one family.
# name: (linear-ish sRGB hex, roughness, metalness)
PALETTE = {
    "fabric": ("#ffffff", 0.93, 0.0),  # tinted per instance at runtime
    "fabric-fixed": ("#ffffff", 0.93, 0.0),  # colour carried by vertex colour
    "button": ("#e9e3d6", 0.45, 0.0),
    "hanger": ("#b48a5c", 0.55, 0.0),
    "chrome": ("#d9dde0", 0.16, 1.0),
    "steel": ("#adb2b5", 0.45, 1.0),  # brushed, so large panels do not mirror
    "steel-dark": ("#5c6366", 0.4, 1.0),
    "black-matte": ("#1c1e1f", 0.55, 0.15),
    "black-glass": ("#07090b", 0.06, 0.0),
    "glass-panel": ("#0b0f12", 0.1, 0.0),
    "rubber": ("#2a2b2b", 0.85, 0.0),
    "sole-white": ("#ecebe6", 0.7, 0.0),
    "leather-dark": ("#2b211b", 0.48, 0.0),
    "leather-tan": ("#9a6a44", 0.5, 0.0),
    "canvas-white": ("#efeee9", 0.88, 0.0),
    "suede-sand": ("#b9a081", 0.95, 0.0),
    "oak": ("#a9805a", 0.6, 0.0),
    "upholstery": ("#8a7b6a", 0.95, 0.0),
    "shade-outer": ("#2f3a36", 0.5, 0.2),
    "shade-inner": ("#f1ece2", 0.6, 0.0),
    "diffuser": ("#f6f1e6", 0.5, 0.0),
    "brass": ("#b8945c", 0.3, 1.0),
    "display": ("#0a0c0e", 0.2, 0.0),
    "panel": ("#151718", 0.25, 0.3),
    "white-matte": ("#e8e6e1", 0.6, 0.0),
    "gasket": ("#3a3d3e", 0.8, 0.0),
    "print": ("#555b5e", 0.35, 0.0),
    "led": ("#fff4dd", 0.4, 0.0),
    "digits": ("#ffb36b", 0.4, 0.0),
}


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgb(h, linear=True):
    h = h.lstrip("#")
    v = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return [srgb_to_linear(c) for c in v] if linear else v


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for m in list(bpy.data.materials):
        bpy.data.materials.remove(m)


def material(name, image=None, emissive=None):
    key = name + (":" + image if image else "")
    if key in bpy.data.materials:
        return bpy.data.materials[key]
    colour, rough, metal = PALETTE[name]
    m = bpy.data.materials.new(name if not image else name)
    m.use_nodes = True
    # Closed solids render single-sided; open shells (shade lining) stay double-sided.
    m.use_backface_culling = name not in ("shade-inner", "diffuser", "chrome-open")
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*hex_rgb(colour), 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emissive:
        bsdf.inputs["Emission Color"].default_value = (*hex_rgb(emissive), 1)
        bsdf.inputs["Emission Strength"].default_value = 1.0
    if image:
        img = bpy.data.images.load(image)
        tex = m.node_tree.nodes.new("ShaderNodeTexImage")
        tex.image = img
        m.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    return m


def obj_from_bmesh(bm, name, mat=None):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    o = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(o)
    if mat:
        o.data.materials.append(material(mat) if isinstance(mat, str) else mat)
    return o


def apply_modifiers(o):
    deps = bpy.context.evaluated_depsgraph_get()
    ev = o.evaluated_get(deps)
    mesh = bpy.data.meshes.new_from_object(ev)
    old = o.data
    o.modifiers.clear()
    o.data = mesh
    bpy.data.meshes.remove(old)
    return o


def shade_smooth(o, angle=40):
    for p in o.data.polygons:
        p.use_smooth = True
    mod = o.modifiers.new("autosmooth", "NODES") if False else None
    # Sharp edges above the angle keep crisp bevel boundaries.
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle))
    except Exception:
        pass
    o.select_set(False)
    return o


def box(size, loc=(0, 0, 0), mat="steel", bevel=0.0, segs=3, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    o = obj_from_bmesh(bm, "box", mat)
    if bevel > 0:
        b = o.modifiers.new("bevel", "BEVEL")
        b.width = bevel
        b.segments = segs
        b.limit_method = "NONE"
        apply_modifiers(o)
    o.rotation_euler = rot
    o.location = loc
    bake_transform(o)
    return shade_smooth(o)


def cyl(r1, r2, depth, loc=(0, 0, 0), rot=(0, 0, 0), mat="steel", verts=32, bevel=0.0, segs=2, cap=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=cap, cap_tris=False, segments=verts, radius1=r1, radius2=r2, depth=depth
    )
    o = obj_from_bmesh(bm, "cyl", mat)
    if bevel > 0:
        b = o.modifiers.new("bevel", "BEVEL")
        b.width = bevel
        b.segments = segs
        b.limit_method = "ANGLE"
        apply_modifiers(o)
    o.rotation_euler = rot
    o.location = loc
    bake_transform(o)
    return shade_smooth(o)


def bake_transform(o):
    o.data.transform(o.matrix_basis)
    o.matrix_basis = Matrix.Identity(4)
    return o


def tube(points, radius, mat="chrome", res=12, bevel_res=4, smooth=True, cyclic=False, profile=None):
    """Poly/NURBS curve swept with a round section, converted to a mesh."""
    cu = bpy.data.curves.new("tube", "CURVE")
    cu.dimensions = "3D"
    cu.resolution_u = res
    cu.bevel_depth = radius
    cu.bevel_resolution = bevel_res
    cu.use_fill_caps = True
    sp = cu.splines.new("NURBS" if smooth else "POLY")
    sp.points.add(len(points) - 1)
    for p, c in zip(sp.points, points):
        p.co = (*c, 1)
    sp.use_endpoint_u = True
    sp.order_u = min(4, len(points)) if smooth else 2
    sp.use_cyclic_u = cyclic
    o = bpy.data.objects.new("tube", cu)
    bpy.context.scene.collection.objects.link(o)
    if profile is not None:
        o.scale = (1, 1, 1)
    deps = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(o.evaluated_get(deps))
    bpy.data.objects.remove(o)
    m = bpy.data.objects.new("tube", mesh)
    bpy.context.scene.collection.objects.link(m)
    m.data.materials.clear()
    m.data.materials.append(material(mat))
    return shade_smooth(m, 60)


def lathe(profile, mat="steel", segs=48, loc=(0, 0, 0), rot=(0, 0, 0), smooth_angle=50):
    """Revolve [(radius, z), ...] around Z."""
    bm = bmesh.new()
    verts = [bm.verts.new((r, 0, z)) for r, z in profile]
    edges = [bm.edges.new((a, b)) for a, b in zip(verts, verts[1:])]
    bmesh.ops.spin(
        bm,
        geom=verts + edges,
        cent=(0, 0, 0),
        axis=(0, 0, 1),
        angle=math.tau,
        steps=segs,
        use_duplicate=False,
    )
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = obj_from_bmesh(bm, "lathe", mat)
    o.rotation_euler = rot
    o.location = loc
    bake_transform(o)
    return shade_smooth(o, smooth_angle)


def rounded_rect(w, h, r, n=8):
    """Closed outline (counter-clockwise) of a rounded rectangle centred at 0."""
    pts = []
    r = min(r, w / 2 - 1e-4, h / 2 - 1e-4)
    for cx, cy, a0 in [
        (w / 2 - r, h / 2 - r, 0),
        (-w / 2 + r, h / 2 - r, 90),
        (-w / 2 + r, -h / 2 + r, 180),
        (w / 2 - r, -h / 2 + r, 270),
    ]:
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def slab(outline, z0, z1, mat, bevel=0.0, segs=2, holes=()):
    """Extrude a horizontal outline (x, y) between z0 and z1, optional holes."""
    cu = bpy.data.curves.new("slab", "CURVE")
    cu.dimensions = "2D"
    cu.fill_mode = "BOTH"
    cu.extrude = (z1 - z0) / 2
    for loop in [outline, *holes]:
        sp = cu.splines.new("POLY")
        sp.points.add(len(loop) - 1)
        for p, c in zip(sp.points, loop):
            p.co = (c[0], c[1], 0, 1)
        sp.use_cyclic_u = True
    o = bpy.data.objects.new("slab", cu)
    bpy.context.scene.collection.objects.link(o)
    deps = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(o.evaluated_get(deps))
    bpy.data.objects.remove(o)
    m = bpy.data.objects.new("slab", mesh)
    bpy.context.scene.collection.objects.link(m)
    m.data.materials.append(material(mat) if isinstance(mat, str) else mat)
    m.location.z = (z0 + z1) / 2
    bake_transform(m)
    bm = bmesh.new()
    bm.from_mesh(m.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bm.to_mesh(m.data)
    bm.free()
    if bevel > 0:
        b = m.modifiers.new("bevel", "BEVEL")
        b.width = bevel
        b.segments = segs
        b.limit_method = "ANGLE"
        b.angle_limit = math.radians(50)
        apply_modifiers(m)
    return shade_smooth(m, 35)


def dist_to_outline(p, outline):
    best = 1e9
    n = len(outline)
    for i in range(n):
        ax, ay = outline[i]
        bx, by = outline[(i + 1) % n]
        dx, dy = bx - ax, by - ay
        L = dx * dx + dy * dy
        t = 0 if L == 0 else max(0, min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / L))
        qx, qy = ax + t * dx - p[0], ay + t * dy - p[1]
        best = min(best, qx * qx + qy * qy)
    return math.sqrt(best)


def smoothstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def pillow(outline, thickness, mat="fabric", voxel=0.0055, edge=0.03, deform=None, smooth=6, min_scale=0.25):
    """Soft fabric panel in the XZ plane (front faces -Y).

    The outline is extruded, voxel-remeshed for an even mesh, smoothed so its
    edges roll over, then thinned towards the outline like a stuffed cushion.
    `deform(x, y, z) -> (x, y, z)` adds drape folds afterwards."""
    bm = bmesh.new()
    vs = [bm.verts.new((x, -thickness / 2, z)) for x, z in outline]
    f = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    moved = [v for v in ext["geom"] if isinstance(v, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, thickness, 0), verts=moved)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = obj_from_bmesh(bm, "pillow", mat)
    r = o.modifiers.new("remesh", "REMESH")
    r.mode = "VOXEL"
    r.voxel_size = voxel
    s = o.modifiers.new("smooth", "SMOOTH")
    s.factor = 0.6
    s.iterations = smooth
    apply_modifiers(o)
    for v in o.data.vertices:
        d = dist_to_outline((v.co.x, v.co.z), outline)
        k = min_scale + (1 - min_scale) * math.sqrt(smoothstep(0, edge, d))
        v.co.y *= k
    if deform:
        for v in o.data.vertices:
            v.co = Vector(deform(v.co.x, v.co.y, v.co.z))
    return shade_smooth(o, 80)


def blob(parts, voxel=0.004, smooth=4, mat="fabric"):
    """Union of meshes, voxel remeshed and smoothed into one organic surface."""
    o = join(parts)
    r = o.modifiers.new("remesh", "REMESH")
    r.mode = "VOXEL"
    r.voxel_size = voxel
    s = o.modifiers.new("smooth", "SMOOTH")
    s.factor = 0.5
    s.iterations = smooth
    apply_modifiers(o)
    o.data.materials.clear()
    o.data.materials.append(material(mat))
    return shade_smooth(o, 80)


def ellipsoid(radii, loc=(0, 0, 0), rot=(0, 0, 0), mat="fabric", segs=24):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=segs // 2, radius=1)
    bmesh.ops.scale(bm, vec=Vector(radii), verts=bm.verts)
    o = obj_from_bmesh(bm, "ellipsoid", mat)
    o.rotation_euler = rot
    o.location = loc
    bake_transform(o)
    return shade_smooth(o, 80)


def join(objs):
    objs = [o for o in objs if o is not None]
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.select_set(False)
    return o


def bvh(o):
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.transform(o.matrix_world)
    t = BVHTree.FromBMesh(bm)
    bm.free()
    return t


def front_hit(tree, x, z, start=-1.0):
    """First surface point hit by a ray travelling +Y at (x, z)."""
    hit = tree.ray_cast(Vector((x, start, z)), Vector((0, 1, 0)))
    return hit[0]


def conform(o, target_tree, offset=0.0015, direction=(0, 1, 0)):
    """Drop each vertex of a flat detail onto the target surface along +Y."""
    d = Vector(direction)
    for v in o.data.vertices:
        hit = target_tree.ray_cast(Vector((v.co.x, -1.0, v.co.z)), d)
        if hit[0] is not None:
            v.co.y += hit[0].y - offset
    return o


def grid_strip(x0, x1, z0, z1, nx, nz, mat, depth=0.002):
    """Thin flat strip in the XZ plane with a little thickness (front at y=-depth)."""
    bm = bmesh.new()
    rows = []
    for j in range(nz + 1):
        row = []
        for i in range(nx + 1):
            row.append(bm.verts.new((x0 + (x1 - x0) * i / nx, -depth, z0 + (z1 - z0) * j / nz)))
        rows.append(row)
    for j in range(nz):
        for i in range(nx):
            bm.faces.new((rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]))
    ext = bmesh.ops.extrude_face_region(bm, geom=list(bm.faces))
    moved = [v for v in ext["geom"] if isinstance(v, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, depth, 0), verts=moved)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return shade_smooth(obj_from_bmesh(bm, "strip", mat), 50)


def bake_ao(o, samples=48, distance=0.12, floor=0.5, layer_colours=None):
    """Cycles ambient-occlusion bake into a per-vertex colour (COLOR_0).

    `floor` keeps the bake gentle: the live renderer adds its own AO.
    `layer_colours(vertex) -> (r, g, b)` optionally multiplies a fixed colour in."""
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = samples
    scene.cycles.device = "CPU"
    if scene.world is None:
        scene.world = bpy.data.worlds.new("w")
    scene.world.light_settings.distance = distance
    mesh = o.data
    for a in list(mesh.color_attributes):
        mesh.color_attributes.remove(a)
    attr = mesh.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    mesh.color_attributes.active_color = attr
    mesh.attributes.active_color = attr
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    scene.render.bake.target = "VERTEX_COLORS"
    scene.render.bake.use_selected_to_active = False
    bpy.ops.object.bake(type="AO")
    attr = mesh.color_attributes["Col"]
    for i, d in enumerate(attr.data):
        ao = d.color[0]
        k = floor + (1 - floor) * ao
        c = layer_colours(mesh.vertices[i]) if layer_colours else (1, 1, 1)
        d.color = (k * c[0], k * c[1], k * c[2], 1)
    o.select_set(False)
    return o


def strip_uvs(o):
    for uv in list(o.data.uv_layers):
        o.data.uv_layers.remove(uv)


def triangles(o):
    o.data.calc_loop_triangles()
    return len(o.data.loop_triangles)


def decimate_to(o, budget):
    n = triangles(o)
    if n > budget:
        d = o.modifiers.new("decimate", "DECIMATE")
        d.ratio = budget / n
        d.use_collapse_triangulate = True
        apply_modifiers(o)
    return o


def bounds(o):
    xs = [v.co for v in o.data.vertices]
    lo = Vector([min(c[i] for c in xs) for i in range(3)])
    hi = Vector([max(c[i] for c in xs) for i in range(3)])
    return lo, hi


def export_glb(o, path, keep_uv=False):
    if not keep_uv:
        strip_uvs(o)
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    has_colour = len(o.data.color_attributes) > 0
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        export_image_format="WEBP",
        export_image_quality=80,
        export_apply=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_vertex_color="ACTIVE" if has_colour else "NONE",
        export_all_vertex_colors=False,
        export_tangents=False,
        use_selection=True,
    )
    lo, hi = bounds(o)
    # glTF axes: x = x, y = z, z = -y
    return {
        "triangles": triangles(o),
        "materials": [m.name for m in o.data.materials],
        "min": [lo.x, lo.z, -hi.y],
        "max": [hi.x, hi.z, -lo.y],
    }


def drop_islands(o, min_verts=40):
    """Remove small loose pieces left behind by boolean cuts."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    seen, kill = set(), []
    for v in bm.verts:
        if v.index in seen:
            continue
        group, stack = [], [v]
        seen.add(v.index)
        while stack:
            c = stack.pop()
            group.append(c)
            for e in c.link_edges:
                n = e.other_vert(c)
                if n.index not in seen:
                    seen.add(n.index)
                    stack.append(n)
        if len(group) < min_verts:
            kill += group
    bmesh.ops.delete(bm, geom=kill, context="VERTS")
    bm.to_mesh(o.data)
    bm.free()
    return o


def boolean(o, cutter, op="DIFFERENCE", transfer=False):
    b = o.modifiers.new("bool", "BOOLEAN")
    b.operation = op
    b.object = cutter
    b.solver = "EXACT"
    if transfer:
        b.material_mode = "TRANSFER"
    apply_modifiers(o)
    bpy.data.objects.remove(cutter)
    return o


def annulus(r_in, r_out, loc, mat, segs=64, h=0.0004):
    """Flat printed ring lying in the XY plane (for glass-top markings)."""
    bm = bmesh.new()
    inner = [bm.verts.new((r_in * math.cos(math.tau * i / segs), r_in * math.sin(math.tau * i / segs), 0))
             for i in range(segs)]
    outer = [bm.verts.new((r_out * math.cos(math.tau * i / segs), r_out * math.sin(math.tau * i / segs), 0))
             for i in range(segs)]
    for i in range(segs):
        j = (i + 1) % segs
        bm.faces.new((inner[i], outer[i], outer[j], inner[j]))
    ext = bmesh.ops.extrude_face_region(bm, geom=list(bm.faces))
    moved = [v for v in ext["geom"] if isinstance(v, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, 0, h), verts=moved)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = obj_from_bmesh(bm, "ring", mat)
    o.location = loc
    return bake_transform(o)
