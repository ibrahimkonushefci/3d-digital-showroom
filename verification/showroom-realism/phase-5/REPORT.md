# Phase 5 — individually editable wardrobe storage

14 October 2026. Phase 5 implementation complete after explicit confirmation to proceed after Phase 4. Owner visual/touch and physical-device acceptance remain open. Phase 6 is not started. No deployment, purchase, dependency upgrade, Git reset/checkout/commit/push or asset acquisition.

## Scope and preservation

Read the full SHOWROOM_REALISM_PLAN.md, README.md, 3d_designer.md and Phase 0–4 reports. No filesystem AGENTS.md was found in the applicable ancestors/repository; the supplied @Browser-only instruction applied. Incoming dirty work is retained; `entry-status.txt`, `entry.diff` and matching entry/final package/lockfile hashes record the boundary. QA used disposable ports 52747 (development) and 52748 (production), without using the existing 5173 customer-draft origin.

## Completed

- Additive optional `interiorItems`, `interiorPresets` and module `interiorPricing` contracts in both version-1 catalogs. Shelf, rail, drawer and basket rules have translated names, module compatibility, fit ranges, occupied height/clearances, mounting origin/step, material, extension and per-piece prices. Rules are explicitly illustrative. Default uses €24/€18/€85/€55 additions; Druri uses 10% higher interior item rates. Removal credits are zero in the shipped catalogs.
- Design v3 cabinets optionally contain version-1 interior component inventories. Stable IDs, product IDs and heights from the internal floor are stored; dimensions are derived. Limits remain 32 components per cabinet, 512 explicit components per design and 200 cabinets. Existing share-size limits still apply. Full-width editing ships first; dividers/partial spans are rejected and deferred.
- `interiors.ts` resolves absent inventories to deterministic legacy presets without writing a draft. The first edit materializes the same component counts, shelf/rail positions and stable IDs. `storage.ts` is the measurements facade for renderer/population/inspection. Legacy clearances remain; custom free gaps derive from actual occupied components. Supplier capacity/manufacturing fit is not claimed.
- Accessible component and cabinet lists, large Add action, mounting-step up/down, numeric Height + Apply, Replace, Remove, preset selection and explicit Reset to included interior. Interior-view taps select the individual shelf/rail/drawer/basket without opening the parent front or moving the camera. Drawers/baskets open independently. Clothing visibility is transient and never changes inventory/price.
- Fit rejects panel bounds, item size incompatibility, overlaps/clearances, rail hanging-space conflicts, unsupported sliding-front pull-outs, swept pull-out conflicts, unknown products, invalid mounting positions and component limits. Failed edits retain the previous design, price and history. Compatible components survive resizing; incompatible shrinking is rejected. Legacy positions at supported prior whole-centimetre heights remain accepted while new moves snap to the catalog grid.
- Layout/room regeneration warns in the page before replacing custom interiors, with Cancel and Rebuild actions. The candidate is prepared without committing; confirming commits one history entry, and Undo restores the inventory/price. The pending candidate is discarded if the active design changes. The first native-dialog implementation blocked browser automation and was replaced with this tested in-page interaction.
- Transient component selection/open state reconciles on history, removal and cabinet replacement/deletion, and does not enter drafts, sharing or A/B. The original cabinet front controls remain available. Repeated fittings/basket wire geometry use the shared instancing/resources; moving components cast dynamic shadows. Stationary shelf positions drive cavity contrast. Decorative contents use the current geometry and omit items that no longer fit, allowing contact with a supporting shelf.
- Pricing adds only quantity differences from the included preset, using item rates or explicit module addition overrides. Moving is free; unchanged presets have zero adjustment. Removal credits require explicit catalog rates and are bounded by the included allowance. Covered module accessories do not get a second interior surcharge. Existing accessory charges stay separate. Signed credit lines retain quantity × signed unit price = amount; discount → installation → VAT remains unchanged.
- Summary, A/B cards/details and PDFs show resolved storage inventory, cabinet positions and heights. A/B thumbnails retain the closed overall policy; cards now show storage counts because closed-front images alone cannot reveal shelf differences. Catalog/render signatures include the interior revision. Draft/share/A/B validation uses the same fit rules. Private offer/customer fields and transient state stay excluded; restoring A/B retains the active offer.
- Development-only Custom wardrobe storage study extends the existing profiler. It has fixed IDs, a moved shelf and basket and does not load/save drafts. Production excludes the study/profiler.

Important files: `src/catalog/types.ts`; both brand catalogs; `src/designer3d/interiors.ts`, `interiorValidation.ts`, `InteriorEditor.tsx`, `useInteriorInteraction.ts`, `storage.ts`, `store.ts`, `Designer.tsx`, `Scene.tsx`, `layout.ts`, `comparison.ts`; `src/scene/InteriorComponents.tsx`, `renderInput.ts`, `rooms/WardrobePopulation.tsx`; `src/pricing/index.ts`; document finishes/offer, Summary/Compare, SQ/EN/DE translations, minimal storage-control CSS, development study files, `tests/interiors.test.ts`, `tests/interior-pdf.test.ts`, README and project brief.

