"""Phase 2 scripted kit: garments, wardrobe props, kitchen appliances, stools
and pendants. Original project geometry; no external mesh input.

  /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
    --python art/blender/phase2_kit.py -- <out-dir> [id ...] [--preview]

Writes <id>-balanced.glb, <id>-lightweight.glb and <id>.json (bounds,
triangles, material slots, origin) per asset. --preview also renders
<id>.png for review. Optimise and register afterwards with
`node scripts/register-kit.mjs <out-dir>`.
"""

import json
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).parent))
import kit_lib as K  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1 :]
OUT = Path(argv[0])
OUT.mkdir(parents=True, exist_ok=True)
PREVIEW = "--preview" in argv
WANTED = [a for a in argv[1:] if not a.startswith("--")]
TEXTURES = Path(__file__).parent / "textures"

BUILDERS = {}


def asset(id, origin, budget, light=0.4, floor=0.55, texture=False, shared=False):
    """shared=True: hard-surface pieces whose bevels do not survive decimation;
    the lightweight level reuses the balanced file."""
    def wrap(fn):
        BUILDERS[id] = dict(fn=fn, origin=origin, budget=budget, light=light, floor=floor,
                            texture=texture, shared=shared)
        return fn

    return wrap


# ---------------------------------------------------------------- garments

def mirror(half):
    """Right-half outline from top centre down to bottom centre -> full loop."""
    left = [(-x, z) for x, z in reversed(half[1:-1])]
    return half + left


def drape(top, length, amp, waves, seed, flare=0.0):
    rnd = random.Random(seed)
    phases = [rnd.uniform(0, math.tau) for _ in waves]

    def f(x, y, z):
        t = max(0.0, min(1.0, (top - z) / length))
        a = amp * (0.2 + 0.8 * t**1.3)
        w = sum(
            k * math.sin(math.tau * x / lam + p + 1.7 * z) for (lam, k), p in zip(waves, phases)
        )
        # Fabric hangs slightly back under its own weight towards the hem.
        return (x * (1 + flare * t), y + a * w + 0.006 * t, z)

    return f


def hanger(bar=False, width=0.205, drop=0.056):
    parts = [
        K.tube(
            [(-width, 0, -drop - 0.062), (-width * 0.55, 0, -drop - 0.036), (0, 0, -drop - 0.008),
             (width * 0.55, 0, -drop - 0.036), (width, 0, -drop - 0.062)],
            0.0075, "hanger", res=10, bevel_res=3),
    ]
    # Wire hook, in the hanger plane, wrapping the rail (centre at origin).
    r = 0.0175
    hook = [(0, 0, -drop + 0.004), (0, 0, -0.03)]
    for a in (205, 160, 120, 90, 60, 20, -25):
        hook.append((r * math.cos(math.radians(a)), 0, r * math.sin(math.radians(a))))
    parts.append(K.tube(hook, 0.0022, "chrome", res=10, bevel_res=2))
    parts.append(K.cyl(0.007, 0.006, 0.012, loc=(0, 0, -drop + 0.002), mat="chrome", verts=16))
    if bar:
        parts.append(K.tube([(-width + 0.012, 0, -drop - 0.058), (width - 0.012, 0, -drop - 0.058)],
                            0.0045, "hanger", smooth=False, res=2, bevel_res=2))
    return parts


def buttons(tree, xs_zs, radius=0.0055, mat="button"):
    out = []
    for x, z in xs_zs:
        hit = K.front_hit(tree, x, z)
        if hit is None:
            continue
        out.append(K.cyl(radius, radius, 0.003, loc=(x, hit.y - 0.0012, z),
                         rot=(math.pi / 2, 0, 0), mat=mat, verts=14, bevel=0.0008))
    return out


def detail_strip(tree, x0, x1, z0, z1, nx, nz, offset=0.0018, mat="fabric", depth=0.0025):
    s = K.grid_strip(x0, x1, z0, z1, nx, nz, mat, depth)
    return K.conform(s, tree, offset)


def sleeve(top_inner, top_outer, bottom_outer, bottom_inner, thickness, front, seed, length):
    outline = [top_inner, top_outer, bottom_outer, bottom_inner]
    # densify for a smooth outline after the remesh
    s = K.pillow(outline, thickness, edge=0.022, voxel=0.0045,
                 deform=drape(top_inner[1], length, 0.007, [(0.045, 1), (0.03, 0.5)], seed))
    s.location.y = front
    K.bake_transform(s)
    return s


