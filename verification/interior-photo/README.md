# Interior photo visualizer verification

Verified locally on 9 October 2026. Implementation is ready for visual review; deployment and physical-device acceptance are outside this sprint.

## Delivered behavior

Three locally bundled 1920 × 1280 photographic environments replace the procedural interior room. Calibrated WebGL layers replace floor decor, door leaves, frames and hardware; masks retain photographed furniture, doorway recesses and skirting boundaries. The bedroom keeps its photographed open-door angle. The exterior compositor remains unchanged.

Door products are shared across scenes and quote entries. Room switching changes only the preview. New quotes use 220 × 600 cm flooring and four doors: 90/80/80/70 cm widths, 200 cm leaves, 205 cm frames and 15 cm frame depth. Quote entries retain individual sizing and opening direction. Version-1 saves/links migrate while retaining mixed products, measurements, offer fields and original pricing until a global product is chosen.

The interface has room pills, photographic/material cards, expandable secondary settings, bounded pan/zoom, a four-arrow control and a sticky price bar. English, Albanian and German remain available. PDF capture excludes interface controls, uses the current composite and records actual leaf/frame/depth specifications. Loading errors disable export; a visible download link provides an alternative when the browser suppresses repeated automatic downloads.

## Automated checks

| Check | Result |
| --- | --- |
| `pnpm test` | 81 tests across 10 files passed |
| `pnpm build` | Passed TypeScript, production bundle and budget check |
| Shipped assets | 8,700,073 bytes |
| Unique precache assets | 8,665,115 bytes; 145 URLs |
| Budget | Below 9 MB target and 10,000,000-byte enforced limit |
| `git diff --check` | Passed |

Coverage includes shared product updates, exact price invariance on room switches, quantity changes, standard dimensions, legacy mixed-product migration, offer preservation, brand isolation, version-1/version-2 share round trips, valid calibration geometry/mask paths, compatible catalog presets and unavailable WebGL. Existing whole-pack, waste, skirting, installation, transport and VAT pricing tests remain in the suite.

## Built-in browser checks

All browser work used @Browser. Responsive views were checked at 1024 × 768 and 390 × 844. Room/product switching, selected prices, quantity add/remove, dimensions, persistence, share-link loading, translations and PDF downloads worked. Primary product/navigation controls meet the 44 px target. Zoom stops at 1–1.8; pan remains inside the photograph (maximum normalized displacement 0.222222 at maximum zoom). Reset restores the default view. Straight, diagonal and herringbone choices and direction changes were exercised; herringbone changed waste/whole-pack quantities.

A deliberately unavailable scene image produced a recoverable loading error and disabled PDF generation. Restoring the asset and reloading recovered the scene. Renderer retry also recovered from an interrupted development renderer. WebGL absence is covered by a unit test; native GPU/context-loss behavior on physical devices is not certified.

The final production app was cached on a fresh localhost origin, its preview server stopped, and `lsof` confirmed no listener. Reload, all three room switches, product changes and the corrected bedroom PDF export then worked from the service-worker cache. Albanian hallway and English living-room offers were also downloaded with the preceding production preview server stopped; their scenes were unchanged by the final bedroom-only calibration correction. The preview server was restored at [localhost:4176](http://localhost:4176/designer/interior) for review.

An older preview origin retained an earlier service worker during an attempted update. Fresh-cache offline behavior passed; upgrading an existing installed cache remains a release check. The built-in browser sometimes delayed/suppressed repeated automatic PDF downloads. The explicit PDF-ready link was verified to save each current PDF, and the downloaded file contents were checked before copying the samples.

## Visual evidence and sample offers

The 24 final screenshots cover each room with white/satin-glass, oak, walnut and anthracite doors against light and dark flooring. Each combination was inspected through the three contact sheets. Grain, four glass strips, hardware placement, frame boundaries and furniture/skirting masks were reviewed. A bedroom frame post extending below the open leaf was corrected and the final composite re-exported. These are illustrative composites with fixed photographic perspectives, generic hardware and shader-based surface lighting; finish accuracy still needs physical samples and salesperson visual acceptance.

- [Tablet hallway](tablet-hallway.jpg), [tablet living room](tablet-living.jpg), [phone bedroom](phone-bedroom.jpg)
- [Hallway combinations](hallway-contact.jpg), [living-room combinations](living-contact.jpg), [bedroom combinations](bedroom-contact.jpg)
- [Loading failure](phone-loading-error.jpg), [herringbone](phone-herringbone.jpg), [offline bedroom](offline-bedroom.jpg)
- Full-resolution PDF scene captures: [hallway](hallway-composite.png), [living room](living-composite.png), [bedroom](bedroom-composite.png)
- Sample offers: [Albanian hallway](../../output/pdf/interior-hallway-sq.pdf), [English living room](../../output/pdf/interior-living-en.pdf), [German bedroom](../../output/pdf/interior-bedroom-de.pdf)

All six PDF pages were rendered with Poppler and visually inspected. They contain the selected scene, Unicode translations, materials, quote lines and totals; the four actual leaf widths/heights and frame specifications are present. Page PNGs are stored here as `*-pdf-1.png` and `*-pdf-2.png`. Raw viewport screenshots use `{room}-{door}-{light|dark}.jpg`.

## Asset provenance and reproduction

See [the asset ledger](../../public/shared/ASSETS.md) for original references. Hallway and bedroom backgrounds use the supplied `hallway-door-2.jpg` and `bedroom-door-3.jpg`. The furnished living room uses the approved [Max Vakhtbovych / Pexels photograph](https://www.pexels.com/photo/interior-of-modern-apartment-with-kitchen-and-living-room-6903161/). Original photos stay outside shipped assets. The photographic lever/rosette comes from the supplied hallway image. Oak/walnut grain was generated as unbranded illustrative material, color-calibrated to demo catalogs and optimized to 768 px WebP; no manufacturer-product authenticity is claimed.

`scripts/prepare-interior-assets.mjs` and `scripts/prepare-interior-grain.mjs` accept source paths and use Sharp to reproduce optimization/masks. Calibration lives in `public/shared/interior/scenes.json`; the compositor reuses the existing homography functions. Optional preview textures preserve legacy catalog identifiers and materials in other modules.

## Release checks still required

Physical iPad/iPhone performance, finger gestures, GPU/context-loss recovery, native downloads/sharing, the existing-cache update path and visual acceptance with real showroom samples remain unverified. Browser viewport checks establish responsive layout, not physical-device behavior. No deployment was performed.
