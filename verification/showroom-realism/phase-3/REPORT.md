# Phase 3 — room lighting, reflections and interior depth

14 October 2026. Phase 3 implementation complete and ready for owner review. Physical-device/release acceptance is still open. Phase 4 was not started. No deployment, dependency upgrade, asset acquisition or purchase.

## Scope and preservation

Read the full SHOWROOM_REALISM_PLAN.md, README.md, 3d_designer.md, Phase 1 report and Phase 2 report. No filesystem AGENTS.md was found in the repository/applicable ancestry; the supplied @Browser-only instructions applied. Current HEAD is 5860343e94efcb6ee94e774144e63748cdc3fb74 on main. The incoming dirty Phase 0/1/2 work was preserved; entry tracked diff/status and dependency hashes are saved here. No reset, checkout, commit, merge or push occurred.

Design/schema/storage versions and commercial rules remain unchanged. Old public v1 recipes are retained; new lighting data lives at versioned v2 paths. Existing stored rooms retain their actual openings, including solid walls. No decorative or lighting charge was added.

## Completed

- `src/scene/lighting/lightingRecipe.ts` resolves the key through the largest actual window aperture in centred metre coordinates. Solid rooms use an overhead presentation key without inventing a window. Shadow bounds include furniture and relevant room geometry. `RoomLighting.tsx` uses one shadow caster, restrained hemispheric fill, 1024 balanced / 2048 high maps and explicit map resizing/disposal.
- `ShadowShell.tsx` batches independent aperture-preserving walls with no camera color or depth writes. Visible RoomShell walls still cut away. Installed Three r180 uses the main camera layers for shadow traversal, so layer-only hiding would have lost these shadows. Contact-depth work excludes the shadow shell. Main camera views remain usable without an opaque hidden wall blocking them. Final review also moved exact window reveals/mullions and closed architectural-door casters into this shell, so their shadows survive cutaways. Visible copies no longer cast duplicate shadows; the window fitting dimensions are shared by both paths.
- `RoomEnvironment.tsx` authors low-resolution room radiance locally. A 64 px fallback precedes one debounced 128 px refresh after loading or room/furniture structure changes. It borrows only static decor geometry and uses isolated non-reflective materials, with no furniture/environment self-feedback. Finish changes, door animation and orbit do not schedule probes. A synchronous refresh over 50 ms uses the fallback and suppresses further runtime attempts for that renderer; loading/background timeout is bounded. Targets and temporary materials/geometry are owned/disposed. Performance mode and large designs retain the authored fallback.
- `InteriorOcclusion.tsx` applies restrained contact/rear-cavity contrast to indirect diffuse/specular response. It derives from the actual stationary shell/shelves and recomputes for structural changes. Exterior faces and moving fronts/drawer bodies are excluded; their shadows remain dynamic. No dark base-color paint or closed-door shadow is baked into the open compartment. Lightweight keeps this inexpensive contrast.
- `RunLights.tsx` combines kitchen and wardrobe LED runs under a three-fill cap. Wardrobe no longer adds a point light per cabinet. Visible configured strips and their existing pricing semantics remain supported.
- Shared Scene/Rendering integration covers the app and export/capture. Capture waits for the bounded reflection readiness state. A lighting revision invalidates A/B images without migrating/replacing their furniture. Development-only controls expose fixture windows/solid rooms, all three camera presets, LED fills, reflection fallback, quality and metrics. A context-boundary issue with the development fallback selector was found and fixed; explicit authored mode was subsequently verified with zero runtime refreshes.

Important integration files: `src/designer3d/Scene.tsx`, `comparison.ts`, `src/scene/Rendering.tsx`, `Materials.tsx`, `Primitives.tsx`, `CabinetShell.tsx`, `RunLights.tsx`, `quality.ts`, `resources.ts`, `RenderMetrics.tsx`, `metrics.ts`, `src/app/PreviewStudio.tsx`, `src/scene/rooms/`, `src/scene/assets/manifest.ts`, `public/shared/rooms/*-warm-v2.json`, `scripts/check-scene-assets.mjs` and `tests/room-lighting.test.ts`. README, project brief and asset notes were updated.

Optional prepared-room lightmaps, full-screen AO/composer, bloom/SSR, exact mirrors and refractive glass were not needed for this implementation. There is no added external/runtime asset or dependency.

## Checks

