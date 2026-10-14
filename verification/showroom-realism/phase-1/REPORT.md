# Phase 1 — physical materials and credible construction

Implemented after explicit authorization on 14 October 2026. Phase 0's uncommitted work was preserved; entry status, hashes and diff are retained in this directory. Only Phase 1 was implemented. No runtime assets were acquired/generated/replaced, no dependencies changed, no deployment or later phase started.

## Completed

- Both catalogs now validate and declare optional physical mapping, bounded PBR response and matching-appearance metadata. Reused maps remain authored/illustrative, including supplier examples. One wood/stone repeat is 120 × 120 cm; smooth data uses 20 × 20 cm. Floor repeats are 120 cm for laminate/concrete and 60 cm for tiles. These are authored presentation scales, not measured supplier sheets or calibrated physical samples.
- Inspected the actual source maps: oak/veneer grain runs along U (horizontal); walnut runs along V (vertical). Doors/carcass sides use vertical grain; drawer fronts and shelves deliberately use horizontal grain. Stable offsets depend on cabinet ID and panel role, never decor ID. Width/height changes scale the geometry UVs rather than stretching a 1 × 1 image across every panel.
- Box faces use their own physical axes; RoundedBox UVs retain arc length. The 1.5 mm front bevel remains, with fewer subdivisions. Geometry UVs carry panel variation; texture transforms remain shared/immutable. R3F decodes sources without drei's redundant eager GPU upload, so only the configured shared variants upload.
- Connected worktop outlines and sink/hob holes remain procedural. Cap UVs share plan coordinates; vertical edges wrap perimeter/depth instead of collapsing to XZ lines. Extrusion depth accounts for the two bevel ends, so the outer thickness is actually the selected 12/20/38 mm tier. Layout clearance and camera bounds use that same thickness.
- Color maps use sRGB; normal/roughness/AO are linear data. Confirmed installed Three 0.180 source: AO texture channel 1 selects `uv1`. Panel/slab geometry explicitly supplies it. No AO asset, cavity bake or new production lighting was added. OpenGL normal orientation is retained.
- Matt lacquer has restrained clearcoat and high roughness; Fenix, acrylic, veneer, laminate, compact, quartz/granite receive deliberate response metadata. Metadata-less older entries keep their previous response. White/graphite stay legible; the controlled highlight makes acrylic's focused reflection clearer than matte's broad response. The existing room environment still produces broad, comparatively subtle reflections.
- Backs are 8 mm and recessed; shelves have setbacks shared with storage measurements. Drawer bottoms, sidewalls, backs and extension fit the available depth. Drawer steel uses one instanced draw per drawer; stationary hinge mounts, runners and shelf pins use one draw per inspected cabinet. Fittings are illustrative, not manufacturer mechanisms.
- Matching plinth/backsplash appearance resolves from the effective front/worktop while the selected catalog record still supplies the price. Plinth dimensions/recess remain unchanged. Existing cabinet IDs, outer dimensions and Design v1/v2 persistence remain unchanged.
- Contact-shadow ownership now also disposes drei's external depth/blur materials and blur-plane geometry. Its previous retained plane was visible as a geometry-counter increase during finish changes.
- Development studio adds isolated inspection shots, transient decor overrides and opt-in neutral/highlight lights. It never writes drafts or A/B records. Each motion sample clears history without replacing the warmed renderer; Reset measurements intentionally remounts it.

Important source: `src/catalog/types.ts`, both `public/brands/*/catalog.json`, `src/scene/materialMapping.ts`, `furnitureMaterials.ts`, `Materials.tsx`, `Primitives.tsx`, `construction.ts`, `Fittings.tsx`, `Worktops.tsx`, `StorageDetails.tsx`, `resources.ts`, `renderInput.ts`; `src/designer3d/Scene.tsx`, `layout.ts`, `framing.ts`, `storage.ts`; development `PreviewStudio.tsx`, `studyDesign.ts`, `RenderMetrics.tsx`.

## Verified