@asset("shirt", "rail", 4200)
def shirt():
    half = [(0, -0.052), (0.06, -0.058), (0.19, -0.112), (0.214, -0.16), (0.212, -0.32),
            (0.204, -0.52), (0.212, -0.72), (0.17, -0.75), (0.08, -0.785), (0, -0.795)]
    body = K.pillow(mirror(half), 0.026, edge=0.045,
                    deform=drape(-0.1, 0.7, 0.012, [(0.11, 1), (0.065, 0.5), (0.17, 0.4)], 3))
    tree = K.bvh(body)
    parts = [body]
    for s in (-1, 1):
        # Sleeves fall from the shoulder seam and swing in over the front.
        parts.append(sleeve((s * 0.15, -0.14), (s * 0.222, -0.125), (s * 0.19, -0.71),
                            (s * 0.125, -0.70), 0.02, -0.016, 7 + s, 0.6))
    # Collar stand around the neck and two flat collar points.
    ring = [(0.062 * math.cos(a), -0.021 * math.sin(a) - 0.003, -0.056 - 0.006 * math.sin(a))
            for a in [math.radians(d) for d in range(-75, 256, 15)]]
    parts.append(K.tube(ring, 0.0115, "fabric", res=8, bevel_res=3))
    for s in (-1, 1):
        flap = K.pillow([(s * 0.004, -0.07), (s * 0.068, -0.058), (s * 0.058, -0.118),
                         (s * 0.014, -0.096)][:: s], 0.005, edge=0.008, voxel=0.003)
        flap.location.y = -0.016
        K.bake_transform(flap)
        parts.append(flap)
    parts.append(detail_strip(tree, -0.016, 0.016, -0.775, -0.1, 2, 30, depth=0.0015))
    parts.append(detail_strip(tree, 0.06, 0.135, -0.29, -0.2, 4, 4, offset=0.001, depth=0.001))
    parts += buttons(tree, [(0, -0.13 - 0.09 * i) for i in range(7)])
    parts += hanger(width=0.19)
    return parts


@asset("tee", "rail", 3200)
def tee():
    half = [(0, -0.075), (0.075, -0.058), (0.2, -0.105), (0.275, -0.165), (0.255, -0.29),
            (0.205, -0.255), (0.208, -0.5), (0.212, -0.68), (0.1, -0.69), (0, -0.69)]
    body = K.pillow(mirror(half), 0.022, edge=0.035,
                    deform=drape(-0.1, 0.6, 0.008, [(0.13, 1), (0.08, 0.4)], 11))
    ring = [(0.072 * math.cos(a), -0.015 * math.sin(a) - 0.002, -0.066 - 0.012 * math.sin(a))
            for a in [math.radians(d) for d in range(0, 361, 15)]]
    rib = K.tube(ring, 0.0065, "fabric", res=6, bevel_res=2, cyclic=True)
    return [body, rib, *hanger()]


@asset("dress", "rail", 4200)
def dress():
    half = [(0, -0.1), (0.06, -0.06), (0.15, -0.095), (0.168, -0.2), (0.16, -0.3),
            (0.142, -0.42), (0.17, -0.55), (0.22, -0.78), (0.27, -1.0), (0.14, -1.02),
            (0, -1.025)]
    body = K.pillow(mirror(half), 0.024, edge=0.035,
                    deform=drape(-0.42, 0.6, 0.016, [(0.12, 1), (0.075, 0.6), (0.19, 0.5)], 5))
    tree = K.bvh(body)
    belt = detail_strip(tree, -0.152, 0.152, -0.445, -0.415, 18, 2, offset=0.002)
    tie = K.pillow([(0.03, -0.43), (0.075, -0.44), (0.07, -0.6), (0.045, -0.6)], 0.008,
                   edge=0.01, voxel=0.003)
    hit = K.front_hit(tree, 0.05, -0.43)
    tie.location.y = (hit.y if hit else -0.012) - 0.004
    K.bake_transform(tie)
    return [body, belt, tie, *hanger()]


@asset("coat", "rail", 4600)
def coat():
    half = [(0, -0.05), (0.07, -0.06), (0.225, -0.118), (0.245, -0.17), (0.245, -0.4),
            (0.24, -0.7), (0.25, -0.96), (0.12, -0.97), (0, -0.97)]
    body = K.pillow(mirror(half), 0.042, edge=0.05,
                    deform=drape(-0.12, 0.85, 0.009, [(0.16, 1), (0.09, 0.4)], 17))
    tree = K.bvh(body)
    parts = [body]
    for s in (-1, 1):
        parts.append(sleeve((s * 0.18, -0.14), (s * 0.255, -0.135), (s * 0.262, -0.76),
                            (s * 0.192, -0.76), 0.045, -0.018, 21 + s, 0.65))
        lapel = K.pillow([(s * 0.012, -0.36), (s * 0.075, -0.06), (s * 0.13, -0.085),
                          (s * 0.115, -0.15), (s * 0.075, -0.2), (s * 0.03, -0.36)][:: s],
                         0.007, edge=0.012, voxel=0.0032)
        K.conform(lapel, tree, 0.004)
        parts.append(lapel)
        parts.append(detail_strip(tree, s * 0.11 - 0.06, s * 0.11 + 0.06, -0.63, -0.6, 8, 2,
                                  offset=0.003))
    parts += buttons(tree, [(0.04, -0.42), (0.04, -0.56), (-0.04, -0.42), (-0.04, -0.56)],
                     radius=0.011)
    parts.append(detail_strip(tree, -0.003, 0.003, -0.95, -0.37, 1, 24, offset=0.0015,
                              mat="button", depth=0.001))
    parts += hanger(width=0.215)
    return parts


