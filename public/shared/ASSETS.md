# Local asset sources

Baseline diffuse sources were CC0 Poly Haven assets downloaded through @Browser. The upgrade below supersedes the old marble/stone and oak-front files; current PBR maps are 1024px compressed WebP.

- oak.jpg: https://polyhaven.com/a/oak_wood_planks — Dimitrios Savva
- walnut.jpg: https://polyhaven.com/a/wood_table_001 — Dimitrios Savva / Rico Cilliers. Used as an illustrative walnut-tone finish, not a species certification.
- Original baseline marble/stone source: https://polyhaven.com/a/marble_01 — Rob Tuytel. Stone uses a warm tint for an illustrative travertine option.
- concrete.jpg: https://polyhaven.com/a/concrete_floor_01
- License: https://polyhaven.com/license
- Inter: @fontsource/inter, SIL Open Font License; bundled with application CSS.
- DejaVuSans.ttf: DejaVu Fonts, Bitstream Vera license; used for Unicode PDF offers. See FONT-LICENSE.txt.

Environment reflections are generated locally from area-light geometry; no remote HDRI request. Sample facade, door models, and preview illustrations are original procedural SVG assets.

## Showroom upgrade — 8 October 2026

Downloaded through @Browser from ambientCG, CC0: https://docs.ambientcg.com/license/ . Kept only color, OpenGL normal and roughness maps, resized to 1024 × 1024 and compressed to WebP.

- `veneer-*`: https://ambientcg.com/a/Wood051 — continuous wood grain, color adjusted to an illustrative light oak veneer. Species is illustrative.
- `travertine-*`: https://ambientcg.com/a/Travertine009 . `stone.jpg` now contains this distinct travertine.
- `marble-*`: https://ambientcg.com/a/Marble012 . `marble.jpg` now contains this distinct marble.
- `granite-*`: https://ambientcg.com/a/Granite002A .
- `walnut-*`, `concrete-*`, `laminate-*`: the original Poly Haven sources above; OpenGL normal detail is derived from the source luminance, roughness derived locally. `laminate-color.webp` preserves the floor planks; `oak.jpg` is now continuous veneer.
- `tiles-*`: neutral porcelain illustration derived from the licensed concrete source.
- `quartz-*`: original seeded procedural fine aggregate illustration; CC0 dedication by this project. No supplier-product or species claim.
- `smooth-*`: original neutral normal/roughness maps for untextured finishes; CC0 dedication by this project.

The old paragraph describing identical marble/stone applies only to the original baseline; those files have now been replaced. All new material maps are 1K; no remote runtime asset requests.

`shared/scenes/house-1.svg`, `house-2.svg`, `house-3.svg` are original procedural placeholder illustrations, CC0, with identical example opening coordinates. They are not photographs of Kosovo properties. Replace them with client-authorized photographs before presenting them as real homes.

- `floor-natural.webp`, `floor-grey.webp`, `floor-white-oak.webp`, `floor-dark-oak.webp`, `floor-rustic.webp`, `floor-herringbone-oak.webp`: licensed ambientCG Wood051 grain with original color adjustments; illustrative demo decors. Normal/roughness use the corresponding veneer maps.
- `floor-walnut-floor.webp`: licensed Poly Haven wood_table_001 with an illustrative walnut tint; corresponding walnut normal/roughness maps are locally derived.
- `floor-concrete-look.webp`: licensed Poly Haven concrete_floor_01 with an illustrative laminate-decor tint; corresponding concrete maps are locally derived.
- `shared/interior.svg`: original isometric room/door illustration, CC0 dedication by this project.
- Three.js furniture, appliances, garments, house, doors/windows, interior room and floor shader are original procedural geometry. No downloaded proprietary models or supplier product claims.

## Premium showroom — 9 October 2026

The three `house-*.webp` files replace the SVG demo scenes in the scene index. These are real stock photographs, not client projects or Kosovo properties. Sample dimensions are illustrative. Each has independently calibrated normalized corners. Downloaded through @Browser and resized to a 2048px long edge, WebP quality 83; no remote runtime requests.

