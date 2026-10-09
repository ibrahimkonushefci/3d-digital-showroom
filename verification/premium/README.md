# Premium showroom upgrade — 9 October 2026

Implemented locally; no deployment or publication.

## Delivered

1. Shared demand-rendered quality policy, explicit ACES/sRGB exposure, bounded contact-shadow refresh, adaptive quality during consecutive moving frames, optional SSAO/FXAA, and asynchronous 1600px capture through the same render pipeline. Bloom remains disabled. Manual lightweight mode is preserved.
2. Reusable bevelled geometry, contiguous footprint-union worktops and sink holes, procedural appliances/foliage, drawer hardware, pantry/corner mechanisms, wardrobe shelves/rails/sliding overlap, and up to three warm area lights along continuous upper-cabinet runs.
3. Compatible catalog presets with curated cameras and local renderer-generated thumbnails. Optional supplier provenance preserves existing IDs and pricing. Official supplier references and photo licenses are recorded in `public/shared/ASSETS.md`.
4. Three calibrated, locally stored real-photo scenes: modern facade, stucco and stone entrances. Portrait aspect ratios are preserved. Shared door/window geometry supplies both house and photo previews. House paving, facade surfaces, roof edges and planting were refined.
5. Showroom/Edit modes, direct tap opening, 8px drag threshold, wall-space snapping, transient drag previews, validated single-step commit/undo, cancellation cleanup, and retained numeric/module controls. Portrait tablet and phone controls sit beneath a full-width scene.
6. A4 proposal cover, large rendered image, actual finish swatches, itemized details/dimensions/terms, multilingual font support, repeated table headers and page numbering. Existing price calculations are reused.

## Automated checks

- 70 tests pass (55 original + 15 added), including all-wall snapping, collision/opening rejection, rollback, cancellation, no-op history, one-step undo, preset compatibility, countertop unions/cutouts, photo calibration/budget, quality policy, price invariance and multilingual PDF pagination/fallback.
- TypeScript and production build pass.
- Shipped output: **7,375,430 bytes**.
- Unique precache: **7,344,000 bytes**, 123 URLs.
- Demo photos: **1,168,174 bytes**; six thumbnails: **104,252 bytes**.
- `pnpm build` enforces both shipped and unique precache totals below 10,000,000 bytes, warns above 9 MB, and retains the existing per-file precache ceiling.

## Built-in browser verification

- Desktop, 1024×768 landscape tablet, 768×1024 portrait tablet and 390×844 phone layouts inspected.
- All three bundled brands loaded; incompatible furniture presets are absent for Drita Home.
- One-tap cabinet opening, finish changes, invalid-drag rollback and disabled undo after rejection checked in the production UI. The final pantry front and trays were checked extending together; undo restored the original tall cabinet and estimate.
- Normal and lightweight scenes inspected; high/SSAO viewport and PDF capture checked in the development-only `/preview-studio` tool. A missing base render pass found during that check was corrected.
- All three photo calibrations inspected, with full-resolution image download.
- Production service-worker update flow exercised from an existing install. Previously saved furniture and photo state remained usable.
- With the local production origin stopped: route reload, brand/catalog switching, material switching, preset loading, interior rendering, demo-photo loading, PDF download and composite-image download succeeded.
- SQ/EN/DE kitchen proposals, wardrobe, facade and interior covers reviewed. Samples are included here; `proposal-offline-sq.pdf` was exported without the origin server. `proposal-high-en.pdf` exercises the postprocessing capture path.

## Remaining release acceptance

These checks are desktop browser observations, not physical-device certification. Test iPad Air M2 and iPhone 15 in Safari and installed PWA mode before client rollout: multi-touch interruption, camera/upload/native sharing, long-session thermal behavior, approximately 60fps interaction, and the prepared-device ten-second presentation target. The entire brand × viewport × quality × camera matrix was not exhaustively exercised. Offline checks were integrated-release checks rather than separate physical installs after each development phase.

Supplier visuals and dimensions remain illustrative; prices remain demo values. The modern photo is a modern facade entrance, not a claimed villa/client project. Geometry is procedural and not manufacturer-certified hardware.

## Reproduce

Run `pnpm test`, then `pnpm build`, then `pnpm preview --port 4173`. Use the update prompt if an older PWA is installed. The dev-only `/preview-studio` route can regenerate scene thumbnails and PDF samples; it is excluded from production routing.
