# Showroom realism — Phase 6 / laptop review point

14 October 2026. **Phase 6 implementation only**, explicitly authorized after Phase 5. The owner clarified during this run that the first presentation will use a laptop and no iPad/Android tablet is currently available. Laptop rehearsal and owner visual acceptance are the next review gate; this report does not certify tablet or supplier/manufacturing readiness. No deployment, purchase, acquired asset, dependency upgrade or Git handoff.

## Scope and preservation

Read SHOWROOM_REALISM_PLAN.md fully, README.md, 3d_designer.md, Phase 0 baseline and Phase 1–5 reports. No filesystem AGENTS.md was found in the repository or applicable ancestor paths. The supplied built-in **@Browser only** instruction applied throughout. Incoming Phase 0–5 dirty work was retained; `phase-6/entry.diff`, `entry-status.txt` and entry/final dependency hashes record the boundary. No reset, checkout, commit, merge or push occurred. Deliberate QA used disposable origins 52749 (development) and 52750 (production), preserving the other origins' drafts.

## Completed in plain English

- **Composed room cameras.** Hero, Overall, Front and Top fit the actual Canvas, furniture and conservative open-front/pull-out envelope. Inspect up close is visible in the main toolbar and uses the selected unit's front. Initial placement snaps to a finished composition. Later deliberate moves use a 600 ms eased path; clear travel is direct, blocked travel retreats above the room before approaching. If a conservative wall/cabinet test cannot guarantee a clear route, the camera snaps. Decoration never drives fitting bounds.
- **Predictable interaction.** One tap/click still selects/opens a unit in place. Component selection does not move the camera or toggle a front. Pointer/orbit, wheel and pinch cancel a shot immediately and retain a controllable view; wheel/pinch zoom-out recentering is preserved. Reduced-motion preference snaps the shot. Finish changes, shelf placement and viewport resize do not reset a chosen camera. After rotation, explicitly choose Overall to refit; preserving the old pose can temporarily crop the new aspect ratio.
- **Idle/background/recovery.** Demand rendering becomes idle after movement. Hidden tabs suspend the entire Canvas loop, including fronts and camera controls; the existing probe avoids background refresh. WebGL loss shows a localized recovery action and retains the design. Restore recreates the renderer. The visible Canvas pauses while the temporary closed A/B scene captures, then resumes.
- **Touch and offer access.** Camera controls wrap, scope/interior/material controls remain reachable, and audited camera, language, swatch, form and storage targets are at least 44 CSS pixels. Phone price/offer access is retained. Update notices sit above the phone offer bar, offer Later and block activation during capture/export or dragging.
- **One truthful sales presentation.** Home, material switcher, embed, designer, Summary, A/B and PDF continue through the shared scene/assets/finish/storage resolvers. Summary now owns a closed Overall capture; entering the offer no longer waits for the inspection scene. The offer URL records its furniture kind, so reloading it still restores the wardrobe/kitchen intended even when another tab edits the other module. A failed capture cannot substitute an older/inspection image. A/B signatures include the camera revision, refreshing old previews without changing furniture. Private fields remain excluded from links/A/B.
- **Development evidence.** The isolated studio adds actual camera/frame counters, context-loss simulation, 10-second/10-minute motion samples and Stop. These tools and fixture data are excluded from production. Existing static Home thumbnails remain unchanged pending owner approval of final imagery; no new image is presented as owner-approved.

Important files: `src/designer3d/cameraShots.ts`, `SceneControls.tsx`, `framing.ts`, `Scene.tsx`, `Designer.tsx`, `CaptureAlternative.tsx`, `comparison.ts`; `src/scene/SceneLifecycle.tsx`, `Rendering.tsx`; `src/pwa/busy.ts`, `Status.tsx`; `src/app/Summary.tsx`, `style.css`, `PreviewStudio.tsx`; `src/scene/RenderMetrics.tsx`, `metrics.ts`; SQ/EN/DE JSON, framing/interaction tests, README and project brief. No price/schema/catalog/model change was needed in Phase 6.

## Verification

The incoming suite passed 159 tests; the final suite passes 164 tests across 20 files. TypeScript, production build, unchanged budget, local asset/precache dependency closure and whitespace checks pass. New behavioral tests cover swept open bounds across eight layouts/aspect ratios, continuous obstacle-free path segments or snap fallback, reduced-motion snapping, structural camera keys and concurrent capture/update blocking. All frozen exact legacy prices/quantities, migrations, privacy, brand isolation, fit/history and multilingual proposal checks remain passing.

