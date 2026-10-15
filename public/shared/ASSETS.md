# Local asset sources

Baseline diffuse sources were CC0 Poly Haven assets downloaded through @Browser. The upgrade below supersedes the old marble/stone and oak-front files; current PBR maps are 1024px compressed WebP.

- Original oak source: https://polyhaven.com/a/oak_wood_planks — Dimitrios Savva
- Original walnut source: https://polyhaven.com/a/wood_table_001 — Dimitrios Savva / Rico Cilliers. Used as an illustrative walnut-tone finish, not a species certification.
- Original baseline marble/stone source: https://polyhaven.com/a/marble_01 — Rob Tuytel. Stone uses a warm tint for an illustrative travertine option.
- Original concrete source: https://polyhaven.com/a/concrete_floor_01
- License: https://polyhaven.com/license
- Inter: @fontsource/inter, SIL Open Font License; bundled with application CSS.
- DejaVuSans.ttf and DejaVuSans-Bold.ttf: DejaVu Fonts 2.37 (https://github.com/dejavu-fonts/dejavu-fonts/releases/tag/version_2_37), Bitstream Vera / Arev license; used for Unicode PDF offers. See FONT-LICENSE.txt (the release's LICENSE file). Subset with fonttools `pyftsubset` to Basic Latin, Latin-1, Latin Extended-A, Ș/ș/Ț/ț, dashes, quotes, bullet, ellipsis, €, №, ™ and − (about 50 KB each instead of 750 KB), which covers Albanian, English and German offers.

Environment reflections are generated locally from area-light geometry; no remote HDRI request. The setup kitchen illustration and furniture geometry are original project assets.

## Showroom upgrade — 8 October 2026

Downloaded through @Browser from ambientCG, CC0: https://docs.ambientcg.com/license/ . Kept only color, OpenGL normal and roughness maps, resized to 1024 × 1024 and compressed to WebP.

- `veneer-*`: https://ambientcg.com/a/Wood051 — continuous wood grain, color adjusted to an illustrative light oak veneer. Species is illustrative.
- `travertine-*`: https://ambientcg.com/a/Travertine009. Colour and roughness made seamless on 15 October 2026 (Phase 1 follow-up, B5) by `python3 art/textures/seamless_stone.py <dir-with-previous-maps> public/shared/textures travertine`: minimum-error seam cuts across both wraps, shared by both maps, same 1024² size, scale and colour.
- `marble-*`: https://ambientcg.com/a/Marble012.
- `granite-*`: https://ambientcg.com/a/Granite002A .
- `walnut-*`, `concrete-*`, `laminate-*`: the original Poly Haven sources above; OpenGL normal detail is derived from the source luminance, roughness derived locally. `laminate-color.webp` preserves the floor planks; furniture uses continuous veneer maps.
- `tiles-*`: neutral porcelain illustration derived from the licensed concrete source.
- `quartz-*`: original seeded procedural fine aggregate illustration; CC0 dedication by this project. No supplier-product or species claim.
- `smooth-*`: original neutral normal/roughness maps for untextured finishes; CC0 dedication by this project.

All new material maps are 1K; no remote runtime asset requests.

### Supplier reference metadata (verified through @Browser)

These are product-name references only. No proprietary supplier images were downloaded. New reference finishes reuse licensed illustrative maps or approximate neutral colors; visible material notes and PDF captions require a physical sample. Demo prices do not represent supplier quotations or Kosovo stock availability.

- EGGER [H3303 ST10 Natural Hamilton Oak](https://www.egger.com/en/furniture-interior-design/decors/H3303_10?country=GE). H3303 is **not Arlington Oak**. The demo uses the existing licensed veneer, not an exact H3303 scan.
- EGGER [U708 PM Light Grey](https://www.egger.com/en/furniture-interior-design/decors/U708_PM?country=MT).
- EGGER [U961 PM Graphite Grey](https://www.egger.com/en/furniture-interior-design/decors/U961_PM), PerfectSense Premium Matt; replaces the brief's non-specific "PerfectSense Matt Anthracite" wording with a verified reference.
- EGGER [F206 PM Black Pietra Grigia](https://www.egger.com/en/furniture-interior-design/decors/F206_PM?country=XK). The illustrative dark stone map is not an exact vein reproduction.
- Kronospan [K190 Black](https://kronospan.com/en_EN/decors/view/kronodesign/color/K190/).

`shared/showroom/*.webp` are locally rendered thumbnails of this app's procedural scenes. No third-party interior portfolio images or supplier endorsement is implied.

## Furniture sales demo — 10 October 2026

`shared/showroom/japandi.webp`, `modern.webp`, `classic.webp`, `wardrobe.webp` and the new `wardrobe-straight.webp` are current application captures of the five authored furniture presets (960px wide, WebP quality 84). Existing filename/ID mappings are retained: modern is the warm-white straight kitchen; classic is the anthracite island. Rendered via the local `/preview-studio` in @Browser, using only bundled textures and procedural geometry. No external assets were sourced. These are candidate presentation renders for visual review, not manufacturer imagery or owner-approved reference renders.

## Furniture-only cleanup — 11 October 2026

Only assets used by furniture remain. Original-source JPG duplicates, unused illustrations, specialist scenes and product textures were deleted. Source/license references above describe the retained derived WebP maps. The laminate/tiles/concrete environment maps remain because Kitchen and Wardrobe use them.

## Phase 2 original room kit — 14 October 2026

15 generic models in two levels of detail were authored locally by `scripts/author-room-kit.mjs`: oven and fridge fronts, tap, stool, pendant, bench, countertop ceramics, three opaque hanging silhouettes, two folded textiles, a shoe pair and two storage boxes. No external asset was acquired or purchased. No garment rig, texture, logo, remote URI or decoder is required. The original source is retained outside public runtime assets; the manifest records per-model source/optimized SHA-256, physical bounds/dimensions, anchors, material slots, draw/triangle counts and zero decoded texture bytes. Coordinate convention is metres, +Y up, +Z front; garments spread along Z on an X rail.

See `licenses/original-room-kit-v1.txt` for project-use and white-label/offline redistribution permission. These are illustrative generic objects, not quoted manufacturer products. 30 hashed GLBs total 980,308 bytes, below the 2.5 MB kit allocation; each is below 1 MB. Lower-detail assets reduce bevels/radial segments. Existing material rights and illustrative status remain unchanged. The original v1 room recipes retain inherited Phase 1 light metadata. Phase 3 uses separate v2 recipe files and original procedural room radiance; the old recipe bytes remain available. Existing public thumbnails remain historical captures pending owner approval.


### Phase 3 lighting (14 October 2026)

`rooms/kitchen-warm-v2.json` and `rooms/wardrobe-warm-v2.json` add bounded room lighting metadata. Environment radiance is authored in project code from the actual room/apertures, with a small room/decor-only runtime probe. No HDRI, texture, model, lightmap, external source or paid asset was acquired. Reflection targets are generated locally and disposed per renderer; old public recipe files are retained for cache/update compatibility. Existing material/model provenance and illustrative-product limitations still apply.

## Phase 1 correction — 15 October 2026

All new sources are CC0; provenance is also listed in `licenses/polyhaven-cc0.txt`.

- `veneer-*` re-derived from ambientCG Wood051 (https://ambientcg.com/a/Wood051) with natural grain contrast; `laminate-*` floor replaced by the seamless ambientCG WoodFloor051 (https://ambientcg.com/a/WoodFloor051); `plaster-normal/roughness` from ambientCG Plaster001 (https://ambientcg.com/a/Plaster001), paint colour stays a parameter; `smooth-normal/roughness` regenerated as an original subtle orange-peel micro-texture (CC0 by this project). Reproduce with `python3 art/textures/derive_textures.py <ambientcg-download-dir> <out-dir>`. Stone normal maps are unchanged: the polished ambientCG sources carry essentially no relief.
- `exterior-garden.webp`: perspective crop of the Poly Haven HDRI "Balcony" by Greg Zaal (https://polyhaven.com/a/balcony), shown behind windows from inside the room only.
- Decor models (`cutting-board`, `fruit-bowl`, `plant-small`, `vase`, `wall-art`, `basket`): Poly Haven CC0 glTF 1K sources, prepared headless in Blender by `art/blender/prepare_decor.py` with `art/blender/decor.json` (decimated, WebP textures at 384/192 px, artist AO kept), then registered by `node scripts/register-decor.mjs <prepared-dir> <download-dir>`. Licence key `polyhaven-cc0`. Decorative and unpriced. `scripts/author-room-kit.mjs` now preserves these manifest entries when it regenerates the original kit.
- Room recipes `rooms/*-warm-v3.json` add `environmentIntensity` and `interiorKeyIntensity`; v1/v2 files are unchanged.

## Phase 2 scripted kit — 15 October 2026

20 original models, authored by `art/blender/phase2_kit.py` with `art/blender/kit_lib.py` (headless Blender 5.2; generic geometry built from code, ambient occlusion baked into vertex colours, no textures, no downloaded meshes), licence key `original-room-kit-v2` (`licenses/original-room-kit-v2.txt`):

- Wardrobe: `shirt`, `tee`, `dress`, `coat`, `trousers` (each with a hanger; the `fabric` slot takes a per-instance colour at runtime), `fold`, `fold-ribbed`, `towels`, `shoes` (sneakers), `shoes-loafer`, `bag`.
- Kitchen: `sink` (44 × 36 cm inset bowl; the worktop cutout follows `sinkBowl()`), `tap` (chrome gooseneck), `tap-black`, `hob` (56 × 48 cm glass), `oven`, `hood` (60 cm chimney), `fridge`, `stool`, `pendant` (`diffuser` slot glows).

`node scripts/register-kit.mjs <out-dir>` optimises with glTF-Transform + meshoptimizer (dev dependencies only; `KHR_mesh_quantization` + `EXT_meshopt_compression`, decoded by the decoder bundled with three), names files by content hash and records Blender's bounds, triangles and material slots. Hard-surface pieces (hob, oven, hood, fridge, black tap, pendant) use one file for both detail levels because their bevels do not survive decimation. `--decor` re-encoded the Phase 1 CC0 decor geometry the same way (textures untouched). The superseded code-built models (oven, fridge, tap, stool, pendant, shirt, coat, trousers, fold, fold-ribbed, shoes) were removed; `bench`, `counter-set`, `box-linen` and `box-ink` remain from the original kit. Unique model bytes: 2.27 MB → 1.85 MB. Illustrative generic objects only; no brand or product is reproduced.