- `house-1.webp`: Charlesdeluvio, [Apartment building with wooden front door](https://www.pexels.com/photo/apartment-building-with-wooden-front-door-4782382/).
- `house-2.webp`: Esra Yılmaz, [Brown wooden door of concrete house](https://www.pexels.com/photo/brown-wooden-door-of-concrete-house-14171173/).
- `house-3.webp`: Curtis Adams, [Exterior and the entrance of a modern house](https://www.pexels.com/photo/exterior-and-the-entrance-of-a-modern-house-19227220/).

[Pexels License](https://www.pexels.com/license/), checked 9 October 2026: allows use in apps and modification; attribution is optional. Do not resell unaltered photos, redistribute as stock, imply endorsement or use as a trademark. The app uses them as configurable demo backgrounds. Original photographers retain their rights.

### Supplier reference metadata (verified through @Browser)

These are product-name references only. No proprietary supplier images were downloaded. New reference finishes reuse licensed illustrative maps or approximate neutral colors; visible material notes and PDF captions require a physical sample. Demo prices do not represent supplier quotations or Kosovo stock availability.

- EGGER [H3303 ST10 Natural Hamilton Oak](https://www.egger.com/en/furniture-interior-design/decors/H3303_10?country=GE). H3303 is **not Arlington Oak**. The demo uses the existing licensed veneer, not an exact H3303 scan.
- EGGER [U708 PM Light Grey](https://www.egger.com/en/furniture-interior-design/decors/U708_PM?country=MT).
- EGGER [U961 PM Graphite Grey](https://www.egger.com/en/furniture-interior-design/decors/U961_PM), PerfectSense Premium Matt; replaces the brief's non-specific "PerfectSense Matt Anthracite" wording with a verified reference.
- EGGER [F206 PM Black Pietra Grigia](https://www.egger.com/en/furniture-interior-design/decors/F206_PM?country=XK). The illustrative dark stone map is not an exact vein reproduction.
- Kronospan [K190 Black](https://kronospan.com/en_EN/decors/view/kronodesign/color/K190/).

`shared/showroom/*.webp` are locally rendered thumbnails of this app's procedural scenes. No third-party interior portfolio images or supplier endorsement is implied.

### Entrance and window studio — 10 October 2026

`shared/showroom/exterior.webp` was replaced with a local high-quality render of the app's concrete-and-travertine portal studio. It depicts illustrative golden-oak grain, glazing and existing catalog hardware. The studio reuses the local veneer, concrete and travertine maps documented above; reflections come from generated area lights. No new downloaded environment or supplier imagery was added. The thumbnail is presentation artwork and does not change the one-door new-quote default.

## Interior photo compositor — 9 October 2026 (Realism Overhaul)

- `interior/living.webp`: Modern European living room with architectural door casing and parquet/laminate floor.
- `interior/hallway.webp`: Architectural corridor with clean mitered door casing and oak flooring.
- `interior/bedroom.webp`: Scandinavian bedroom with prominent closed interior door, architectural casing, and open floor plane.
- Backgrounds are 1920 × 1280, optimized WebP quality 88.
- `interior/*-mask.webp`, `*-light.webp`: Calibrated floor/skirting masks and ambient light maps. Mask red = replacement floor, green = skirting, black = preserved scene.
- `interior/handle.png`: photographic inox lever/rosette extracted from the supplied hallway reference; black/brass variants use compositor tone adjustment.
- `interior/floor-*.webp`, `door-golden-oak.webp`, `door-walnut.webp`: illustrative oak/walnut grain generated with the imagegen skill, color calibrated to existing demo catalog colors, 768 × 768 WebP. These are unbranded visual examples, not scans of Hörmann, Prüm, Lip Bled, EGGER, Kronotex, AGT, or other supplier products. Existing catalog identifiers, source textures, pricing and supplier references stay intact. `previewTexture` is used only by the interior photo view and interior PDF swatches.

Source grain PNGs remain under the session's `~/.codex/generated_images/` directory. To reproduce optimized assets, install Sharp in your development environment (or provide its module path in `SHARP_MODULE`) and run the two `prepare-interior-*.mjs` scripts with the source paths. Scene quadrilaterals, visible floor polygons, furniture exclusions, skirting, and hardware anchors are in `interior/scenes.json`.
