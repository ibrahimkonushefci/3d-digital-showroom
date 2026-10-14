# Showroom realism — Phase 0 baseline

13 October 2026. Phase 0 only. Browser work used **@Browser / Codex In-app Browser exclusively**. No physical tablet was available. No deployment, dependency upgrade, new model/texture, design-schema migration or later-phase appearance work was performed.

## Source and reproducibility

The checkout was clean at `5860343e94efcb6ee94e774144e63748cdc3fb74` (`Polish showroom controls and document the phased realism plan`), newer than the plan's recorded commit. Read the whole plan, README and project brief; no applicable filesystem AGENTS.md was found in the project/ancestor paths. The user's supplied @Browser instruction applied.

`initial-working-tree.patch` is intentionally empty. `initial-source-hashes.json` records SHA-256 hashes of the input source, public assets, tests, scripts, manifests, configuration and lockfile before implementation. `final-source-hashes.json` records the implemented inputs; `phase-0-source.patch` contains the tracked-source diff. `dependencies.json` records installed versions (Three 0.180.0, R3F 9.8.1, drei 10.7.9, camera-controls 3.1.2); no package/lockfile change was made. Commands in this run used Node 26.11.1, rather than assuming the README's earlier bundled Node version.

Frozen compatibility data is under `tests/fixtures/realism/{default,druri-design}.json`. Each has all five presets, deterministic document/cabinet IDs, room and camera data, complete SQ/EN/DE price lines/totals, both brand/catalog snapshots, v1/v2 documents, compressed deployed/local shares (including a v1 nested design), and kitchen/wardrobe A/B records. These are synthetic fixtures, not user drafts. A/B fixture images reuse existing bundled thumbnails and are not claimed to depict the fixed-ID documents. Normal tests never regenerate fixtures.

## Implemented foundations

- `src/scene/renderInput.ts` assembles `DesignDocument + Catalog + current room recipe + quality`. Cabinet identity, dimensions and existing interior measurements are resolved with the same current-style helper used by pricing and worktops. The commercial projection retains the document/catalog; presentation quality and recipe stay outside it. Opening progress, camera and inspection stay transient. The current procedural shell is explicitly identified; no authored room or v3 fields are introduced.
- `src/scene/resources.ts` provides shared reference-counted geometry/map variants, a pending-decode cache contract, per-scene target/material ownership and static model instances with independent transforms and cloned override materials. Current decoded texture sources remain owned by drei's shared loader cache; configured variants are leased/disposed separately. No GLTF asset loader or new asset is introduced. Shared maps are read-only; texture-specific overrides must use owned variants.
- Rounded geometry and configured surface maps share leases across visible/capture Canvases. Commit-time acquisition avoids abandoned-render leaks. The generated PMREM target is disposed as a target, and private contact-shadow targets are released when obsolete. Renderer/light shadow targets retain their own ownership.
- `Rendering.tsx`, `activity.ts` and camera/front animation callbacks replace per-frame scene traversal with constant-size camera sampling and explicit motion boundaries. Idle demand gaps are excluded; slow active samples are not clamped. Existing quality policy stays automatic balanced/high with manual lightweight. The studio locks quality locally. Balanced/high DPR caps remain 1.5/1.75, including React re-renders. Profiler report updates do not restart contact-shadow work.
- `/preview-studio` adds motion sampling, opening/interior controls, temporary closed A/B peak measurement, context/device labels and metrics JSON. Export controls wait for the current scene's capture registration and prevent preset switches during export. The studio reads fixed fixtures and does not edit/save drafts or comparison slots.
- `RenderMetrics.tsx` is imported only by the DEV studio. Main/shadow/contact counts describe the latest rendered frame. `renderPass.ts` explicitly labels all initial PMREM capture/blur work; probe counts and CPU time are cumulative setup totals, not per-frame. No runtime probe refresh is added. The production route and bundles exclude profiler/fixtures.
- `check-budget.mjs` retains the 9,000,000-byte working target and strict less-than-10,000,000-byte shipped/precache ceiling; optional `dist --json <path>` emits repeatable evidence.

## Automated results

Initial source: 82 tests in 10 files and `pnpm exec tsc --noEmit` passed.

Implemented source: **98 tests in 12 files**, TypeScript, production build, budget check and `git diff --check` passed. Frozen totals and line items match both brands in all three languages. Legacy persistence/share/A/B reads retain IDs and geometry; draft reads do not write. Share privacy, brand isolation, invalid products, active-offer preservation, undo/edit behavior and capture/quota preservation are covered by the combined existing/new tests. New ownership checks exercise last-lease disposal, StrictMode-style reacquisition, late decode completion, rejected decode retry, target replacement and isolated model overrides.