@asset("trousers", "rail", 2800)
def trousers():
    outline = [(-0.155, -0.112), (-0.07, -0.103), (0.07, -0.103), (0.155, -0.112),
               (0.16, -0.2), (0.135, -0.45), (0.115, -0.69), (0.005, -0.7), (-0.115, -0.69),
               (-0.135, -0.45), (-0.16, -0.2)]
    body = K.pillow(outline, 0.034, edge=0.035,
                    deform=drape(-0.15, 0.55, 0.005, [(0.09, 1)], 23))
    tree = K.bvh(body)
    crease = detail_strip(tree, -0.004, 0.004, -0.68, -0.14, 1, 24, offset=0.0012, depth=0.002)
    cuff = detail_strip(tree, -0.118, 0.118, -0.69, -0.655, 14, 2, offset=0.0022)
    return [body, crease, cuff, *hanger(bar=True)]


# ---------------------------------------------------------------- folded and shelf items

def folded_layer(w, d, h, y0, z0, yaw, seed, ribbed=False):
    """One folded garment: a soft slab with a rolled front fold."""
    rnd = random.Random(seed)
    core = K.box((w, d - h * 0.6, h * 0.9), loc=(0, h * 0.3, h * 0.45), mat="fabric-fixed")
    roll = K.cyl(h * 0.5, h * 0.5, w * 0.98, loc=(0, -d / 2 + h * 0.5, h * 0.5),
                 rot=(0, math.pi / 2, 0), mat="fabric-fixed", verts=20)
    parts = [core, roll]
    if ribbed:
        for i in range(int(w / 0.012)):
            x = -w / 2 + 0.006 + i * 0.012
            parts.append(K.cyl(h * 0.5 + 0.0018, h * 0.5 + 0.0018, 0.005,
                               loc=(x, -d / 2 + h * 0.5, h * 0.5), rot=(0, math.pi / 2, 0),
                               mat="fabric-fixed", verts=14))
    layer = K.blob(parts, voxel=0.0035, smooth=5, mat="fabric-fixed")
    for v in layer.data.vertices:
        # a little sag in the middle and a softly uneven top
        v.co.z -= 0.004 * (1 - (2 * v.co.x / w) ** 2) * (v.co.z > h * 0.5)
        v.co.z += 0.0015 * math.sin(v.co.x * 40 + seed) * (v.co.z > h * 0.6)
    layer.rotation_euler.z = yaw
    layer.location = (rnd.uniform(-0.006, 0.006), y0, z0)
    K.bake_transform(layer)
    return layer


def stack(heights, w, d, seed, ribbed=False):
    rnd = random.Random(seed)
    z, parts, bands = 0.0, [], []
    for i, h in enumerate(heights):
        parts.append(folded_layer(w + rnd.uniform(-0.01, 0.01), d, h, rnd.uniform(-0.005, 0.005),
                                  z, rnd.uniform(-0.035, 0.035), seed + i, ribbed))
        bands.append((z, z + h))
        z += h - 0.002
    return parts, bands


def by_band(bands, colours):
    cs = [K.hex_rgb(c) for c in colours]

    def f(v):
        for (a, b), c in zip(bands, cs):
            if v.co.z <= b + 0.001:
                return c
        return cs[-1]

    return f


COLOURS = {}


@asset("fold", "shelf", 3600, floor=0.6)
def fold():
    parts, bands = stack([0.04, 0.036, 0.04, 0.034], 0.29, 0.23, 31)
    COLOURS["fold"] = by_band(bands, ["#e9e4da", "#9eb3c6", "#f3f1ec", "#c9b8a4"])
    return parts


@asset("fold-ribbed", "shelf", 4200, floor=0.6)
def fold_ribbed():
    parts, bands = stack([0.055, 0.05, 0.055], 0.3, 0.24, 41, ribbed=True)
    COLOURS["fold-ribbed"] = by_band(bands, ["#5d6b62", "#cdbfa8", "#3b4552"])
    return parts


@asset("towels", "shelf", 3000, floor=0.6)
def towels():
    parts, bands = stack([0.06, 0.06, 0.058], 0.32, 0.25, 51)
    base = by_band(bands, ["#f2efe8", "#ddd3c4", "#f2efe8"])

    def f(v):
        c = base(v)
        # woven border band across the folded front
        if -0.115 < v.co.x < -0.085:
            return [c[0] * 0.8, c[1] * 0.78, c[2] * 0.74]
        return c

    COLOURS["towels"] = f
    return parts


def footprint(L, W, n=48):
    foot = []
    for i in range(n):
        a = math.tau * i / n
        y = math.sin(a) * L / 2
        t = (y + L / 2) / L  # 0 toe .. 1 heel
        wx = W / 2 * (0.62 + 0.38 * math.sin(math.pi * min(1, 0.15 + t * 1.25)))
        wx *= 0.84 if t > 0.78 else 1
        foot.append((math.cos(a) * wx, y))
    return foot