## Verification

- **159 tests in 20 files passed**, TypeScript passed, fresh production build passed, unchanged budget and asset/precache dependency closure passed, Git whitespace check passed. All pre-existing tests remain passing, including frozen exact line prices/totals for five legacy fixtures, both brands and SQ/EN/DE. New tests cover fit rejection, mounting, resize retention, item deltas/credits, included-price parity, history/transient reconciliation, migration, array/identity limits, persistence/privacy, sharing, A/B and multilingual PDF generation. Logs: `tests.txt`, `typescript.txt`, `build.txt`, `budget.json`, `scene-assets.json`.
- Final shipped **5,874,382 bytes**; unique precache **5,835,106 bytes**, **122 URLs**. Targets remain 9 MB and strict <10 MB. Original 15-model/30-variant kit remains 980,308 bytes; package/lock hashes are unchanged.
- Production @Browser: initial straight wardrobe €1,973; shelf 70.9 → 72 cm leaves that total and siblings unchanged. A basket adds €55 goods and produces €2,043 after installation/VAT. Overlap at 140 cm is rejected. Raycast shelf selection, rail replacement/removal, one independently opened drawer/basket, Undo/Redo and A/B captures/restoration were observed. A/B shows €2,043 with basket versus €1,973 without. Druri's basket rate is €60.50 and the displayed total €2,050; reload retains its separate inventory. Both brands' kitchens remain €4,768 in the offline browser check.
- Incompatible 230 → 180 cm custom shrinking retains the last valid state and reports bounds. Explicit reset permits 180 cm; first-edit shelves become 54.9/108.9/144.9 cm. A subsequent move and growth retain compatible components; Undo restores the original custom basket state. Sliding full-width pull-outs receive the specific access explanation. Corner and walk-in rebuilds were confirmed through the new warning; Cancel and one-step Undo retain/restore the custom straight wardrobe. See `production-*.txt`.
- Both brand Summaries were checked in SQ/EN/DE with matching inventory and totals. The copied default custom-storage link reopened in a fresh tab with shelf 72 cm, basket and €2,043; no message/native share was sent. Unit tests separately verify private-field exclusions and all brand round trips.
- Six formatting PDFs (2 brands × 3 languages) use an explicit test-only €10 shelf-removal credit; shipped catalogs still have zero credits. All 18 pages were rendered, word bounds checked, the overview and a full German detail page visually inspected. The test catalogs/designs are retained beside the PDFs, so their €2,030/€2,037 totals must not be confused with live catalogs. These fixtures use the image-unavailable fallback. The actual browser offer `browser-live-default-wardrobe-en.pdf` has the closed room image, company logo, inventory, €55 basket line and €2,043 total; cover/inventory pages were rendered and visually inspected. The browser download call took about five minutes; this is tool-mediated download latency, not a measured app render time. No final offline PDF download/native share test was performed.
- Final loaded production entry **`assets/index-MBELNNjw.js`** matches dist and shows Offline ready (`production-final-entry.json`). After stopping only the owned preview origin, cached reload could move a custom shelf and Undo without changing €2,043. Both full rooms/brands loaded with their saved state, and cached default A/B restored the basket configuration. See `offline-*.txt/.jpg`. The preview was then restarted. This is stopped-origin browser-cache evidence; active-worker hash, installed-device restart/update and real network-offline hardware are not independently verified. Final sampled warning/error logs are empty.
- Requested 1180×820, 1024×768, 820×1180 and 390×844 overrides all continued reporting **1280×720**. A fresh-tab 1024×768 retry also remained 1280×720; override was reset. Requested-size images are labelled with their actual size. No horizontal overflow was observed at 1280×720, but exact tablet/portrait/phone acceptance is **not verified in this phase**. Phase 4 historical responsive results do not prove the new controls.

### Representative desktop cost

Balanced @Browser, wardrobe-straight fixed fixture, Interior view, Canvas 1225×650, DPR 1.5, ten-second motion samples. Desktop intervals and resource estimates are not physical GPU measurements.

| Sample | Main draws | p95 / maximum | Estimated steady |
| --- | ---: | ---: | ---: |
| Legacy inventory | 84 | 21.6 / 32.8 ms | 70.9 MiB |
| Custom inventory, moved shelf + basket | 85 | 21.8 / 34.4 ms | 70.1 MiB |

Sources: `metrics-legacy-interior.json`, `metrics-custom-interior.json`. Estimated temporary closed A/B combined peak **139.3 MiB**, with extra Canvas removed (`metrics-capture-peak.json`). Samples were taken after the final storage renderer/population corrections and before the last warning-only UI change. These short representative checks meet draw/estimated memory and p95 targets, but include a >33 ms individual frame. They do not erase Phase 3's earlier 139/187 ms spikes, prove ten-minute stability, or cover every mixed/large inventory.

## Exact startup and tests

Development is left running on 52747; production was restarted on 52748. If stopped:

```sh
cd /Users/ibrahimi/3d_designer
pnpm dev --port 52747 --strictPort
```

Development: http://127.0.0.1:52747/designer/wardrobe?brand=default
Studio: http://127.0.0.1:52747/preview-studio?brand=default

Production:

```sh
cd /Users/ibrahimi/3d_designer
pnpm build
pnpm preview --port 52748 --strictPort
```

- http://127.0.0.1:52748/designer/wardrobe?brand=default
- http://127.0.0.1:52748/designer/wardrobe?brand=druri-design
- http://127.0.0.1:52748/designer/kitchen?brand=default
- http://127.0.0.1:52748/designer/kitchen?brand=druri-design

These origins contain disposable QA drafts/A/B slots; selecting a Home preset explicitly replaces the current draft. README has the Node/pnpm PATH fallback.

1. Select English; on a disposable draft choose Home → Straight wardrobe. Expect 4 modules, 360×300×270 cm and €1,973 in the default sample catalog.
2. Storage & Lighting → 2 · Shelved wardrobe · 80 cm. Interior view opens. Choose 1 · Shelf · 70.9 cm, then Move up: expect 72 cm, siblings 139.9/185.9 unchanged, and no price adjustment. Tap the shelf in the scene: it selects without toggling fronts or flying the camera.
3. Enter Height 140 and Apply: expect overlap rejection, retained shelf/price/history. Select Pull-out basket as Interior product, then Add: expect basket at 0 cm, €55 goods adjustment, €2,043 total. Open this component only: expect independent movement. Decoration off removes only clothes/contents.
4. Choose cabinet 1 and its rail. Replace it with Shelf, or Remove it: expect only its inventory to change; removal of an included rail gives zero credit in these catalogs. Undo restores rail and total. Choose cabinet 3 → middle drawer → Open this component only: siblings remain closed unless you deliberately used Open all fronts.
5. Undo/Redo additions/removal and reload: expect inventory, stable selection where applicable, and quote to agree. Save A with basket; remove basket and Save B. Compare shows counts, details and €2,043 / €1,973 with closed overall thumbnails. Choose A restores its inventory while preserving offer/customer details. Copy link to a fresh tab and inspect the same storage; no sending is required.
6. Edit modules → select the customized shelved cabinet → Height 180. Expect bounds rejection retaining 230 cm. Reset to included interior then repeat: expect compatible 180 cm shelves. Materialize a move and grow again; compatible components remain. Use Undo to restore the original. Resizing never silently discards a priced basket.
7. Room & Layout → Corner or Walk-in. Expect the visible replacement warning before committing. Cancel retains everything. Rebuild replaces custom interiors in one undoable step. Sliding cabinet → Add basket/drawer is rejected with the full-width access explanation. Test narrow catalog widths and current presets separately.
8. Your offer → inventory, position/height labels, basket delta and total. Repeat SQ/EN/DE and Druri, download and visually inspect all PDF pages. Existing Phase 4 finishes/overrides, matching materials, kitchen worktops/lighting, dimensions, legacy prices, accessories, branding, privacy and discount → installation → VAT must remain consistent.
9. For offline: visit both modules/brands, apply any Save and update, wait for Offline ready, stop only your preview terminal (Ctrl-C), reload and edit/Undo/custom A/B locally. Development mode does not prove offline support. Separately rehearse installed HTTPS PWA restart/update and PDF/native-share flow on actual hardware.
10. Studio → Scene wardrobe-straight → Custom wardrobe storage → Toggle interior, balanced → warmed Run 10s motion sample, then Measure A/B peak. Repeat on actual meeting devices; record model/OS/browser, input response and sustained/thermal results.

Checks: `pnpm test`; `pnpm exec tsc --noEmit`; `pnpm build`; `pnpm check:budget`; `node scripts/check-scene-assets.mjs dist`; `git diff --check`.

## Remaining limits and next task

No known failing automated Phase 5 check remains. Owner review of edited geometry/control wording, real touch/keyboard use, exact landscape/portrait/phone layouts and all offer pages remains required. No physical iPad/Android, sustained thermal/GPU/leak, cold 10 Mbps loading, installed-PWA restart/update, native sharing or final offline PDF download was performed. Earlier performance spikes remain outstanding. Long/maximum inventories can exceed existing URL limits and receive feedback.

Storage is full-width and illustrative. Full-width drawers/baskets behind sliding fronts are conservatively blocked; partial spans/dividers and dragging are deferred. The existing drawer-front module retains its lower drawer bay; repositioned drawers there must remain within that illustrative bay. Actual supplier mounting/clearance/extension/access rules, prices, credits and material calibration need business approval before supplier-authentic offers. No catalog-backed capacity/manufacturing claim is made. Closed A/B/PDF images intentionally hide interior details; inventory text describes the saved configuration.

Stop after Phase 5. **Next task: owner review of these storage edits and gaps, then separately authorized Phase 6 only — camera/touch polish, complete sales integration and physical-device/offline release validation.** Phase 6 is not implemented or implicitly authorized.
