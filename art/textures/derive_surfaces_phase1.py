"""Phase 1 review fixes for three surface maps, so each looks like its name.

Usage:  python3 art/textures/derive_surfaces_phase1.py public/shared/textures

All inputs are maps already shipped in public/shared/textures (CC0 sources,
see public/shared/ASSETS.md); only Pillow is required. Run it once on the
original maps: it rewrites concrete and tiles in place.

- f206-color / f206-roughness: EGGER F206 "Black Pietra Grigia" was drawn
  with the pale granite map. A dark slate-grey stone with fine light veins,
  made by inverting the Marble012 veining (dark ground, light veins), with a
  matt surface like the real compact laminate.
- concrete-color / concrete-normal: the source read as brown terrazzo
  (pebbles). Pebbles removed, neutral warm grey with soft cloudy variation.
- tiles-*: one 60 × 60 cm porcelain tile per map (the floor maps it at
  60 cm), now with a 5 mm grout joint so it reads as a tiled floor.
"""

import sys
from math import sqrt
from pathlib import Path

from PIL import Image, ImageFilter, ImageStat

root = Path(sys.argv[1])
SIZE = 1024


def save(image, name, quality=86, size=SIZE):
    if image.size[0] != size:
        image = image.resize((size, size), Image.LANCZOS)
    image.save(root / f"{name}.webp", "WEBP", quality=quality, method=6)


def wrapped(image, fn, pad=64):
    """Apply a filter as if the tile repeated on every side (no seams)."""
    w, h = image.size
    big = Image.new(image.mode, (w + 2 * pad, h + 2 * pad))
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            big.paste(image, (pad + dx * w, pad + dy * h))
    return fn(big).crop((pad, pad, pad + w, pad + h))


def normal_from_height(height, strength):
    w, h = height.size
    hp = height.load()
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            dx = (hp[(x + 1) % w, y] - hp[(x - 1) % w, y]) / 255 * strength
            dy = (hp[x, (y + 1) % h] - hp[x, (y - 1) % h]) / 255 * strength
            nx, ny, nz = -dx, dy, 1.0
            length = sqrt(nx * nx + ny * ny + nz * nz)
            px[x, y] = (
                round((nx / length * 0.5 + 0.5) * 255),
                round((ny / length * 0.5 + 0.5) * 255),
                round((nz / length * 0.5 + 0.5) * 255),
            )
    return img


def tint(grey, rgb_scale):
    return Image.merge(
        "RGB",
        [grey.point(lambda v, s=s: min(255, round(v * s))) for s in rgb_scale],
    )


# EGGER F206 Black Pietra Grigia.
marble = Image.open(root / "marble-color.webp").convert("L")
mu = ImageStat.Stat(marble).mean[0]
BASE = 58


def stone(v):
    d = mu - v  # marble veins are darker than its ground: they turn light
    return max(40, min(150, round(BASE + (1.35 * d if d > 0 else 0.4 * d))))


veins = marble.point(stone)
save(tint(veins, (1.0, 1.0, 0.985)), "f206-color", 78)
# Matt (PM) surface, veins a touch smoother.
save(
    veins.point(lambda v: max(190, min(240, round(232 - (v - BASE) * 0.25)))).convert(
        "RGB"
    ),
    "f206-roughness",
    80,
    512,
)

# Concrete: remove the pebbles, keep a soft cloudy variation.
concrete = Image.open(root / "concrete-color.webp").convert("L")
# Light pebbles are clipped to the mortar first, then filtered away.
c_stat = ImageStat.Stat(concrete)
ceiling = c_stat.mean[0] + 0.4 * c_stat.stddev[0]
concrete = concrete.point(lambda v: min(v, round(ceiling)))
calm = wrapped(concrete, lambda im: im.filter(ImageFilter.MedianFilter(9)))
calm = wrapped(calm, lambda im: im.filter(ImageFilter.MedianFilter(7)))
cloud = wrapped(calm, lambda im: im.filter(ImageFilter.GaussianBlur(28)))
fine = wrapped(calm, lambda im: im.filter(ImageFilter.GaussianBlur(1.2)))
mix = Image.blend(cloud, fine, 0.45)
stat = ImageStat.Stat(mix)
c_mu, c_sigma = stat.mean[0], max(stat.stddev[0], 1)
grey = mix.point(lambda v: max(0, min(255, round(132 + (v - c_mu) / c_sigma * 9))))
save(tint(grey, (1.0, 0.985, 0.95)), "concrete-color")
save(normal_from_height(fine, 1.2), "concrete-normal", 90)

# Tiles: grout joint along the map's edges (one tile per repeat).
JOINT, BEVEL = 4, 3


def edge_distance(x, y):
    return min(x, y, SIZE - 1 - x, SIZE - 1 - y)


tile = Image.open(root / "tiles-color.webp").convert("RGB")
rough = Image.open(root / "tiles-roughness.webp").convert("L")
height = Image.new("L", (SIZE, SIZE), 255)
tp, rp, hp = tile.load(), rough.load(), height.load()
GROUT = (138, 134, 127)
for y in range(SIZE):
    for x in range(SIZE):
        d = edge_distance(x, y)
        if d < JOINT:
            tp[x, y] = GROUT
            rp[x, y] = 236
            hp[x, y] = 120
        elif d < JOINT + BEVEL:
            t = (d - JOINT + 1) / (BEVEL + 1)
            r, g, b = tp[x, y]
            tp[x, y] = tuple(round(c * (0.93 + 0.07 * t)) for c in (r, g, b))
            hp[x, y] = round(120 + 135 * t)
save(tile, "tiles-color")
save(rough.convert("RGB"), "tiles-roughness", 90)
save(normal_from_height(height, 3.0), "tiles-normal", 92)
print("ok")