Final output is **5,881,827 shipped bytes**, **5,842,551 unique precache bytes**, **122 URLs**. The verified production entry is `assets/index-CTx3s3tS.js`; its script and generated worker hashes are retained. Active-worker bytes were not independently read through the browser tool. Build/entry/size results and browser logs are in `phase-6/`. The unchanged delivery targets are 9,000,000 bytes working and strict <10,000,000 bytes shipped/precache. Original models remain 15 models / 30 variants / 980,308 bytes. Dependency hashes match entry. Upstream Zod annotation and experimental Node localStorage warnings remain non-fatal.

### Desktop browser sales checks

- Laptop click selects/opens one wardrobe unit without focus; Top interrupted by a drag remains controllable; Overall recovers. Touch-visible Inspect, component list/edit and open-front views remain usable. This is desktop input evidence, not a physical touch test.
- Default wardrobe: a shelf moved to 72 cm remains free; basket gives €2,043 versus €1,973 without it. A/B stores the two named closed scenes/inventories; choosing A restores the basket. Copy link reopens the same custom wardrobe and €2,043. Druri basket uses its €60.50 rate and €2,050 total; default stays €2,043.
- Default kitchen with oak bases, warm-white wall units and cashmere tall units shows corresponding associations and €4,863. Druri embedded material preview handed its selected oak finish into the designer. Both brands/kinds were reviewed in SQ/EN/DE: twelve saved Summary snapshots, with no translation-induced price change.
- Actual browser viewports 1180×820, 1024×768, 820×1180 and 390×844 were checked; recorded dimensions, overflow and control-size audits are in `responsive.json`. Transient pre-ResizeObserver measurements are labelled separately; settled results are the acceptance evidence. These sizes do not prove physical-device usability.
- Simulated WebGL loss exposed Restore 3D view; restoring recreated the room and retained the fixed fixture. The expected context-loss diagnostic is separate from normal production error logs. Development HMR sometimes invalidated brand context during source changes; clean reload recovered and production checks used the built bundle.
- Real browser-generated English wardrobe, German mixed-kitchen and stopped-origin Albanian wardrobe PDFs each have three pages, actual closed room images, correct inventory/zone associations and totals. All pages were rendered and visually reviewed. ë/ç, umlauts, long labels and pagination remain supported by the font/proposal tests and the multilingual UI. No message was sent.
- Later dismissed the update without blocking the offer. Explicit Save and update loaded the rebuilt entry while retaining drafts and comparison slots. Production profiler-exclusion checks pass. Stopped-origin reload/navigation then passed for both complete rooms and both brands, retaining €4,863 / €2,043 default and €4,934 / €2,050 Druri QA designs. Cached A/B restored the basket, and an Albanian PDF was downloaded with the server stopped, rendered and reviewed. The owned preview was restarted. This verifies browser caching, not a true network-offline installed-PWA restart. Final checked normal production warning/error logs are empty.

### Sustained desktop measurement and resources

The stable ten-minute kitchen sample completed with **35,525 moving samples**, **16.7 ms p50**, **24.9 ms p95**, and **110.6 ms maximum**. Main scene: 133 draws; 16 textures / 82 geometries remained stable; estimated steady total 62.6 MiB. It passes the proposed p95 ≤33 ms target at this measured viewport, while retaining an individual long frame. Other sales/capture tabs were exercised concurrently. Scope: @Browser desktop, 1024×768 browser / 969×650 Canvas, DPR 1, balanced, fixed japandi fixture and exposure 0.98. These are scripted camera-shot movements, not hardware GPU execution times or a native laptop/tablet FPS guarantee. The first attempt was interrupted by development reloads and is not counted as a completed session.

The custom wardrobe Interior study produced 585 samples, 19.5 ms p95 / 26.6 ms maximum and 85 main draws. Its temporary closed capture peaked at an estimated **131.9 MiB combined**; the extra Canvas was removed. Thirty oak/walnut/cashmere changes settled from 19 textures / 107 geometries to 14 / 83, with no probe refresh from finishes. This is a bounded resource check, not proof of every leak case or actual GPU memory. Exact camera values were unchanged through a finish edit and a measured Canvas resize from 335×650 to 969×650. The profiler panel's periodic React reports themselves induce render work, so idling was checked separately in the normal editor with a DEV-only DOM counter: **24 frames → 24 frames** across the recorded quiet interval after opening fronts. The counter and its code are eliminated from production; adding it did not change the production entry/hash/size. The ten-minute sample predates that DEV-only counter and is not a physical-device result.

The three live PDFs have no out-of-bounds extracted words; all nine pages were rendered/visually checked. The offline SQ PDF retains ë/ç, its basket line, actual scene image and €2,043 total. A three-page offer can put signatures on their own final page; mixed/long offers may legitimately paginate further.

