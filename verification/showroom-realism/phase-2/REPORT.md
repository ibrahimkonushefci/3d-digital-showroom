# Phase 2 — furnished rooms and focal models

14 October 2026. Phase 2 implementation complete; visual/device acceptance remains conditional below. Phase 3 was not started. No deployment, asset purchase or dependency upgrade.

## Scope and preservation

Read the full SHOWROOM_REALISM_PLAN.md, README.md, 3d_designer.md and Phase 1 report. Checked current code, HEAD 5860343 and dirty tree before implementation. No filesystem AGENTS.md was found in the applicable ancestry/repository; the supplied @Browser-only instructions applied. `entry-status.txt` and `entry.diff` preserve the incoming tracked-change inventory. Phase 0/1 and unrelated edits were retained; no reset, commit or checkout operation occurred. Existing design schema/storage versions remain unchanged.

## Completed

- Typed, validated kitchen/wardrobe recipes and adaptive room shell, window reveals, skirting and physically mapped floor. Explicit presentation presets gain actual staged openings; customer designs with solid walls are not silently assigned a window.
- Original metre-scale local GLBs for oven/fridge fronts, tap, stools, ceiling-attached pendants, bench, ceramics, three garment silhouettes, folded textiles, shoes and boxes. Fifteen models, thirty high/low files, 980,308 bytes total. Source generator, hashes, dimensions, anchors, bounds, material slots and project-use permission are recorded. No acquired assets or remote runtime assets.
- Kitchen L countertop staging and island stools/pendants; wardrobe bench/rug only where free space permits. Decorative props follow conservative cabinet/opening/door/drawer clearance tests and are omitted for unsupported room sizes/large designs rather than moving furniture.
- Clothes follow actual rails; folded clothes/boxes/shoes fit actual shelf clearances. Enclosed contents are hidden only after closing completes and reappear during opening or Interior view. They are decorative, not quoted inventory; no Phase 5 storage editor was introduced.
- Fixed appliance slot checks retain procedural fallbacks for incompatible dimensions. Isolated model failures retain the complete room. Reference-counted decoded resources, per-instance transforms and instanced repeated geometry avoid mutating shared materials.
- Reviewed Phase 1 spikes before adding cost. Batched carcass panels and handle parts, culled opaque closed interiors, and reduced existing contact-shadow work to one settled pass without a duplicate directional shadow render. Phase 1 material UV/AO roles and actual editable geometry remain in use. Contact floor/asset origins were aligned to prevent floating feet.
- Capture waits for model/contact readiness, and comparison signatures include the model revision. Offline readiness checks the complete model/recipe dependency set and requires a controlling worker; first install provides Finish setup, and updates preserve drafts.

Important files: `src/scene/rooms/`, `src/scene/assets/`, `src/scene/Appliances.tsx`, `src/scene/CabinetShell.tsx`, `src/scene/InspectionContents.tsx`, `src/scene/Fittings.tsx`, `src/scene/Rendering.tsx`, `src/scene/renderInput.ts`, `src/pwa/Status.tsx`, `src/designer3d/presets.ts`, `src/designer3d/comparison.ts`, both brand catalogs, `public/shared/rooms/`, `public/shared/models/`, `public/shared/asset-manifest.json`, `public/shared/ASSETS.md`, `public/shared/licenses/`, `scripts/author-room-kit.mjs`, `scripts/check-scene-assets.mjs`, and new placement/manifest/carcass tests. README and project brief describe the Phase 2 stop gate.

## Verification

- Entry baseline: 110 tests and TypeScript passed. Final: **119 tests across 16 files**, TypeScript, production build and whitespace checks passed. Compatibility fixtures preserve normalized furniture state and exact prices in SQ/EN/DE; only explicitly authored preset openings differ.
- Final shipped **5,804,157 bytes**; unique precache **5,765,230 bytes**, 120 URLs. Below the unchanged 9 MB working target and strict <10 MB ceiling. Models pass per-file <1 MB and kit <2.5 MB limits. Binary/hash/license validation and complete precache dependency closure pass. Logs: `tests.txt`, `typescript.txt`, `build.txt`, `budget.json`, `scene-assets.json`.
- @Browser inspected L/island kitchens and straight/corner wardrobe presentations, opening fronts/Interior view, both quality variants and forced missing-model recovery. No device was emulated or physically tested. Final hero images are `final-kitchen.jpg` and `final-wardrobe-current.jpg`; island and fallback images are supplementary, earlier in the same implementation session.
- Production QA used a disposable localhost:52743 origin. Cashmere L: 420×360×270 cm, 15 modules, €4,768. Resize to 440 cm rebuilt 19 modules/€5,490; Undo restored the original. Saved A/B persisted across reload, German comparison rendered both furnished thumbnails and prices (€4,768 / €4,934), restore A worked. Branded offer itemization matched the restored total. PDF download UI completed without a browser error, but a new exported PDF file was not retrieved/visually audited. Share/send buttons were not invoked.
- First-install Finish setup reached Offline ready. Final Save and update loaded `assets/index-HrJmNHu1.js`, retained the saved draft, and reached Offline ready. Then the owned origin server was stopped. Cached reload/navigation rendered kitchen and wardrobe Interior view with all local assets, and retained €4,768 kitchen state. `production-updated-entry.json`, `production-offline-*.json/.jpg` record this. Checked final production warning/error logs were empty. This is browser cache evidence, not installed-tablet offline acceptance or independently measured active-worker hash.