| Check | Result |
| --- | --- |
| Fresh initial baseline | 98 tests and TypeScript passed before Phase 1 changes |
| Final test suite | 110 tests / 13 files passed |
| TypeScript | `pnpm exec tsc --noEmit` passed; build type-check passed |
| Production build | Passed; 4,694,705 shipped bytes / 4,662,559 unique precache bytes, below 9 MB working and strict 10 MB ceiling |
| Map closure | All 23 distinct catalog material paths present in generated precache; all catalog/floor paths remain local |
| Commercial compatibility | Frozen exact SQ/EN/DE line prices/totals, v1/v2 reads, fixed module dimensions/IDs, brand isolation, share/privacy and A/B restoration tests passed for both brands |
| Mapping/construction | Tests cover physical density at 40/60/90 cm and tall heights, grain rotation, stable variation, unchanged vertex positions, rounded density, explicit UV1, nonzero vertical-edge UV area, cap continuity/cutouts, metadata rejection, drawer clearance and tier-aware framing/ceiling rejection |
| Visual/tool evidence | Six before/after pairs, neutral and controlled-highlight finishes, room-lit white/acrylic, final kitchen closed/open, wardrobe interior, lightweight and Druri walnut captures completed |
| Downloads | Metrics JSON includes current study context and temporary A/B report; SQ/EN/DE wardrobe PDFs downloaded, valid PDF signatures and two pages each |
| Resource cycles | 30 oak/walnut/cashmere changes returned to 14 textures; geometry count 74 → 72; no persistent growth in this short check |
| Temporary A/B Canvas | Completed and removed, no A/B record written; estimated combined peak 197.3 MiB |
| Production-only behavior | Development controls excluded from emitted bundles; production studio URL displays Home |
| Current build / offline | Initially encountered old cached entry, applied the offered local update, verified current `/assets/index-DOyQT8Uf.js`; stopped the owned 4173 origin, reloaded wardrobe and navigated kitchen successfully with complete scenes/prices/controls and no logged errors |
| Browser errors | Final default/Druri/production log snapshots empty. Earlier schema hot updates briefly invalidated brand context; reload recovered and fresh-tab checks passed |
| Git whitespace | `git diff --check` passed |

Tests/build/budget/entry evidence and final hashes are stored beside this report. Earlier `kitchen-*-warm-browser.json` and source-upload diagnostic files record intermediate runs; use the `final-*` files for the final implementation. PDF generation/download is verified; a new visual PDF-layout review or native share-sheet test was not performed.

### Browser performance — not physical-tablet measurements

All timings below are @Browser desktop, balanced, Canvas 1225 × 650, DPR 1.5, renderer string “WebKit WebGL.” Ten-second camera samples clear prior motion history; idle gaps are excluded. No GPU execution timer or actual GPU-memory reading is provided.

| Final repeated sample | Closed kitchen | Open kitchen | Wardrobe interior |
| --- | ---: | ---: | ---: |
| Moving samples | 306 | 287 | 236 |
| p50 / p95 | 18.8 / 106.0 ms | 19.6 / 111.6 ms | 27.9 / 133.2 ms |
| Main draws / triangles | 239 / 19,902 | 253 / 22,566 | 110 / 6,646 |
| Settled shadow draws | 224 | 238 | 72 |
| Estimated steady total including framebuffer | 98.9 MiB | 98.9 MiB | 88.2 MiB |

**Repeated p95 fails the proposed 33 ms target.** An earlier fresh closed sample reached 26.1 ms, but subsequent samples were substantially slower; the session does not establish sustained performance. Memoized instance matrices, lower subdivisions and duplicate-upload removal reduce known costs, but the remaining spike source is not established. Do not attribute all timing variation to a particular GPU/driver or claim general tablet readiness.

Draw/triangle and estimated steady/capture memory targets pass. Initial/contact/capture frames still cost 239 main + 448 shadow + 242 offscreen = 929 draws for the closed kitchen, above the proposed 650 total target during that work; the settled frame costs 463. This is inherited contact-depth/shadow work, not a new Phase 3 lighting implementation. Lightweight removes shadow draws and normal/roughness maps (3 uploaded textures in the recorded wardrobe), but sustained lightweight timing was not measured.

Estimates omit decoded CPU images, programs, driver/system allocation and opaque buffers. Two Canvases can double-count shared resources. First complete main pass excludes route/catalog/network loading and is not a cold-load readiness measure. Thirty rapid finish changes do not prove ten-minute stability or thermal performance.

## Visual evidence and reproduction

The six `before-*.webp` / `after-*.webp` pairs use the same fixed study IDs, catalog IDs, heading/eye settings, balanced quality, exposure 0.98 and 1225 × 650 Canvas; exports are 960 × 509. The study addition was installed before “before” capture, without material/construction edits. Framing can move by the corrected few millimetres of worktop bounds.

| Pair | Reproduction |
| --- | --- |
| door40 / door90 | default → japandi → matching shot; front/carcase oak, plinth matching, neutral on, highlight off, fronts closed |
| drawers | same settings → Drawer construction → fronts open |
| worktop | same settings → Connected worktops / edges → marble, fronts open |
| tall | wardrobe-straight → Tall wardrobe doors; front/carcase oak, original preset plinth, neutral on, highlight off, closed |
| shelves | same wardrobe → Shelves and back panel → Interior on |