def last(foot, z0, height, levels=10, mat="leather-tan"):
    """Shoe-last solid: the footprint lofted upwards, narrowing into a soft top."""
    import bmesh
    bm = bmesh.new()
    rings = []
    L = max(y for _, y in foot) - min(y for _, y in foot)
    for k in range(levels + 1):
        u = k / levels
        ring = []
        for x, y in foot:
            t = (y + L / 2) / L
            h = height(t)
            inset = 1 - 0.55 * u ** 2.2
            ring.append(bm.verts.new((x * inset, y * (1 - 0.06 * u ** 2), z0 + h * math.sin(u * math.pi / 2))))
        rings.append(ring)
    n = len(foot)
    for k in range(levels):
        for i in range(n):
            bm.faces.new((rings[k][i], rings[k][(i + 1) % n], rings[k + 1][(i + 1) % n], rings[k + 1][i]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = K.obj_from_bmesh(bm, "last", mat)
    sub = o.modifiers.new("sub", "SUBSURF")
    sub.levels = 2
    K.apply_modifiers(o)
    return K.shade_smooth(o, 80)


def shoe(kind, side):
    L, W = (0.27, 0.098) if kind == "sneaker" else (0.265, 0.09)
    foot = footprint(L, W)
    sole_h = 0.024 if kind == "sneaker" else 0.012
    sole = K.slab(footprint(L + 0.008, W + 0.008), 0, sole_h,
                  "sole-white" if kind == "sneaker" else "rubber", bevel=0.004)
    upper_mat = "canvas-white" if kind == "sneaker" else "leather-tan"
    if kind == "sneaker":
        height = lambda t: 0.035 + 0.05 * min(1, max(0, (t - 0.1) / 0.55)) ** 0.8
    else:
        height = lambda t: 0.03 + 0.03 * min(1, max(0, (t - 0.1) / 0.45)) ** 0.8
    upper = last(foot, sole_h - 0.004, height, mat=upper_mat)
    # The opening: a cut whose walls take the dark lining material.
    oy, oz = (0.045, sole_h + 0.085) if kind == "sneaker" else (0.03, sole_h + 0.055)
    cutter = K.ellipsoid((0.036, 0.075 if kind == "sneaker" else 0.095, 0.03), loc=(0, oy, oz),
                         mat="leather-dark")
    cutter.rotation_euler.x = -0.12
    K.bake_transform(cutter)
    b = upper.modifiers.new("open", "BOOLEAN")
    b.operation = "DIFFERENCE"
    b.object = cutter
    b.solver = "EXACT"
    b.material_mode = "TRANSFER"
    K.apply_modifiers(upper)
    bpy.data.objects.remove(cutter)
    K.drop_islands(upper, 1500)
    for v in sole.data.vertices:  # toe spring
        t = (v.co.y + L / 2) / L
        v.co.z += 0.01 * max(0, 0.22 - t) / 0.22
    for v in upper.data.vertices:
        t = (v.co.y + L / 2) / L
        v.co.z += 0.01 * max(0, 0.22 - t) / 0.22
    parts = [sole, upper]
    tree = K.bvh(upper)
    down = Vector((0, 0, -1))
    if kind == "sneaker":
        for i in range(4):  # laces across the tongue
            y = -0.045 + i * 0.019
            pts = []
            for x in (-0.024, -0.008, 0.008, 0.024):
                hit = tree.ray_cast(Vector((x, y, 0.5)), down)
                pts.append((x, y, (hit[0].z if hit[0] else sole_h + 0.07) + 0.002))
            parts.append(K.tube(pts, 0.0021, "canvas-white", res=6, bevel_res=2))
        tab = K.box((0.02, 0.012, 0.03), loc=(0, L / 2 - 0.01, sole_h + 0.055), mat="leather-tan",
                    bevel=0.004)
        parts.append(tab)
    else:
        pts = []
        for x in (-0.03, -0.015, 0, 0.015, 0.03):
            hit = tree.ray_cast(Vector((x, -0.035, 0.5)), down)
            pts.append((x, -0.035, (hit[0].z if hit[0] else sole_h + 0.05) + 0.002))
        parts.append(K.tube(pts, 0.0028, "leather-dark", res=8, bevel_res=2))
    o = K.join(parts)
    o.rotation_euler.z = side * 0.05
    o.location.x = side * 0.058
    return K.bake_transform(o)


@asset("shoes", "shelf", 4400)
def sneakers():
    return [shoe("sneaker", s) for s in (-1, 1)]


@asset("shoes-loafer", "shelf", 4000)
def loafers():
    return [shoe("loafer", s) for s in (-1, 1)]


@asset("bag", "shelf", 3600)
def bag():
    body = K.blob([K.box((0.27, 0.11, 0.17), loc=(0, 0, 0.09), mat="leather-tan"),
                   K.box((0.24, 0.09, 0.03), loc=(0, 0, 0.17), mat="leather-tan")],
                  voxel=0.004, smooth=6, mat="leather-tan")
    for v in body.data.vertices:  # tapered top
        v.co.x *= 1 - 0.12 * max(0, v.co.z - 0.02) / 0.17
    tree = K.bvh(body)
    flap = K.pillow([(-0.12, 0.185), (0.12, 0.185), (0.115, 0.09), (0.0, 0.075), (-0.115, 0.09)],
                    0.008, mat="leather-dark", edge=0.012, voxel=0.0022, smooth=8)
    K.conform(flap, tree, 0.003)
    clasp = K.box((0.02, 0.006, 0.014), loc=(0, -0.062, 0.088), mat="brass", bevel=0.002)
    handles = [K.tube([(x, -0.0, 0.18), (x * 0.9, 0, 0.27), (-x * 0.9, 0, 0.27), (-x, 0, 0.18)],
                      0.0045, "leather-dark", res=12, bevel_res=3) for x in (-0.075,)]
    return [body, flap, clasp, *handles]


# ---------------------------------------------------------------- kitchen

SINK_BOWL = (0.44, 0.36)  # inner bowl; keep in step with src/scene/appliances sinkBowl()


@asset("sink", "countertop", 5200, floor=0.62)
def sink():
    """Inset bowl: one lofted shell from the flange edge down to a filleted floor."""
    import bmesh
    bw, bd = SINK_BOWL
    depth, rc, rf = 0.195, 0.016, 0.014
    rings = []  # (inset from the bowl outline, z); negative inset = outwards
    rings += [(-0.016, 0.0), (-0.0155, 0.004), (-0.012, 0.0062), (-0.004, 0.0062),
              (-0.0005, 0.0045), (0.0, 0.0)]
    for i in range(1, 9):
        t = math.radians(90 * i / 8)
        rings.append((rf * (1 - math.cos(t)), -depth + rf * (1 - math.sin(t))))
    rings.sort(key=lambda r: -r[1] if r[0] >= 0 else -1)
    lip, wall = rings[:6], [(0.0, -0.02)] + sorted(rings[6:], key=lambda r: -r[1])
    loops = []
    bm = bmesh.new()
    for inset, z in lip + wall:
        pts = K.rounded_rect(bw - 2 * inset, bd - 2 * inset, max(0.003, rc - inset), n=6)
        loops.append([bm.verts.new((x, y, z)) for x, y in pts])
    n = len(loops[0])
    for a_, b_ in zip(loops, loops[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a_[i], a_[j], b_[j], b_[i]))
    bm.faces.new(list(reversed(loops[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    body = K.obj_from_bmesh(bm, "sink", "steel")
    sol = body.modifiers.new("solid", "SOLIDIFY")
    sol.thickness = 0.0012
    sub = body.modifiers.new("sub", "SUBSURF")
    sub.levels = 1
    K.apply_modifiers(body)
    K.shade_smooth(body, 60)
    floor = -depth
    gap = K.annulus(0.034, 0.042, (0, 0.06, floor + 0.0005), "rubber")
    strainer = K.lathe([(0.0, floor + 0.0035), (0.03, floor + 0.0015), (0.034, floor + 0.0008)],
                       "steel", segs=40)
    strainer.location.y = 0.06
    K.bake_transform(strainer)
    rim = K.annulus(0.042, 0.046, (0, 0.06, floor + 0.0004), "chrome")
    slot = K.box((0.04, 0.003, 0.009), loc=(0, bd / 2 - 0.0002, -0.03), mat="rubber", bevel=0.002)
    return [body, gap, strainer, rim, slot]


def tap_lever(x_side):
    housing = K.cyl(0.0165, 0.0165, 0.03, loc=(x_side * 0.026, 0, 0.12), rot=(0, math.pi / 2, 0),
                    mat="chrome", verts=28, bevel=0.003)
    lever = K.tube([(x_side * 0.04, 0, 0.12), (x_side * 0.052, 0, 0.13), (x_side * 0.065, 0, 0.175)],
                   0.0042, "chrome", res=8, bevel_res=3)
    return [housing, lever]


@asset("tap", "countertop", 3600, floor=0.75)
def tap():
    body = K.lathe([(0, 0), (0.027, 0), (0.028, 0.004), (0.025, 0.012), (0.0175, 0.022),
                    (0.0165, 0.17), (0.0155, 0.19), (0, 0.19)], "chrome", segs=40, smooth_angle=70)
    spout = K.tube([(0, 0, 0.16), (0, 0, 0.27), (0, -0.01, 0.33), (0, -0.06, 0.36),
                    (0, -0.12, 0.35), (0, -0.155, 0.31), (0, -0.16, 0.27)], 0.011, "chrome",
                   res=24, bevel_res=5)
    aerator = K.cyl(0.0125, 0.0125, 0.014, loc=(0, -0.16, 0.262), mat="chrome", verts=24, bevel=0.002)
    face = K.annulus(0.0, 0.0085, (0, -0.16, 0.2545), "rubber", segs=20)
    return [body, spout, aerator, face, *tap_lever(1)]


@asset("tap-black", "countertop", 2400, floor=0.75, shared=True)
def tap_black():
    col = K.box((0.034, 0.034, 0.32), loc=(0, 0, 0.16), mat="black-matte", bevel=0.008, segs=4)
    base = K.cyl(0.03, 0.03, 0.008, loc=(0, 0, 0.004), mat="black-matte", verts=32, bevel=0.002)
    spout = K.box((0.026, 0.18, 0.026), loc=(0, -0.085, 0.307), mat="black-matte", bevel=0.007,
                  segs=4)
    outlet = K.box((0.02, 0.02, 0.006), loc=(0, -0.16, 0.293), mat="rubber", bevel=0.002)
    lever = K.box((0.012, 0.06, 0.01), loc=(0.024, 0.0, 0.25), mat="black-matte", bevel=0.004,
                  rot=(0.35, 0, 0))
    knob = K.cyl(0.012, 0.012, 0.02, loc=(0.022, 0, 0.25), rot=(0, math.pi / 2, 0),
                 mat="black-matte", verts=24, bevel=0.003)
    return [col, base, spout, outlet, lever, knob]


@asset("hob", "countertop", 6000, floor=0.85, shared=True)
def hob():
    w, d = 0.56, 0.48
    glass = K.box((w, d, 0.006), loc=(0, 0, 0.003), mat="black-glass", bevel=0.0025, segs=3)
    parts = [glass]
    top = 0.006
    for x, y, r in ((-0.135, -0.1, 0.095), (-0.135, 0.12, 0.075), (0.135, -0.1, 0.075),
                    (0.135, 0.12, 0.095)):
        parts.append(K.annulus(r - 0.0022, r, (x, y, top), "print", segs=56))
        parts.append(K.annulus(r * 0.55 - 0.0015, r * 0.55, (x, y, top), "print", segs=36))
        for a in (0, 90, 180, 270):  # zone corner ticks
            ca, sa = math.cos(math.radians(a + 45)), math.sin(math.radians(a + 45))
            parts.append(K.box((0.012, 0.0016, 0.0004), loc=(x + ca * (r + 0.008), y + sa * (r + 0.008), top + 0.0002),
                               mat="print", rot=(0, 0, math.radians(a + 45))))
    # touch strip along the front edge
    parts.append(K.box((0.2, 0.0018, 0.0004), loc=(0, -0.205, top + 0.0002), mat="print"))
    for i in range(10):
        parts.append(K.box((0.0016, 0.006, 0.0004), loc=(-0.09 + i * 0.02, -0.196, top + 0.0002),
                           mat="print"))
    parts.append(K.annulus(0.0055, 0.0072, (0.235, -0.2, top), "print", segs=24))
    parts.append(K.annulus(0.0055, 0.0072, (-0.235, -0.2, top), "print", segs=24))
    parts.append(K.box((0.006, 0.006, 0.0004), loc=(0.2, -0.2, top + 0.0002), mat="digits"))
    return parts


@asset("oven", "center", 5200, floor=0.7, shared=True)
def oven():
    # front plane at glTF z = 0.023 like the cabinet fallback; Blender y = -z
    W, H = 0.58, 0.59
    frame = K.box((W, 0.046, H), loc=(0, 0.0, 0), mat="panel", bevel=0.004)
    door = K.box((W - 0.012, 0.012, 0.445), loc=(0, -0.029, -0.07), mat="black-glass", bevel=0.004)
    window = K.box((W - 0.13, 0.002, 0.28), loc=(0, -0.0355, -0.085), mat="glass-panel",
                   bevel=0.006)
    panel = K.box((W - 0.012, 0.008, 0.115), loc=(0, -0.027, 0.228), mat="black-glass", bevel=0.003)
    parts = [frame, door, window, panel]
    handle = K.tube([(-0.23, -0.07, 0.125), (0.23, -0.07, 0.125)], 0.0095, "steel", smooth=False,
                    res=2, bevel_res=4)
    parts.append(handle)
    for x in (-0.205, 0.205):
        parts.append(K.cyl(0.006, 0.006, 0.04, loc=(x, -0.05, 0.125), rot=(math.pi / 2, 0, 0),
                           mat="steel", verts=16))
        knob = K.cyl(0.019, 0.019, 0.018, loc=(x, -0.04, 0.23), rot=(math.pi / 2, 0, 0),
                     mat="steel", verts=36, bevel=0.003)
        notch = K.box((0.003, 0.002, 0.012), loc=(x, -0.0495, 0.236), mat="panel")
        ring = K.cyl(0.023, 0.023, 0.002, loc=(x, -0.0315, 0.23), rot=(math.pi / 2, 0, 0),
                     mat="steel-dark", verts=36)
        parts += [knob, notch, ring]
    disp = K.box((0.1, 0.002, 0.034), loc=(0, -0.0318, 0.232), mat="display", bevel=0.002)
    parts.append(disp)
    for i, x in enumerate((-0.03, -0.015, 0.008, 0.023)):
        parts.append(K.box((0.009, 0.0008, 0.016), loc=(x, -0.033, 0.232), mat="digits"))
    parts.append(K.box((0.003, 0.0008, 0.003), loc=(-0.0035, -0.033, 0.236), mat="digits"))
    parts.append(K.box((0.003, 0.0008, 0.003), loc=(-0.0035, -0.033, 0.228), mat="digits"))
    for i, x in enumerate((-0.15, -0.12, 0.12, 0.15)):
        mark = K.annulus(0.004, 0.0052, (0, 0, 0), "print", segs=16)
        mark.rotation_euler.x = math.pi / 2
        mark.location = (x, -0.0312, 0.232)
        parts.append(K.bake_transform(mark))
    # interior glimpse: rack lines behind the window
    for z in (-0.14, -0.06, 0.02):
        parts.append(K.box((W - 0.16, 0.003, 0.003), loc=(0, -0.031, z), mat="steel-dark"))
    return parts


@asset("hood", "center", 4400, floor=0.65, shared=True)
def hood():
    # Same frame as the procedural hood: canopy centred at y=-0.035, z=0.035 (glTF)
    w = 0.6
    canopy = K.box((w, 0.43, 0.045), loc=(0, -0.035, -0.035), mat="steel", bevel=0.006, segs=3)
    lip = K.box((w - 0.004, 0.012, 0.03), loc=(0, -0.245, -0.03), mat="black-glass", bevel=0.003)
    parts = [canopy, lip]
    for i in range(3):  # baffle filters underneath
        x = -0.19 + i * 0.19
        parts.append(K.box((0.18, 0.28, 0.003), loc=(x, -0.05, -0.059), mat="steel-dark", bevel=0.001))
        for j in range(9):
            parts.append(K.box((0.17, 0.006, 0.002), loc=(x, -0.17 + j * 0.03, -0.061), mat="steel"))
    for x in (-0.2, 0.2):
        parts.append(K.cyl(0.018, 0.018, 0.003, loc=(x, -0.2, -0.0585), mat="led", verts=24))
    for i in range(4):
        parts.append(K.cyl(0.006, 0.006, 0.003, loc=(0.12 + i * 0.03, -0.252, -0.03),
                           rot=(math.pi / 2, 0, 0), mat="steel", verts=16))
    lower = K.box((0.24, 0.19, 0.3), loc=(0, 0.1, 0.13), mat="steel", bevel=0.004)
    upper = K.box((0.232, 0.182, 0.3), loc=(0, 0.1, 0.42), mat="steel", bevel=0.004)
    parts += [lower, upper]
    return parts


@asset("fridge", "floor-front", 3600, floor=0.65, shared=True)
def fridge():
    parts = []
    for z, h in ((1.285, 1.21), (0.33, 0.62)):
        parts.append(K.box((0.575, 0.042, h), loc=(0, -0.01, z), mat="steel", bevel=0.008, segs=4))
        parts.append(K.box((0.56, 0.006, h - 0.01), loc=(0, 0.013, z), mat="gasket"))
        # bar handle on stand-offs
        top, bot = z + min(0.2, h * 0.3), z - min(0.2, h * 0.3)
        if h < 1:
            top, bot = z + h * 0.42, z + h * 0.15
        else:
            top, bot = z - h * 0.12, z - h * 0.42
        parts.append(K.tube([(-0.235, -0.07, bot), (-0.235, -0.07, top)], 0.009, "steel-dark",
                            smooth=False, res=2, bevel_res=4))
        for zz in (bot + 0.02, top - 0.02):
            parts.append(K.cyl(0.006, 0.006, 0.04, loc=(-0.235, -0.05, zz), rot=(math.pi / 2, 0, 0),
                               mat="steel-dark", verts=14))
    parts.append(K.box((0.07, 0.003, 0.1), loc=(0.19, -0.032, 1.5), mat="black-glass", bevel=0.003))
    for i in range(3):
        parts.append(K.box((0.012, 0.001, 0.004), loc=(0.17 + i * 0.02, -0.034, 1.53), mat="led"))
    parts.append(K.box((0.55, 0.03, 0.05), loc=(0, -0.0, 0.04), mat="black-matte", bevel=0.003))
    for i in range(10):
        parts.append(K.box((0.006, 0.004, 0.03), loc=(-0.22 + i * 0.049, -0.016, 0.04),
                           mat="rubber"))
    return parts


@asset("stool", "floor", 4800, floor=0.6)
def stool():
    seat_z = 0.64
    cushion = K.lathe([(0, seat_z + 0.06), (0.14, seat_z + 0.06), (0.168, seat_z + 0.052),
                       (0.18, seat_z + 0.035), (0.176, seat_z + 0.012), (0.16, seat_z), (0, seat_z)],
                      "upholstery", segs=48, smooth_angle=80)
    pan = K.cyl(0.16, 0.155, 0.016, loc=(0, 0, seat_z - 0.008), mat="oak", verts=48, bevel=0.004)
    parts = [cushion, pan]
    for i in range(4):
        a = math.radians(45 + 90 * i)
        top = (0.12 * math.cos(a), 0.12 * math.sin(a), seat_z - 0.016)
        bot = (0.185 * math.cos(a), 0.185 * math.sin(a), 0.012)  # caps stay above the floor
        parts.append(K.tube([bot, top], 0.012, "black-matte", smooth=False, res=2, bevel_res=3))
        parts.append(K.cyl(0.013, 0.013, 0.01, loc=(bot[0], bot[1], 0.005), mat="rubber", verts=16))
    ring = [(0.168 * math.cos(math.tau * i / 32), 0.168 * math.sin(math.tau * i / 32), 0.24)
            for i in range(32)]
    parts.append(K.tube(ring, 0.008, "black-matte", res=4, bevel_res=3, cyclic=True))
    # Low bentwood back on the side away from the counter (Blender +Y = glTF -Z),
    # so stools still read behind an island from the room.
    arc = lambda r, z: [(r * math.cos(math.radians(a)), r * math.sin(math.radians(a)), z)
                        for a in range(35, 146, 10)]
    parts.append(K.tube(arc(0.165, seat_z + 0.235), 0.016, "oak", res=16, bevel_res=4))
    parts.append(K.tube(arc(0.165, seat_z + 0.15), 0.009, "black-matte", res=16, bevel_res=3))
    for a in (55, 125):
        x, y = 0.16 * math.cos(math.radians(a)), 0.16 * math.sin(math.radians(a))
        parts.append(K.tube([(x, y, seat_z + 0.02), (x * 1.02, y * 1.02, seat_z + 0.235)], 0.009,
                            "black-matte", smooth=False, res=2, bevel_res=3))
    return parts


@asset("pendant", "ceiling", 3200, floor=0.8, shared=True)
def pendant():
    canopy = K.lathe([(0, 0), (0.05, 0), (0.05, -0.016), (0.045, -0.02), (0, -0.02)], "shade-outer",
                     segs=36)
    cord = K.cyl(0.0025, 0.0025, 0.46, loc=(0, 0, -0.25), mat="black-matte", verts=10, cap=False)
    prof = [(0.018, -0.48), (0.03, -0.485), (0.06, -0.5), (0.11, -0.54), (0.15, -0.6),
            (0.168, -0.65), (0.17, -0.668)]
    outer = K.lathe(prof, "shade-outer", segs=64, smooth_angle=70)
    inner = K.lathe([(r - 0.002, z - 0.002) for r, z in reversed(prof)], "shade-inner", segs=64,
                    smooth_angle=70)
    collar = K.cyl(0.02, 0.02, 0.03, loc=(0, 0, -0.475), mat="brass", verts=24, bevel=0.002)
    diffuser = K.cyl(0.15, 0.15, 0.003, loc=(0, 0, -0.655), mat="diffuser", verts=64)
    return [canopy, cord, outer, inner, collar, diffuser]


# ---------------------------------------------------------------- export

def preview(o, path, tint="#8b9fb3"):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 32
    scene.cycles.device = "CPU"
    scene.render.resolution_x = scene.render.resolution_y = 640
    scene.render.film_transparent = False
    world = scene.world or bpy.data.worlds.new("w")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.55, 0.55, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.6
    for m in o.data.materials:
        nodes = m.node_tree.nodes
        bsdf = nodes["Principled BSDF"]
        attr = nodes.new("ShaderNodeVertexColor")
        attr.layer_name = "Col"
        mix = nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1
        base = bsdf.inputs["Base Color"]
        if m.name == "fabric":
            base.default_value = (*K.hex_rgb(tint), 1)
        if base.is_linked:
            src = base.links[0].from_socket
            m.node_tree.links.new(src, mix.inputs["A"])
        else:
            mix.inputs["A"].default_value = base.default_value
        m.node_tree.links.new(attr.outputs["Color"], mix.inputs["B"])
        m.node_tree.links.new(mix.outputs["Result"], base)
    lo, hi = K.bounds(o)
    c = (lo + hi) / 2
    size = max(hi - lo)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    scene.collection.objects.link(cam)
    cam.data.lens = 60
    d = size * 2.3
    cam.location = c + Vector((d * 0.55, -d * 0.8, d * 0.25))
    cam.rotation_euler = (c - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    light = bpy.data.objects.new("key", bpy.data.lights.new("key", "AREA"))
    light.data.energy = 120 * size * size / 0.25
    light.data.size = size
    light.location = c + Vector((-size, -size * 1.5, size * 1.5))
    light.rotation_euler = (c - light.location).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(light)
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def build(id, spec):
    report = {}
    for detail in ("balanced",) if spec["shared"] else ("balanced", "lightweight"):
        K.reset()
        parts = spec["fn"]()
        o = K.join(parts)
        o.name = id
        budget = spec["budget"] if detail == "balanced" else int(spec["budget"] * spec["light"])
        K.decimate_to(o, budget)
        K.bake_ao(o, floor=spec["floor"], samples=48 if detail == "balanced" else 24,
                  layer_colours=COLOURS.get(id))
        info = K.export_glb(o, OUT / f"{id}-{detail}.glb", keep_uv=spec["texture"])
        report[detail] = info
        if detail == "balanced" and PREVIEW:
            preview(o, OUT / f"{id}.png")
        print("BUILT", id, detail, info["triangles"])
    if spec["shared"]:
        report["lightweight"] = report["balanced"]
        report["shared"] = True
    report["origin"] = spec["origin"]
    (OUT / f"{id}.json").write_text(json.dumps(report, indent=1))


for id, spec in BUILDERS.items():
    if not WANTED or id in WANTED:
        build(id, spec)