Fresh output: **4,650,106 shipped bytes**, **4,617,960 unique precache bytes**, **86 unique URLs** (`budget.json`). Workbox's raw manifest-entry count includes duplicate URL entries; the budget uses unique URLs. Build logs contain upstream Zod annotation warnings; Node emits an experimental localStorage warning during tests. Neither failed the checks.

`production-exclusion.json` records the bundle exclusion check. Opening `/preview-studio` on production preview returned Home with no profiler UI. The loaded hashed entry was checked against the fresh build on `http://localhost:4173` (`production-browser.json`), separately from the original `127.0.0.1` preview origin. A visible “Offline ready” badge alone is not treated as a completed offline/update test.

## Browser baseline and limits

Timing runs used the studio at confirmed **1024 × 768 CSS pixels**, balanced quality, **969 × 650 Canvas CSS pixels**, reported DPR **1**, generated current lighting and exposure **0.98**. This viewport override is not a physical tablet or its pixel density. User agent and renderer string are in every report. The fixed preset camera makes a small deterministic oscillation for 10 seconds and returns to its original shot. Separate image exports wait for loading/animation to settle and resize the capture to 1600 on the long edge before writing a 960-wide WebP.

| Current-source observation | Kitchen `japandi`, closed | `wardrobe-straight`, Interior |
| --- | ---: | ---: |
| Moving samples | 639 | 647 |
| p50 / p95 interval | 16.6 / 24.8 ms | 16.7 / 23.6 ms |
| Largest active interval | 48.2 ms | 30.9 ms |
| First complete main pass, loader idle | 379.7 ms | 251.0 ms |
| Settled main draws / triangles | 248 / 81,746 | 110 / 11,818 |
| Settled directional-shadow draws / triangles | 233 / 80,544 | 72 / 9,504 |
| Settled contact draws | 0 | 0 |
| Estimated steady textures + targets + geometry + framebuffer | 92.1 MiB | 84.5 MiB |

Initial/capture frames include contact-depth/blur work: kitchen 248 main + 466 shadow + 251 contact/offscreen draws, **965 total**, above the proposed 650 closed-draw target during that work. The settled frame is 481 draws. Record that startup/capture cost instead of calling every frame under budget. Initial PMREM has 55 calls / 660 triangles and roughly 5–7 ms CPU submission in these warm browser runs; it is not measured GPU time.

A temporary closed A/B Canvas completed at an estimated combined peak of **192.3 MiB**. `kitchen-capture-browser.json` and the actual JSON download (`kitchen-exported-metrics.json`) retain the capture snapshot. Three further capture cycles kept the main renderer at 22 textures with small geometry-counter variation (194–196), rather than a monotonic increase. This short check is not a 30-change/10-minute leak or thermal test. The cycle evidence precedes the final added PMREM pass field; final timing/capture files include it.

Measurements are browser frame intervals and renderer counters. CPU submission time includes shadows and is not GPU execution time; shadow CPU time is unavailable (reported as zero with an explicit note). Estimates account for known maps, targets, geometry and a framebuffer allowance. They exclude decoded CPU images, driver allocation, programs and opaque internal buffers; two Canvas estimates can double-count shared resources. They are **not total physical GPU memory**. Scene-ready starts at profiler commit, excludes route/catalog/network time and does not establish cold-network interactive readiness. Idle reports do not request render frames.

`kitchen-before.jpg` is a pre-edit studio screenshot at 1030 × 1025; it is not a pixel-matched pair with the new capture images. Fixed-document camera data and new exports establish the reproducible baseline for later phases. No visual improvement is claimed in Phase 0. Owner approval of realism remains a later visual gate.

## Additional browser tool checks

All five preset image exports completed, plus the straight-wardrobe Interior image. SQ/EN/DE PDF buttons produced valid two-page PDFs (`wardrobe-{sq,en,de}.pdf`); this checks generation/download, not a new visual PDF acceptance review. The actual metrics JSON download was parsed and contains the corresponding temporary closed capture report. Rapid preset switching disables export until the selected scene registers; the corner-wardrobe retry then saved successfully.

Lightweight and high controls were exercised: lightweight reported zero shadow draws and 5 textures, high restored shadow work and 19 textures for the corner wardrobe. Actual DPR stayed 1 with this browser override; these checks do not prove tablet DPR performance. Druri Design's studio loaded its branding and fixed-ID fixtures (`druri-studio.jpg`).

