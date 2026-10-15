"""Derive the shipped 1K WebP surface maps from CC0 ambientCG sources.

Usage:  python3 art/textures/derive_textures.py <ambientcg-download-dir> <out-dir>

The download dir holds unzipped `<AssetId>_1K-JPG` sets (ambientCG, CC0):
Wood051, WoodFloor051 and Plaster001.
Lacquer micro-texture is generated here (original, CC0 by this project).
Only Pillow is required.
"""

import random
import sys
from math import sqrt
from pathlib import Path

from PIL import Image, ImageFilter, ImageStat

src, out = Path(sys.argv[1]), Path(sys.argv[2])
SIZE = 1024


def load(asset, kind):
    return Image.open(src / asset / f"{asset}_1K-JPG_{kind}.jpg")


def save(image, name, quality=84, size=SIZE):
    image.resize((size, size), Image.LANCZOS).save(
        out / f"{name}.webp", "WEBP", quality=quality, method=6
    )


def recolour(image, mean, contrast):
    """Keep the source's grain, re-centred on an illustrative finish colour.
    `contrast` is the luminance std-dev relative to the mean (e.g. 0.12)."""
    grey = image.convert("L")
    stat = ImageStat.Stat(grey)
    mu, sigma = stat.mean[0], max(stat.stddev[0], 1)
    lut = [max(0.0, 1 + contrast * (v - mu) / sigma) for v in range(256)]
    bands = [
        grey.point([min(255, round(c * lut[v])) for v in range(256)])
        for c in mean
    ]
    return Image.merge("RGB", bands)


# Light natural oak veneer: Wood051 grain (runs along U, as before).
save(recolour(load("Wood051", "Color"), (178, 142, 103), 0.075), "veneer-color")
save(load("Wood051", "NormalGL"), "veneer-normal", 88)
save(load("Wood051", "Roughness"), "veneer-roughness")

# Seamless engineered oak floor (replaces the non-tiling laminate set).
save(load("WoodFloor051", "Color"), "laminate-color")
save(load("WoodFloor051", "NormalGL"), "laminate-normal", 88)
save(load("WoodFloor051", "Roughness"), "laminate-roughness")

# Stone normals stay flat: the polished ambientCG sources (Travertine009,
# Marble012, Granite002A) carry essentially no relief, so that is correct.

# Painted plaster walls: surface relief and sheen only; paint colour stays
# a parameter so customer wall colours keep working.
save(load("Plaster001", "NormalGL"), "plaster-normal", 80, 512)
save(load("Plaster001", "Roughness"), "plaster-roughness", 84, 512)


def tileable_noise(size, cell, seed):
    rnd = random.Random(seed)
    n = size // cell
    grid = [[rnd.random() for _ in range(n)] for _ in range(n)]
    img = Image.new("L", (size, size))
    px = img.load()
    for y in range(size):
        gy, fy = divmod(y / cell, 1)
        gy = int(gy)
        sy = fy * fy * (3 - 2 * fy)
        for x in range(size):
            gx, fx = divmod(x / cell, 1)
            gx = int(gx)
            sx = fx * fx * (3 - 2 * fx)
            a = grid[gy % n][gx % n]
            b = grid[gy % n][(gx + 1) % n]
            c = grid[(gy + 1) % n][gx % n]
            d = grid[(gy + 1) % n][(gx + 1) % n]
            top = a + (b - a) * sx
            bottom = c + (d - c) * sx
            px[x, y] = round(255 * (top + (bottom - top) * sy))
    return img


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


# Lacquer/foil "orange peel": a gentle, tileable micro-relief so smooth
# fronts catch light unevenly instead of reading as flat paint.
fine = tileable_noise(512, 8, 7)
broad = tileable_noise(512, 64, 11)
height = Image.blend(fine, broad, 0.35).filter(ImageFilter.GaussianBlur(1))
save(normal_from_height(height, 2.5), "smooth-normal", 90)
# Roughness keeps the calibrated mean (210) with ±4% variation.
rough = broad.point(lambda v: round(210 + (v - 128) * 0.07))
save(rough.convert("RGB"), "smooth-roughness", 90)
print("ok")