- Entry suite: 119 tests; TypeScript passed. Final suite: **125 tests across 17 files**. TypeScript, production build, budget, scene asset/precache closure and Git whitespace checks passed. Frozen compatibility tests preserve both brands' exact legacy prices, furniture identity/dimensions, v1/v2 reads, languages, offer ordering, sharing/privacy and A/B restoration. New tests cover key rays through all window orientations, real/overlapping apertures, room shadow bounds, independent window/door casters, structural-only probe signatures, bounded cavity response and capped LED runs on a 200-cabinet schema stress case.
- Shipped **5,816,037 bytes**; unique precache **5,776,757 bytes**, **122 URLs**. Below the unchanged 9 MB working target and strict <10 MB ceiling. Original models remain 980,308 bytes, 15 models / 30 variants; hashes/licenses and complete local dependencies pass. Package/lock hashes are unchanged. Logs: `tests.txt`, `typescript.txt`, `build.txt`, `budget.json`, `scene-assets.json`.
- @Browser inspected kitchen, island, wardrobe, open fronts/drawers, LEDs-off cavities, solid-room lighting, all three camera presets, lightweight/high, authored fallback and live reflection direction changes. A Druri Design wardrobe interior also rendered with the shared lights and LEDs off; its brand-specific fixture/identity were retained. Final images and metrics are in this directory. Interim images/reports can contain transition states; use files explicitly identified below for final comparisons.
- Browser viewport override worked this time. Actual 1180×820, 1024×768, 820×1180 and 390×844 production checks had no horizontal document overflow. Screenshots and `responsive.json` record dimensions. This is desktop responsive evidence, not physical-device touch or thermal performance.
- Production QA used disposable localhost:52744. Cashmere L stayed 420×360×270 cm, 15 modules, €4,768. Resize to 440 cm produced 19 modules; Undo restored 420 cm / 15 modules / €4,768. A/B saved distinct named cashmere/anthracite closed images while the live scene had open fronts; both prices were €4,768, correctly reflecting identical catalog multipliers. Choosing A restored the design. Switching English/German and reloading preserved state. No share/send button was invoked.
- Finish setup reached Offline ready. Save and update loaded final `assets/index-8o4oLYtf.js` and preserved the draft. The owned origin was stopped; cached reload and navigation rendered both rooms, including wardrobe Interior view and its model population. Offline logs were empty. `production-entry.json`, build hashes and `production-final-offline-*.txt/.jpg` record the final build; earlier `production-offline-*` files are intermediate evidence. This is browser-cache evidence; an independently measured active-worker hash and installed-tablet restart/update were not verified.
- A/B temporary capture completed and removed its extra Canvas; estimated combined peak **142.3 MiB** before the final small frame-shadow geometry fix. The final production update also refreshed saved comparison images through the new lighting revision. Thumbnail capture/download completed and `capture-top.webp` retains a settled Top-view export. The browser download call was unusually slow; this does not establish a slow app render. No new PDF layout/native-share audit was performed.

## Desktop measurements and limits

Balanced @Browser desktop, fixed fixture IDs, exposure 0.98 and approximately 10-second motion samples. Final Canvas 1225×650, DPR 1.5. Main/shadow/contact work is counted separately; CPU intervals/submission and memory estimates are not actual GPU execution/allocation measurements.

| Scene/sample | Main draws | p95 | Maximum interval |
| --- | ---: | ---: | ---: |
| Entry kitchen closed | 132 | 25.0 ms | 39.1 ms |
| Final kitchen closed | 133 | 24.4 ms | 44.6 ms |
| Final kitchen open | 204 | 22.6 ms | 41.8 ms |
| Wardrobe interior, first sample | 80 | 21.2 ms | 139.3 ms |
| Wardrobe interior, warmed repeat | 80 | 18.7 ms | 31.1 ms |
| Island open, first sample | 293 | 23.4 ms | 187.1 ms |
| Island open, warmed repeat | 293 | 22.9 ms | 44.9 ms |

Sources: `before-kitchen.json`, `final-kitchen-closed-balanced.json`, `final-kitchen-balanced.json` (open), `wardrobe-interior-balanced.json`, `wardrobe-interior-warm-repeat.json`, `final-island-open-balanced.json`, `final-island-open-warm-repeat.json`. The entry Canvas was 1210×650, so entry/final measurements/images are not pixel-matched acceptance pairs. The fixed designs/quality/exposure are shared. No quantitative visual-improvement score is asserted.