Portrait sizing was verified on a fresh studio tab at **820 × 1180**, with no horizontal document overflow (`portrait-browser.json`, `studio-portrait.jpg`). An earlier override attempt on the existing tab still reported 1024 × 768; its screenshot is kept as `portrait-request-before-retry.jpg`, and it is not counted as portrait evidence. These are studio layout checks, not a full normal-editor touch/phone acceptance pass.

## Local testing

```sh
cd /Users/ibrahimi/3d_designer
pnpm dev --port 5173 --strictPort
```

If the existing server already owns 5173, use it. Open `http://127.0.0.1:5173/preview-studio?brand=default`; repeat with `brand=druri-design`. If Node/pnpm are absent, use the PATH fallback documented in README.

1. Select each of the five scenes. Expect the familiar procedural kitchen/wardrobe and fixed preset framing. No saved customer draft is replaced.
2. Choose balanced, then Run 10s motion sample. Expect a gentle camera movement and “Motion sample complete”; p50/p95 have nonzero sample counts. Quality remains selected. Reset measurements clears this session and remounts the renderer (source maps may remain warm).
3. Toggle all fronts; for a wardrobe, Toggle interior. Expect fronts to open or disappear for inspection and storage to remain visible. These are presentation states; cabinet dimensions, saved designs and prices remain unchanged.
4. Try lightweight/high. Expect the existing differences in maps/shadows/DPR, with no furniture or pricing change. Actual DPR is capped by the browser/device's ratio.
5. Measure A/B peak. Expect a temporary closed, overall scene and completion feedback. The temporary Canvas is removed; no A/B record is saved. Repeat and compare settled renderer counters.
6. Download metrics JSON, Download thumbnail and PDF SQ/EN/DE. Expect valid local files for the selected fixture, with the current brand, language and indicative pricing. Switching presets immediately before export must wait for that preset's capture function. No share message is sent.
7. Visit the normal designer read-only or use an explicitly disposable design for edits. Expect normal editing, price, offer, A/B, branding and language controls. Do not reset/replace a real draft to reproduce the baseline.
8. Production routing check: `pnpm build`, then `pnpm preview --port 4173 --strictPort`; open `http://127.0.0.1:4173/preview-studio?brand=default`. Expect Home and no development measurement controls. Development mode does not provide the production offline guarantee.

## Physical-device protocol — NOT PERFORMED

No iPad/Android model, OS, physical GPU, native share sheet or installed-PWA result is verified. Provisional targets remain an iPad 9th generation and a roughly Tab A8-class Android tablet with 4 GB RAM; these are assumptions, not purchasing recommendations. Record the actual weakest meeting device and use it as the release gate.

1. On the computer, run `pnpm dev --host 0.0.0.0 --port 5173 --strictPort` on a trusted local network. On each actual tablet, open `http://<computer-LAN-IP>:5173/preview-studio?brand=default`. Select **Actual physical tablet** and enter exact model, OS, browser, orientation and power/thermal notes. This command is a test instruction; this run did not expose a LAN server.
2. Record a fresh-load and warm-reload report separately. Keep balanced quality, identical fixtures and shots, record actual Canvas size/DPR. Repeat closed/open kitchen, closed/interior wardrobe and both brands. Save JSON/images for each scenario.
3. Repeatedly orbit/open/edit for at least 10 minutes. Use repeated samples plus the actual control interaction; inspect p95 ≤33 ms, selection response, hot-device stalls and context loss/reload. Perform 30 material/layout changes on a disposable design. Do not infer a 10-minute result from one 10-second sample.
4. Perform repeated A/B captures; let resources settle and compare counters. Investigate persistent >10% growth. Keep estimated steady/capture memory separate from OS/driver measurements; use platform GPU tooling if available, and label it separately.
5. Check landscape and portrait touch controls, selection, camera interruption, SQ/EN/DE labels, prices, PDF and branding. Native sharing goes only to the share sheet; do not send.
6. Rehearse offline and update on a prepared **production** origin/installed PWA separately (existing authorized HTTPS origin or localhost on the tablet; plain LAN HTTP development is not a PWA/offline test). Verify the loaded entry and worker version, required assets and readiness, then disconnect network/restart, use both modules, materials, A/B and PDF. Restore connectivity and test the prompted update with a disposable saved design. No deployment is authorized here.

## Next authorized review point

Phase 0 foundations are ready for **Phase 1 — physical materials and credible construction**, after explicit authorization. Its scope is physical UV/finish mapping, visible panel/hardware construction and matching plinth/slab details, while preserving the verified commercial/persistence baseline. Real-device and long-session acceptance remain open and must be completed when devices are available. No later phase was started.