## Exact startup and URLs

If the owned preview is already running, reuse it. Otherwise:

```sh
cd /Users/ibrahimi/3d_designer
pnpm build
pnpm preview --port 52750 --strictPort
```

- Kitchen: http://127.0.0.1:52750/designer/kitchen?brand=default
- Wardrobe: http://127.0.0.1:52750/designer/wardrobe?brand=default
- Second brand: replace `brand=default` with `brand=druri-design` on either URL.
- Home: http://127.0.0.1:52750/?brand=default
- Embed: http://127.0.0.1:52750/embed/material-switcher?brand=druri-design

Development: `pnpm dev --port 52749 --strictPort`, then http://127.0.0.1:52749/preview-studio?brand=default for disposable fixed fixtures. Production excludes the studio. README contains the bundled Node/pnpm PATH fallback.

## Numbered laptop rehearsal

1. Open Home, choose English and a prepared kitchen on a disposable draft. Expect the same editable room/design, a composed Hero view and a visible live estimate. Choosing a preset explicitly replaces the draft; simply visiting a tool continues its saved draft.
2. Tap/click one front. Expect only that unit to open, with no camera flight. Choose Inspect up close, then Overall, Front and Top. Interrupt a move with a drag/wheel; expect immediate control and a recoverable view. Double-click focus remains available. Reduced-motion preference should snap. Camera state stays transient and never changes the price.
3. Manually orbit, then change a finish or rotate/resize the browser. Expect the pose to stay chosen. Use Overall to fit the new viewport. Change Base to oak and Wall to warm white: expect the correct zones, coherent quote and unchanged cabinet dimensions. Undo/Redo restores finishes and totals. Existing worktop cutouts, thickness, lighting and matching-material behavior remain.
4. Wardrobe → Storage & Lighting → choose a cabinet/component. Expect selection without camera movement. Move one shelf; it is free. Add a basket; the quote itemizes only its addition. Invalid overlap remains rejected. Open one component; siblings remain unchanged. Existing fit/history/reset/rebuild-warning behavior is retained.
5. Save A with basket, remove basket and save B, then Compare. Expect closed images, different inventories and default sample totals €2,043 / €1,973. Choose A; expect the basket restored and active private offer details retained. Reload; the same draft/brand state remains.
6. Open Your offer. Expect immediate navigation, then the closed full-room scene, zone/storage text and matching quote. Repeat SQ/EN/DE and the second brand. Download PDF and inspect every page. Copy link to a fresh tab; expect the design and no private customer/offer fields. Native sharing is a separate real-browser rehearsal; stop at the sheet and do not send during QA.
7. Prepare production online: Finish setup or Save and update if offered, then wait for Offline ready. Later dismisses an update; update must not activate during capture/export/dragging. Stop only this owned preview with Ctrl-C, reload and use both modules/brands, finishes, storage, A/B and PDF. Expect cached rooms and retained drafts. Restart with the same preview command afterward.
8. Rehearse the full conversation on the actual presentation laptop with its normal browser and projector/display, including trackpad/mouse, power mode, PDF download and offline reload. Approve the final images at normal viewing distance before regenerating static thumbnails. Tablets can be rehearsed later when available.

Checks: `pnpm test`; `pnpm exec tsc --noEmit`; `pnpm build`; `pnpm check:budget`; `node scripts/check-scene-assets.mjs dist`; `git diff --check`.

## Limits and next task

No failing automated implementation check remains. Owner visual acceptance, actual meeting-laptop/full-browser/native-share rehearsal and calibrated business pricing/material approval remain required. Conservative collision bounds can choose a snap over an animated path; this is intentional. Resize preserves the user's camera and can crop until Overall is requested. Inspection fits a complete unit with opening clearance; use wheel/pinch for closer construction detail.

No tablet is currently available: physical iPad/Android touch, ten-minute thermal/GPU performance, installed-PWA restart/update, native sharing and actual GPU-memory/leak measurements are deferred. Desktop counter/interval estimates cannot certify that hardware. Historical startup spikes, cold 10 Mbps/80 ms behavior and maximum-size rendering remain separate unverified acceptance cases. Supplier appearance, hardware fit, credits and prices remain illustrative; URL limits and v3-link compatibility requirements remain unchanged.

**The plan ends at Phase 6; there is no automatically authorized Phase 7.** The next task is owner laptop rehearsal/visual approval and any resulting Phase 6 fixes. Then refresh approved Home thumbnails from the actual final scenes. Deployment/Git publication and later tablet acceptance require their own request.