The table above predates the final small frame-shadow fix. The final Druri wardrobe interior recheck (`final-frame-shell-wardrobe.json`) measured 80 main / 59 shadow draws, 21.5 ms p95 / 31.7 ms maximum, and about 70.9 MiB estimated steady memory. `final-frame-shell-exterior.jpg` verifies an exterior cutaway with preserved window shadows. The final Druri kitchen recheck (`final-frame-shell-kitchen.json`) measured 133 main / 110 shadow draws, 20.2 ms p95 / 39.1 ms maximum and about 71.5 MiB estimated steady memory. Main draw/triangle targets and estimated memory budgets pass in these representative samples. Final steady estimates are about 70–71.5 MiB; lightweight wardrobe about 18.9 MiB. Open island peak 765 total draws is below the 1,000 open target. Observed synchronous runtime refreshes were about 8–22.4 ms; these are CPU timings, not GPU execution times. Probe refresh count stays one through warmed orbit/opening samples. Authored fallback verification records zero runtime refreshes.

**Short-sample p95 passing does not erase the 139/187 ms first-sample spikes or establish sustained performance.** Startup/material/shader work was included when samples began around scene changes; the complete cause of the spikes is not isolated. There is no physical ten-minute/thermal test, cold 10 Mbps test, actual GPU-memory measurement or leak guarantee. Background/concurrent browser work can also influence desktop intervals. Do not call the demo tablet-ready based on these results.

## How to test

The development server is left running at 127.0.0.1:5173. If stopped:

```sh
cd /Users/ibrahimi/3d_designer
pnpm dev --port 5173 --strictPort
```

App: http://127.0.0.1:5173/designer/kitchen?brand=default
Studio: http://127.0.0.1:5173/preview-studio?brand=default

1. Studio: select japandi, Overall fixture, balanced, Original room kit, Actual fixture opening, Room probe with authored fallback, calibration off. Wait for assets/reflection readiness. Expect the editable L kitchen, room-aligned light and restrained metal/gloss reflections. Existing customer drafts are never loaded or saved by the studio.
2. Choose Camera Front, Top, then Perspective / fixture; wait for camera movement to settle. Expect the room to remain consistently lit as visible walls cut away, with no opaque shadow-only wall blocking the camera.
3. Toggle all fronts and inspect Drawer construction. Expect real moving fronts/bodies, responsive shadows, readable back/shelf depth and no fixed closed-front shadow ghosts. Return Overall fixture.
4. Choose wardrobe-straight, Toggle interior, uncheck LED fills. Expect darker back/corner/shelf contact while clothes, shelves and hardware remain readable. Compare lightweight/balanced/high. Lightweight has no dynamic shadow pass and uses the authored reflection fallback, retaining cavity contrast.
5. Reflections → Authored fallback only. Expect a usable scene and metrics showing authored / explicit-authored / zero runtime refreshes. Restore Room probe with authored fallback. Window study → Solid walls shows overhead presentation lighting with no fake window. Other study window positions intentionally test direction and can intersect furniture; they are not committed customer layouts.
6. Compare fenix-anthracite with acrylic-anthracite, and white with acrylic-white under fixed room lighting. Expect readable dark faces and different broad/focused reflections rather than uniformly white gloss. Return the approved fixture finishes.
7. Run repeated warmed 10s samples and Measure A/B peak. Expect populated metrics and temporary Canvas removal. Repeat on the actual iPad/Android meeting devices for at least ten minutes, recording model/OS/browser, thermal state, input response and spikes. Do not substitute these desktop results.
8. Normal app: use a disposable design for finish/room edits; test Undo, reload, A/B, SQ/EN/DE, PDF and sharing up to the share sheet without sending. Lighting alone must not change furniture prices, IDs, dimensions, layouts, quote ordering or stored offer details. Repeat with `brand=druri-design`.
9. Production/offline: `pnpm build`, then `pnpm preview --port 4173 --strictPort`. Open http://127.0.0.1:4173/ and prepare both rooms; finish setup/update if offered, wait for Offline ready, then stop that owned preview with Ctrl-C and reload/navigate both rooms. Development mode does not prove offline support.

Re-run checks: `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm build`, `pnpm check:budget`, `node scripts/check-scene-assets.mjs dist`, `git diff --check`.

## Remaining issues and next step

Owner visual approval is required at this Phase 3 milestone: confirm light direction, white/black/matte/gloss readability, interior depth and the intended warm-room presentation at normal tablet distance and 2× inspection. Reflections remain rough room-brightness approximations, not exact mirrors. Materials remain illustrative/supplier calibration is unverified.

Physical iPad/Android touch, sustained/thermal performance, true GPU memory/leaks, cold loading, installed-PWA restart/update, native sharing and a new PDF visual audit remain open. The first-sample spikes require review on the actual weakest meeting device; no release-ready claim is made.

**Stop after Phase 3.** Review these visuals and performance gaps, and make Phase 3 fixes if needed before authorizing Phase 4. Phase 4 independent finish zones, migrations and accurate sales output are not implemented or automatically authorized.