### Before/after measurements

@Browser desktop, balanced, main Canvas 975×650 at DPR 1.5, approximately ten seconds of scripted motion per saved sample. Draw counts separate main/shadow/contact work. Memory is an estimate, not system GPU allocation.

| Scene/sample | Main draws | p95 interval | Maximum interval |
| --- | ---: | ---: | ---: |
| Entry kitchen L | 239 | 24.3 ms | 50.2 ms |
| Final kitchen L, current source | 132 | 22.5 ms | 41.6 ms |
| Entry wardrobe interior | 110 | 20.7 ms | see baseline JSON |
| Final wardrobe interior, current source | 83 | 20.1 ms | 25.7 ms |
| Optimized island closed | 191 | 25.0 ms | 45.7 ms |
| Optimized island open | 292 | 31.8 ms | 47.3 ms |

The island measurements precede the final small slot/floor-origin corrections; final L and wardrobe samples follow them. Repeated L samples varied from 20.8–32 ms p95, so there is no claim that every spike is resolved. Current L contact-frame peak: 324 total draws versus entry 929; wardrobe interior peak 189. Island open peak 763, within the plan's 1,000 open total-draw target. Current estimated steady memory about 96–97 MiB. Final wardrobe A/B temporary capture peak **194.5 MiB**, below the 256 MiB estimate target; temporary Canvas removed afterwards (one visible Canvas remained). Source: `before-*.json`, `final-kitchen-balanced-current.json`, `final-wardrobe-interior-current.json`, `final-wardrobe-capture-current.json`, `final-island-*.json`.

### Unverified acceptance

Physical iPad/Android touch, sustained ten-minute motion/thermal performance, true GPU memory/leaks, portrait/phone responsive acceptance, native sharing, installed PWA, cold 10 Mbps loading and supplier material calibration remain unverified. The attempted 1024×768 override still reported 1280×720; it was reset and **exact 1024×768 was not verified**. Owner visual approval is still required. Lighting/environment remain the Phase 1 setup pending Phase 3.

## Run and test

Development server is left running at 127.0.0.1:5173. To start it when stopped:

```sh
cd /Users/ibrahimi/3d_designer
pnpm dev --port 5173 --strictPort
```

App: http://127.0.0.1:5173/designer/kitchen?brand=default
Inspection studio: http://127.0.0.1:5173/preview-studio?brand=default

1. In the studio choose `japandi`, Models `Original room kit`, Quality `balanced`. Expect fitted oven/fridge/tap, restrained ceramics, staged window and the actual cashmere L modules.
2. Choose `classic`. Expect the actual island design with two stools/pendants where clearance permits. Open all fronts: drawers/doors reveal real geometry; stools do not move cabinets.
3. Choose `wardrobe-straight`, then Toggle interior. Expect varied volumetric garments, boxes, folds and shoes following rails/shelves, plus a bench/rug where free. Choose `wardrobe` to inspect the corner adaptation. Toggle back: fronts and closed-content culling work.
4. Switch Models to the missing-model option. Expect procedural fallback and a usable Canvas. Restore Original room kit; detailed models return. Switch quality to lightweight and back; models retain their physical size.
5. Run 10s motion sample, then Measure A/B peak. Expect populated browser-only metrics and a finished capture with the temporary Canvas removed. Repeat on the actual meeting tablet for at least ten minutes; record hardware/OS and any spikes.
6. In the app use a disposable design: change finish and Room & Layout dimensions, Apply, then Undo. Expect real modules/layout and price to update coherently, and Undo to restore them. Reload: the draft persists. Save A/B with distinct names/finishes; Compare should show matching furnished images/prices.
7. Switch SQ/EN/DE and `?brand=druri-design`. Expect correct language/company identity and corresponding offer. Download a PDF and inspect its image/itemization/total. Test sharing separately on the intended device without sending to customers during QA.
8. For production offline QA run `pnpm build && pnpm preview --port 4173 --strictPort`, open http://127.0.0.1:4173/, use Finish setup or Save and update when shown, visit both designers and wait for Offline ready. Stop that preview with Ctrl-C and reload/navigate both scenes: expect cached models and saved state. Dev mode is not proof of offline support.

Re-run checks: `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm build`, `node scripts/check-scene-assets.mjs dist`, `pnpm check:budget`.

## Remaining issues and next phase

The legacy Phase 1 severe spikes were not reproduced consistently and their complete cause is unresolved; shorter browser samples improved, but individual kitchen/island frames still reached roughly 40–48 ms. No sustained/physical performance gate passed. Exact tablet-sized/portrait visual acceptance and new PDF visual review remain open. Conservative staging may omit props when dimensions or clearance do not allow them; fixed-size appliances use fallbacks instead of stretching.

Next is **Phase 3: room lighting, reflections and interior depth**. The Phase 2 code/asset/budget foundation is ready for that work, subject to owner visual review and the outstanding physical performance checks. No Phase 3 work has started, and there is no release-ready/tablet-ready claim. Stop here.
