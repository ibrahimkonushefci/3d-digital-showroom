"""Make a shipped stone map pair tile seamlessly (Phase 1 follow-up, B5).

Usage:  python3 art/textures/seamless_stone.py <in-dir> <out-dir> travertine

Reads <name>-color.webp and <name>-roughness.webp and rewrites them so the
left/right and top/bottom edges continue into each other: OVERLAP pixels of
each edge are replaced by one minimum-error seam cut (image quilting), then
the tile is resampled back to its size with wrap-aware filtering. Colour and
roughness share the same cuts, so they stay registered. Content, scale and
colour are otherwise unchanged. Only Pillow is required. Derived from the
CC0 ambientCG source already shipped in public/shared/textures.
"""

import sys
from pathlib import Path

from PIL import Image

src, out, name = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
OVERLAP = 96
FEATHER = 3


def min_cut(a, b):
    """Columns path through two equal-size L images (overlap strips, same
    height): returns x of the cut per row; left of it comes from `a`."""
    w, h = a.size
    pa, pb = a.load(), b.load()
    # The cut stays clear of the strip's outer columns: those must remain the
    # untouched neighbours of the pixels on either side of the strip.
    margin = FEATHER + 2
    cost = [
        [
            (pa[x, y] - pb[x, y]) ** 2 if margin <= x < w - margin else 1e12
            for x in range(w)
        ]
        for y in range(h)
    ]
    acc = [cost[0][:]]
    for y in range(1, h):
        prev, row = acc[-1], []
        for x in range(w):
            row.append(cost[y][x] + min(prev[max(0, x - 1) : x + 2]))
        acc.append(row)
    path = [min(range(w), key=lambda x: acc[-1][x])]
    for y in range(h - 2, -1, -1):
        x = path[-1]
        lo, hi = max(0, x - 1), min(w, x + 2)
        path.append(min(range(lo, hi), key=lambda i: acc[y][i]))
    return path[::-1]


def mask_for(path, w, h):
    """White where the right/lower piece shows, with a short feather."""
    mask = Image.new("L", (w, h))
    px = mask.load()
    for y, cut in enumerate(path):
        for x in range(w):
            t = (x - cut + FEATHER) / (2 * FEATHER)
            px[x, y] = round(255 * min(1, max(0, t)))
    return mask


def join(tail_pairs, head_pairs, path):
    """Merge overlapping strips (lists of [color, roughness]) along a cut."""
    w, h = tail_pairs[0].size
    mask = mask_for(path, w, h)
    return [Image.composite(head, tail, mask) for tail, head in zip(tail_pairs, head_pairs)]


def strip(images, box):
    return [im.crop(box) for im in images]


def wrap_x(pieces):
    """pieces: list of [color, roughness] tiles of equal size, laid out left to
    right and wrapping. Each joint keeps OVERLAP columns of both neighbours and
    replaces them with one min-cut strip."""
    w, h = pieces[0][0].size
    columns = []
    n = len(pieces)
    for i, piece in enumerate(pieces):
        prev = pieces[(i - 1) % n]
        tail = strip(prev, (w - OVERLAP, 0, w, h))
        head = strip(piece, (0, 0, OVERLAP, h))
        path = min_cut(tail[0].convert("L"), head[0].convert("L"))
        columns.append(join(tail, head, path))
        columns.append(strip(piece, (OVERLAP, 0, w - OVERLAP, h)))
    total = sum(c[0].size[0] for c in columns)
    result = [Image.new(pieces[0][k].mode, (total, h)) for k in range(2)]
    x = 0
    for c in columns:
        for k in range(2):
            result[k].paste(c[k], (x, 0))
        x += c[0].size[0]
    return result


def wrap_y(images):
    rotated = [im.transpose(Image.Transpose.ROTATE_90) for im in images]
    return [im.transpose(Image.Transpose.ROTATE_270) for im in wrap_x([rotated])]


def wrap_resize(image, size):
    """Resample as a tile: filter a 3×3 mosaic, keep the middle."""
    w, h = image.size
    mosaic = Image.new(image.mode, (3 * w, 3 * h))
    for i in range(3):
        for j in range(3):
            mosaic.paste(image, (i * w, j * h))
    big = mosaic.resize((3 * size[0], 3 * size[1]), Image.LANCZOS)
    return big.crop((size[0], size[1], 2 * size[0], 2 * size[1]))


color = Image.open(src / f"{name}-color.webp").convert("RGB")
rough = Image.open(src / f"{name}-roughness.webp").convert("RGB")
size = color.size
final = wrap_y(wrap_x([[color, rough]]))
for im, kind in zip(final, ("color", "roughness")):
    wrap_resize(im, size).save(
        out / f"{name}-{kind}.webp", "WEBP", quality=84, method=6
    )
print("ok", final[0].size, "->", size)