`highlight-*` are controlled-highlight finish studies, separate from the before/after pairs. Room studies keep neutral/highlight off. Druri walnut verifies that source's different grain orientation. Existing garment protrusions/simplified room props remain Phase 2 issues. The source maps are illustrative; owner visual acceptance and physical sample calibration remain open.

## How to test locally

```sh
cd /Users/ibrahimi/3d_designer
pnpm dev --port 5173 --strictPort
```

Open **http://127.0.0.1:5173/preview-studio?brand=default**. Use the existing server if 5173 is already owned. README contains the bundled Node/pnpm PATH fallback.

1. Choose japandi → 40 cm base door; choose oak front/carcase and matching plinth. Expect vertical grain and a recessed oak plinth. Switch to 90 cm and tall wardrobe shots: grain remains the same physical scale, with different stable cuts per leaf.
2. Change oak → walnut → oak. Expect walnut's vertical source to stay vertical on doors and the original oak cut to return. Cabinet dimensions and IDs remain fixed.
3. Choose Drawer construction; Toggle all fronts. Expect horizontal-grain fronts, fitted bottoms/sides/backs and runners. Choose wardrobe-straight → Shelves and back panel → Toggle interior: expect recessed backs, shelf setbacks and small fittings.
4. Choose 90 cm base; compare lacquer-white/acrylic-white and fenix-anthracite/acrylic-anthracite under Neutral calibration light plus Calibration highlight. Expect broad matte response versus a focused acrylic highlight. Turn calibration off to review the current room lighting. White/graphite remain readable; no customer presentation setting changes.
5. Compare travertine/marble/quartz/granite worktops. Expect 12/38/20/20 mm outer thickness, preserved holes and physically mapped edge detail. Matching backsplash uses the selected worktop.
6. Return Overall fixture, calibration off, balanced; wait for loading, Run 10s motion sample. Expect movement, completion and nonzero p50/p95 samples. Repeat rather than relying on one favourable reading. Reset measurements rebuilds the renderer; it is not a warm-only history reset.
7. Measure A/B peak and Download metrics JSON/thumbnail/PDF SQ/EN/DE. Expect local files and removal of the temporary Canvas. No comparison slot, customer draft or share message is written.
8. Repeat with **brand=druri-design**, then lightweight/high. Expect brand-specific identity and the existing quality differences.
9. Normal app: **http://127.0.0.1:5173/designer/kitchen?brand=default**. Inspect your existing design without replacing it; edits/history/prices/offer/A/B/languages/sharing remain available. Use a disposable design for deliberate edits.
10. Production: `pnpm build && pnpm preview --port 4173 --strictPort`; open **http://127.0.0.1:4173/**. Apply the offered local update if present. Expect no development study controls. Prepare both modules before stopping the origin to reproduce the browser offline check.

## Physical-device protocol — NOT PERFORMED

No physical iPad/Android tablet was available. Touch, thermal/GPU performance, portrait usability, native sharing and installed-PWA restart/update remain unverified.

1. On a trusted LAN run `pnpm dev --host 0.0.0.0 --port 5173 --strictPort`; open `http://<computer-LAN-IP>:5173/preview-studio?brand=default` on the actual tablet. Select Actual physical tablet and enter exact model/OS/browser/orientation/DPR/thermal notes. This run did not expose a LAN server.
2. Reproduce the fixed shots above in landscape and portrait; review normal-size and 2× inspection grain, edges, matte/gloss, drawer clearance and touch interactions. Check both brands and lightweight/balanced.
3. Orbit/open/edit for at least ten minutes and thirty material/layout changes; record repeated warm p95, selection acknowledgement, capture peaks, context loss and hot-device stalls. Compare settled counters after captures. Report failures, including p95 above 33 ms.
4. Verify saved designs, undo/redo, prices/offers, A/B, SQ/EN/DE, PDF and branding on a disposable design. Test sharing up to the native share sheet without sending.
5. Separately prepare a production HTTPS/localhost origin and installed PWA; verify its current entry/update, disconnect network, restart and use both modules/materials/A/B/PDF. Plain LAN HTTP development is not the installed-PWA offline test.

## Remaining issues and next phase

Phase 1 implementation/compatibility checks are complete. Sustained performance acceptance fails in the repeated desktop-browser samples; physical acceptance and owner visual review are open. Review those gaps before expanding the asset/scene cost.

**Phase 2 — furnished rooms and focal models** would add credible room staging and selected appliances/garments with editable procedural furniture retained, fit/fallback rules and an asset/rights budget. It is not authorized or started. The code foundations are ready for that scope, but this is not an unconditional performance go-ahead; resolve/review the timing and physical-device gaps before committing to a heavier room kit.
