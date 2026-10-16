# Showroom simplification plan

Written 16 October 2026. This file is self-contained: a new Claude chat should be able to start Phase 1 from it without the earlier conversation. Read it fully before touching code, then read `README.md` (current project description, commands and constraints).

## 0. Rules for whoever implements this

- **Work directly on `main`.** Never create branches or worktrees.
- **Never push or deploy** without the owner's explicit permission in chat.
- **One clear commit per completed, approved phase** (small follow-up commits inside a phase are fine). End commit messages with the attribution line the environment asks for.
- **Stop at every review gate** (section 6) and wait for the owner. Do not start the next phase on your own.
- **No paid assets, subscriptions or services.** Free assets are allowed only with clear permission for this use (CC0 preferred: Poly Haven, ambientCG). Record each source, author, licence and date in `public/shared/ASSETS.md`.
- **Performance must be verified in a visible, normal Chrome window on the owner's MacBook Air.** Headless or hidden-browser measurements are supporting evidence only and never prove how the app feels. See section 7.
- Browser work uses the built-in browser (@Browser). Do not use Firefox or ask to control it. Before relying on frame timing in the built-in pane, call `tabs_context` and confirm the pane is *displayed*; a hidden pane does not draw frames.
- Plain, practical English in reports to the owner. Small imperfections are acceptable; obvious or medium visual and interaction problems are not.

## 1. Project and goals

A static, white-label sales demo for kitchen and wardrobe makers in Kosovo (React + TypeScript + Vite, React Three Fiber / Three r180, Zustand, Tailwind, PWA, no backend). It is presented on an **M4 MacBook Air (16 GB) in Chrome**. Languages SQ/EN/DE; two demo brands (`public/brands/default`, `public/brands/druri-design`).

The owner wants the project simplified and refocused around:

1. **Smooth performance and excellent visual quality together.** With Performance mode OFF, zooming, opening fronts and exploring the kitchen can feel like about 30 fps, especially in the first 5–10 seconds; it then becomes more stable. With Performance mode ON it feels sharper and more responsive. Goal: smooth, high frame rate *and* excellent quality, without silently lowering quality.
2. **Fewer layouts and features** (see decisions).
3. **A convincing room**, similar to the competitor sites analysed earlier (Schmidt: complete room with ceiling, dark-framed windows with a real exterior, pendants, dining chairs, plant, clock; IKEA: eye-level framing, soft shadows; Cosentino: surface presentation). Attractive surroundings and objects that look excellent from the presentation cameras. Objects need not be interactive or made in Blender.
4. **Much easier editing** for someone with no design-software experience: clear adding, removing and replacing of units; picture cards of units; drag a unit into a gap and have it sized to fit; an easy alternative to dragging; no dead-end "no available space" message — instead help to understand what can be replaced or where something fits. Same principles for wardrobes.
5. **Sharper default colour combinations** using the existing palette.

Additional findings from the latest review that must be addressed:

- Garden views appear blank white in several normal camera views, including wardrobe windows.
- One brief black flash when entering the corner wardrobe Interior view soon after loading (did not repeat). Investigate; do not assume the old persistent black-panel bug returned.
- Some softness and uneven-looking seams remain visible.

## 2. Owner decisions (16 October 2026)

1. **Wardrobe layouts:** remove **Walk-in** only; keep **Straight** and **Corner**. In the **Corner** layout, remove the window positioned in the middle of the wardrobe and make that area a normal wall. (In both brand catalogs the corner preset `wardrobe` has one opening: `right` wall, offset 100 cm, width 100 cm.)
2. **Kitchen layouts:** remove **Parallel/Galley** and **U-shaped**; keep **Straight**, **L-shaped** and **Island**.
3. **Offers and PDFs:** keep something simple: a basic **Summary** page (picture, item list, total) and **Download PDF**. Remove the offer/customer forms, sending (WhatsApp/Viber/native share) and share-link controls from the interface. Do not spend significant effort improving the PDF.
4. **Saved designs and comparisons:** remove obsolete saved designs completely, and **all Save A/B and Compare data**, together with the dedicated code, storage and dependencies no longer needed.
5. **Appliances & Lighting menu:** remove it from the demo. Appliances and lighting that make the room look good stay in the scene.
6. **Wardrobe bench:** remove it.
7. **Free assets:** allowed from Poly Haven, ambientCG or other sources with clear permission for this use. Choose what is best for the project and needs little effort from the owner.
8. **Colours:** the owner likes the existing colours. **Keep all of them** (or as many as possible). Do not replace the palette with a restricted set of schemes. You may recommend better *default combinations* built from the existing colours.
9. **Baked lighting:** the implementer judges whether the Phase 3 bake is a suitable starting point (recommendation in Phase 2 below).
10. **Cleanup:** remove obsolete planning material, review evidence and other files no longer relevant; reduce unnecessary project size while keeping everything the app needs. Distinguish local-folder cleanup from changes that actually reduce downloads, memory use or rendering cost.

## 3. Current Git state and work already done

Verified on 16 October 2026:

- Branch: **`main`** only (the former `phase1-room-you-stand-in` branch was fast-forwarded into `main` and deleted; there were no conflicts because history was linear). `origin/main` is at `33f6dc6`; local `main` is ahead and **nothing has been pushed**.
- Recent commits on `main`:
  - `167e359` Remove obsolete plans and historical review evidence
  - `5aeac18` Phase 3: baked room lighting for the five prepared designs (committed before the owner's Phase 3 review gate, to preserve it)
  - `ff93842` Compile shaders in the background to remove open and zoom freezes
  - `299cd59` Phase 2: Blender-generated objects (owner-approved)
  - `d1554d7` Phase 1: a room you stand in (owner-approved)
- After `167e359`: `pnpm build` passes (asset budget: 7,618,164 bytes shipped, 158 precache URLs), `pnpm test` passes (25 files, 187 tests).
- This plan file itself is **not committed yet**; commit it at the start of Phase 1 (or with it).
- Cleanup already done in `167e359`: removed `3d_designer.md`, `SHOWROOM_REALISM_PLAN.md`, `SHOWROOM_CORRECTION_PLAN.md`, `public/qa.html` and ~590 tracked historical evidence files under `verification/`. Their still-useful content is condensed into `README.md`. `verification/` is now in `.gitignore` (review evidence stays local).
- Still present locally, untracked and ignored (about 115 MB, **not recoverable once deleted**): `verification/correction-review/` (27 MB; contains `competitors/` reference images used for the room direction and `tools/`), `verification/phase1-review/` (57 MB), `verification/phase2-review/` (11 MB), `verification/phase3-review/` (19 MB), `verification/independent-phase1-review/` (1.6 MB). Owner decision 10 authorises removing obsolete evidence; see Phase 1, step 1.
- `.claude/launch.json` (untracked) has two preview configurations: `dev` (Vite dev server, port 5203) and `prod` (`vite preview` of `dist`, port 52775). Use `preview_start` with these names; never start servers through Bash.
- Node is `/opt/homebrew/bin/node` (v26), pnpm `/opt/homebrew/bin/pnpm`. Blender 5.2 at `/Applications/Blender.app` (local authoring only, run headless).

## 4. Findings

### 4.1 Verified (from code or measurement)

**Rendering and performance**

- Quality levels (`src/scene/quality.ts`, `src/scene/Rendering.tsx`, `src/designer3d/Scene.tsx:217`):
  - *Balanced* (default): pixel ratio `min(devicePixelRatio, 1.5)` on a 2× display, i.e. the image is rendered at 1.5× and upscaled. Pipeline (`src/scene/pipeline/RenderPipeline.ts`): 4× MSAA half-float target → full-resolution GTAO (16 samples) + denoise (16 samples) → OutputPass. PCF shadows with a custom 5×5 bilinear filter (`smoothShadows.ts`), 1024 shadow map; contact shadows (drei, 256 px, redrawn after 800 ms of stillness).
  - *High*: pixel ratio up to 1.75, 2048 shadow map.
  - *Performance mode* (`showroom-performance` in localStorage): pixel ratio 1, no shadows, no AO pipeline.
  - **Automatic behaviour:** `aoShouldPause()` pauses AO **for the rest of the session** when, after 120 moving frames, the p90 frame interval exceeds 30 ms at balanced quality. `qualityForFrames()` switches balanced ↔ high from frame intervals. Neither is visible to the user. This matches "slow for 5–10 s, then more stable" but would trade quality away silently; whether it actually fires in the owner's Chrome is **not yet verified** (see 4.2).
  - Changing quality recreates the render pipeline (the `RenderPipeline` effect depends on `quality`).
- CSS `backdrop-filter: blur()` is used over or near the live canvas: `.canvas-controls` (`src/app/style.css:558`, the camera toolbar on top of the 3D view), `.immersive-toggle` (2677), `.immersive-bar` (2724), and `.hero-swatch-card` (326, Home hero). A blur over a continuously redrawn WebGL canvas costs compositor work every frame in a real window.
- Headless measurement (Chrome headless with Metal GPU on this M4, 1440×900 @2×, production build, Cashmere L kitchen, continuous wheel zoom for 14 s, rAF callback timed up to `gl.finish()`): 60 fps throughout from the first second; per-frame cost p50 ≈ 2–3 ms, p90 ≈ 3–4 ms; one 101 ms long task when the design opens. **This does not establish how the app feels in a visible Chrome window.**
- The built-in browser pane was hidden during the session, so it drew no frames; no visible-window measurement exists yet.
- Download: 7.6 MB shipped and precached by the service worker (Three ≈ 1.18 MB raw / 327 KB gzip; Scene ≈ 450 KB; the PDF chunk ≈ 484 KB and `html2canvas` ≈ 201 KB are lazy-loaded but **still precached**). Download size is not the cause of interaction slowness once cached.

**Visual problems**

- **White garden views — cause found in code.** `ExteriorView` in `src/scene/rooms/RoomShell.tsx:80–116` draws the garden photo as a 9 m-wide plane 3.2 m behind each window and sets `visible = seesInterior(camera, room)` every frame (`stance.ts:86`). From any camera that is not inside the room (Front, Overview, raised views) the garden is hidden, so the window shows the plain scene background (`#eee9df`, reads as white). Confirmed visually in the Phase 3 capture of the straight wardrobe Front view. From inside the room at a grazing angle the plane can also be too small (likely, see 4.2).
- **Room is sparse:** mostly bare plaster walls, one framed picture, small worktop decor, pendants and stools on the island; wardrobes have a bench.
- **Low contrast in defaults:** e.g. the Cashmere L kitchen has cashmere fronts (`#d7ccba`) against a warm wall (`#ece8e1` recipe / `#e5e0d7` environment default) and a light floor.

**Features and code locations**

- Layout lists: `src/designer3d/Designer.tsx:830–833` (`["straight","l","u","parallel","island"]` and `["straight","corner","walkin"]`). Schema enums: `src/catalog/types.ts:221` and `:505`. Generator: `src/designer3d/layout.ts:234` (`generateLayout`), example designs `layout.ts:381` (`examples`, includes a U design at :396), validation `layout.ts:64` (`validateDesign`). Camera/framing special cases: `cameraShots.ts:109`, `framing.ts:198`, `Designer.tsx:2025`. `walkin` also appears in `furniture/CabinetMesh.tsx`, i18n files and tests (`room-placement`, `framing`, `core`).
- Save A/B and Compare: `src/app/Compare.tsx`, `src/designer3d/comparison.ts` (only user of the `idb` dependency; IndexedDB database `showroom-furniture-comparisons`), `src/designer3d/CaptureAlternative.tsx`, the route `/compare` (`src/app/App.tsx:147`), the price-bar controls in `Designer.tsx:1251–1303`, references in `Settings.tsx`, `PreviewStudio.tsx`, `style.css`, i18n, and tests.
- Appliances & Lighting / Storage & Lighting tab: `DetailsSection` (`Designer.tsx:1905–2017`) holds the appliance package (priced line), LED toggle, wardrobe internal LED, floor material and a raw wall-colour picker. For wardrobes the same tab also hosts `InteriorEditor` (`Designer.tsx:1243–1248`). Tabs are defined at `Designer.tsx:1172–1200`.
- Unit editing: `CabinetsSection` (`Designer.tsx:1610–1903`). "Add" places the new unit beside the selected one, or centred on the back wall, at a fixed default width (60 cm kitchen / 80 cm wardrobe), then `validateDesign` rejects it with `fitError` ("This arrangement does not fit…") — the dead end. Cards are text only. Swap type, width pills, nudge ±10 cm, duplicate, delete exist. `validateDesign` is a pure function (bounds, openings, overlaps, island aisle), suitable for searching free gaps.
- Catalog modules (default brand): kitchen base `base-doors`, `base-drawers`, `sink`, `dishwasher`, `corner`; tall `oven`, `fridge`, `pantry`; wall `wall-doors`, `wall-glass`, `wall-open` (open shelf), `wall-hood`. Wardrobe `wardrobe-hanging`, `wardrobe-shelves`, `wardrobe-drawers`, `wardrobe-open`, `wardrobe-sliding`. Widths 30/40/45/50/60/80/90/100 (kitchen), 40/50/60/80/100 (wardrobe).
- The wardrobe **bench** is a decor prop, not a module: `src/scene/rooms/RoomProps.tsx`, `decor.ts`, `resolveRoom.ts`, a framing reference in `cameraShots.ts`, and models `public/shared/models/bench-*.glb`. Other original-kit models still present: `counter-set-*`, `box-linen-*`, `box-ink-*` (check whether still used before removing).
- Saved data: localStorage `showroom-design-<brand>-<kind>`, `showroom-recent-<brand>`, `showroom-performance`, `showroom-presentation-<brand>`, offer details/counters (`src/documents/details.ts`); IndexedDB `showroom-furniture-comparisons`. Migrations: `src/catalog/migrations.ts`.
- Dependencies: `idb` (comparison only), `jspdf` (PDF; pulls optional `html2canvas` and `dompurify` chunks), `jszip` (brand ZIP export in `/setup`), `lz-string` (share links), `zod` (schemas), `workbox-window` (no direct import found; check before removing, it may be used by `vite-plugin-pwa` virtual modules).
- Two tests contain env-gated artifact writers pointing at removed folders (`tests/finish-zones.test.ts:315`, `tests/interior-pdf.test.ts:52`); harmless but dead.
- Room recipes `public/shared/rooms/*-v1.json` and `*-v2.json` remain beside the active `*-v3.json` (kept earlier for compatibility; check whether still referenced).

**Colours available today (keep all):** fronts cashmere, sage, anthracite, white, black, oak, walnut, gloss, plus foil/lacquer/acrylic/Fenix variants of the five solid colours and Egger/Kronospan decors; carcasses white, oak, dark; worktops travertine, marble, concrete, oak, quartz, granite, Egger F206; handles none, bar, profile, knob; plinths matching, black; floors laminate, tiles, concrete; wall colour is free (hex).

### 4.2 Not yet verified (uncertainties)

- **Why it feels like ~30 fps in the owner's visible Chrome window.** Candidates, in the order to test: (a) the automatic AO pause / quality switching firing in the first seconds; (b) per-frame compositor cost of the backdrop blur over the canvas at 2×; (c) start-up work overlapping interaction (texture uploads with an 8 ms per-frame budget in `shaderWarmup.ts`, environment probe refresh, contact-shadow redraws, model loads, bake fade); (d) GPU clock ramp-up on the fanless MacBook Air after idle with demand rendering; (e) total cost at 1.5× + MSAA + full-res GTAO being higher in a real window than headless. None is confirmed.
- Why Performance mode feels *sharper* although it renders at 1×. Likely: no AO denoise softening, steadier frame pacing. Unconfirmed.
- The black flash in the corner wardrobe Interior view: not reproduced.
- Whether the garden plane is also too small at grazing in-room angles (likely, not measured).
- Whether removing the corner wardrobe window leaves that room without its daylight key light (rooms without a window use overhead presentation lighting); visual effect to be checked.
- Availability and quality of suitable CC0 room objects (dining chairs/table, large plants, books, rug, clock, armchair, mirror).
- Whether the built-in browser pane, when visible, behaves like the owner's Chrome. Treat it as secondary evidence.

## 5. The plan

Three phases, each producing a visible, reviewable result. Order: simplify and make smooth first (smaller codebase, honest performance baseline), then the room and colours (largest visual step), then editing (largest interaction step, built on the simplified code).

### Phase 1 — Simpler and smoother

**Goal:** the same rooms, but a cleaner app with fewer controls, sharper still images, no slow start, gardens in every window, and evidence about performance from the owner's real Chrome window.

**Step 1 — Cleanup (local and repository)**

- Commit this plan file.
- Local folders (does **not** change downloads, memory or rendering): delete `verification/phase1-review/`, `verification/phase2-review/`, `verification/independent-phase1-review/`, and the obsolete parts of `verification/correction-review/` (`before-5860343`, `current`, `crops`, `side-by-side`, `annotated`, text reports). **Keep** the competitor references (move `verification/correction-review/competitors/` and `reference-board.jpg` to `verification/references/`) and `verification/phase3-review/` until the Phase 2 gate (it is the before-state of the bake). Delete `dist/` and `tsconfig.tsbuildinfo` before builds only if useful; they are regenerated and ignored. Note: the Git pack is ~161 MB because history contains old evidence; do **not** rewrite history.
- Repository: remove the dead env-gated artifact writers in the two tests; remove unused room recipes and models only after checking references and `node scripts/check-scene-assets.mjs dist`.

**Step 2 — Measure in a visible Chrome window first**

- Add a small production-safe diagnostics overlay enabled by `?fps=1` (off by default, no cost when off). It shows the live frame rate and records, for the first 15 s after a design opens and for a later 15 s window: frame intervals (p50/p90/max), long tasks, every quality change, AO pause events, pixel ratio and canvas size, and when start-up work (textures, models, probe, contact shadows, bake) finishes. It offers "Copy report".
- Ask the owner to run the protocol in section 7 once and paste the reports. Fix what the evidence shows. Until then, treat the candidates in 4.2 as hypotheses.

**Step 3 — Performance and sharpness changes** (adjust after the measurement)

- Remove silent quality changes: no automatic AO pause for the session and no automatic balanced/high switching. Quality changes only when the owner switches Performance mode.
- Motion-adaptive resolution: render at the display's native ratio (2×) when the view is still, so stills and seams are sharp; during camera motion and front animations use a lighter ratio (start at 1.5×) and restore 2× within ~150 ms of stopping. Keep AO at full resolution of the current buffer (half-resolution AO previously caused halos).
- Remove `backdrop-filter` from elements over the live canvas (use a solid or slightly translucent background).
- Finish start-up work behind the loading cue: preload and upload textures and models of the design, compile shaders, render the environment probe and contact shadows, and decide the bake, before the first interactive frame. Avoid recreating the render pipeline on quality changes.
- Keep Performance mode as a manual option in Settings.
- Re-check opening fronts (first tap, open all) and zooming for long frames.

**Step 4 — Garden views, black flash, seams**

- Replace the per-window garden plane with an exterior that is visible from every camera that can see a window: a large curved backdrop (cylinder/hemisphere section) around the room, wide enough for grazing angles, with exposure matched to the room so it never reads as white. Remove the `seesInterior` visibility toggle for it. Check all presets in Hero, Front, Overview and Interior.
- Black flash: capture the corner wardrobe Interior view frame by frame from a cold load (extend `scripts/review/capture-front-steps.mjs`), repeat ≥ 10 cold loads, find the frame and its cause (pipeline target, skipped frame, material compile, bake fade, interior occlusion) and fix it.
- Seams: verify at 2× still rendering; then adjust `GapShade`/AO front growth only if seams still look uneven.

**Step 5 — Removals**

- Kitchen layouts **Parallel/Galley** and **U-shaped**: remove from schemas (`catalog/types.ts`), generator, examples, validation, camera/framing special cases, i18n and tests.
- Wardrobe layout **Walk-in**: same treatment. Keep Straight and Corner.
- Corner wardrobe preset (both brands): remove the window opening (`right`, offset 100, width 100); that area becomes a normal wall. Re-bake that design (or let it use live lighting until Phase 2's re-bake) and check its lighting; if the room looks dull without daylight, propose (do not silently add) a window on a free wall at the gate.
- **Save A/B and Compare**: delete `Compare.tsx`, `comparison.ts`, `CaptureAlternative.tsx`, the `/compare` route, price-bar A/B controls and the alternative-name field, related i18n strings, styles, tests and PreviewStudio parts; remove the `idb` dependency; on start-up delete the IndexedDB database `showroom-furniture-comparisons` once.
- **Obsolete saved designs**: on load, discard any stored design or share link whose layout is removed (or that fails migration) and open the matching prepared design with a short notice. Remove migration code that only served removed features, keeping v1→v3 reads for supported layouts.
- **Appliances & Lighting / Storage & Lighting tab**: remove. Fix the appliance package to the catalog default (keep its price line, no choice). LED stays on (kitchen and wardrobe internal LED). Floor material and wall colour move to the Room tab (keep the floors; replace the raw colour picker with a row of wall-colour swatches plus "custom"). Wardrobe interior editing (`InteriorEditor`) moves under the selected wardrobe in the Units tab (fully redesigned in Phase 3).
- **Wardrobe bench**: remove the prop, its placement and camera reference, and its GLBs if nothing else uses them.
- **Offers**: Summary page keeps the picture, item list, total and **Download PDF**. Remove the offer/customer form (client, salesperson, discount, validity, notes), send buttons (WhatsApp/Viber/native share/"send to anyone"), share-link buttons and related Settings fields from the interface. Keep pricing. Remove code that becomes unused; keep share-link *reading* only if it stays cheap, otherwise remove `lz-string` too.
- Download reduction: exclude the PDF's optional `html2canvas` (and `dompurify` if unused by the PDF path) from the build, or at least from the precache (≈ 230 KB). Remove unused models/recipes/textures found by the asset check.

**Preserves:** the three kitchen and two wardrobe prepared designs, rooms, Phase 2 objects, Phase 3 bake pipeline, lighting, prices, branding and `/setup`, SQ/EN/DE, offline use, undo/redo, Performance mode.

**What the owner should notice:** fewer buttons; a sharper picture when still; smooth zoom and orbit from the first seconds; gardens in every window; no black flash.

### Phase 2 — A convincing room and better default colours

**Goal:** the opening views read as real, furnished rooms at the level of the competitor references, with crisper default colour combinations.

**Room (kitchens):**

- Composition tuned to each preset's Hero, Front and Overview cameras: dark-framed windows (black/anthracite frames) with the Phase 1 exterior; a doorway or opening to another room; a dining corner (table + 2–4 chairs) or a reading chair where space allows; one large floor plant; a rug where appropriate; open shelves or a sideboard with books and ceramics; a wall clock or framed art; a textured feature wall or subtle wall panelling; a tiled or stone backsplash option where it suits the preset; ceiling edge/cornice detail and pendants consistent with the room.
- Sources: free CC0 models and textures (Poly Haven, ambientCG) or other clearly permitted free sources, plus simple architecture built in code. Optimise with the existing pipeline (`scripts/register-decor.mjs`, meshopt + WebP, two detail levels where useful), register in the asset manifest with provenance. Decorative objects are not interactive and never enter the price.
- Placement through the existing clearance rules, authored per preset where needed; objects omitted when they collide with furniture, opening fronts or doors.
- Budget: keep shipped size under the existing 9 MB working limit (currently 7.6 MB). Check memory (texture count/size) and frame cost with the `?fps=1` overlay in the owner's Chrome.

**Room (wardrobes):** dressing-room staging without the bench: a mirror, an armchair or pouf, a plant, a rug, soft textiles, framed art; Corner wardrobe without the middle window (Phase 1).

**Colours:**

- Keep the entire existing palette and every finish. Change only the **default combinations** of the prepared designs (fronts, carcass/interior, worktop, handles, plinth, floor, wall colour) using existing finishes; wall colours may use new hex values for contrast. Proposed starting point (all from the existing palette), shown to the owner earlier:
  - Straight kitchen: white fronts, oak worktop, black profile handles and plinth, warm grey wall, concrete floor.
  - L-shaped kitchen: sage fronts, marble worktop, steel bar handles, off-white wall, light oak (laminate) floor.
  - Island kitchen: anthracite wall run, oak island fronts (island finish zone), quartz worktop, black profile handles, light wall, oak floor.
  - Straight wardrobe: white fronts, oak interior (carcass), bar handles, soft sage-grey wall, oak floor.
  - Corner wardrobe: walnut fronts, white interior, handle-free, off-white wall, concrete floor.
- Present these as rendered before/after images of each preset at the gate; the owner may swap any combination. The previous defaults remain selectable finishes.
- Consider adding "suggested combinations" (one-tap presets) in the Look tab in Phase 3, without removing any individual colour.

**Baked lighting — recommendation:** keep the bake pipeline as the starting point: it costs almost nothing at runtime (one ~20–30 KB lightmap per preset, applied only while the design is unedited, fading to live lighting on structural edits) and gives softer corners and contact shading. Because Phase 2 changes room contents, windows and wall colours, **re-bake all five presets** after the room is final (`scripts/bake-rooms.mjs`, `scripts/review/calibrate-bakes.mjs`, see README) and decide at the gate with live-vs-baked image pairs. If the bake does not visibly improve the new rooms (for example GTAO plus bake makes corners too dark), remove it to keep the code simpler. Regenerate Home thumbnails (`scripts/review/capture-thumbnails.mjs --write`).

**Preserves:** editing behaviour, prices, Performance mode, offline use, all finishes.

**What the owner should notice:** furnished, believable rooms with real windows and a garden; fronts that separate clearly from walls and floors.

### Phase 3 — Easy editing (kitchens and wardrobes)

**Goal:** someone with no design-software experience can add, remove and replace units without help.

- **Three tabs:** **Look** (suggested combinations from the existing palette first, then fronts, worktop, handles; finish zones and per-cabinet overrides under "More options"), **Units** (picture cards), **Room** (layout, room size, window/door, floor, wall colour). Keep the Showroom / Edit distinction only if it still helps; Edit should land on a clear overview.
- **Picture cards:** every unit type shown with a small image rendered from the real 3D unit in the current finish (generated by a script into static WebP files per brand, or rendered once at runtime and cached), with its name and available widths.
- **Free-space finder:** a pure function on top of `validateDesign` that, for a unit type, lists every wall/level gap where it fits and the largest catalog width that fits each gap (10 cm steps). Unit-tested on full, partly full and empty kitchens and wardrobes.
- **Drag from the menu:** dragging a card into the 3D view shows a ghost unit that snaps to the nearest valid gap and resizes to the best width; invalid areas show why. Dropping adds it as one undo step.
- **Easy alternative to dragging:** tap a card → the scene highlights the places it fits ("+ 40 cm"), and the panel lists them ("Back wall, left of the sink — 40 cm"); tap one to place it.
- **When nothing fits:** never a dead end. Explain and offer actions: "No free wall space for an open shelf. Replace a wall cabinet?" with suggested units of the same level (and width where possible) highlighted; "Make the 80 cm unit 60 cm to free space" where that would work.
- **Selected unit:** clear actions — Replace with… (picture cards of compatible types, same width preferred), Width, Delete (button and Delete/Backspace key) with an Undo toast, Open/close. Remove the ±10 cm nudge buttons (dragging along the wall replaces them; keep keyboard arrows if cheap).
- **Wardrobes:** same flow for wardrobe units; "Inside this unit" for shelves, rails, drawers and baskets as picture cards with add/remove/replace and the same "where it fits" help (reuse `interiorValidation.ts`).
- Touch-friendly sizes stay (44 px minimum). SQ/EN/DE strings for all new text.

**Removes:** text-only unit list and catalog grid, nudge buttons, scope controls shown up front.

**Preserves:** layout rules (`validateDesign`), pricing, undo/redo, room/layout generation, finishes and finish zones, wardrobe interior data.

**What the owner should notice:** a picture menu of units; drag or tap to place; the app sizes units to the gap and suggests replacements when the room is full.

## 6. Review gate after every phase (mandatory)

A phase is not complete because tests pass.

1. Build the previous approved commit and the new one; capture both with `pnpm capture:review <base-url> <out-dir>` (all presets × Hero/Overview/Front/Top/Open/Interior at 1440×900 @2×) plus the phase's specific close-ups. Produce side-by-side sheets (before left, after right) in `verification/<phase>-review/` (local, ignored by Git) with a short `REPORT.md`.
2. Run the functional checks: `pnpm build` (includes TypeScript and the asset budget), `pnpm test`, `node scripts/check-scene-assets.mjs dist`, offline reload of the production preview, Summary + PDF download.
3. Run the performance protocol (section 7) with the owner in a visible Chrome window.
4. Report to the owner in plain English: what changed, what was removed, the images to look at first, measured results, known limitations, and what is still unverified. Then stop and wait for approval.
5. On approval: commit the phase on `main` with a clear message. Do not push.

### Phase acceptance checks

**Phase 1**

- Layout choices: kitchens show only Straight, L-shaped, Island; wardrobes only Straight, Corner. The Corner wardrobe has no window in the middle of the wardrobe wall.
- No Save A/B, Compare, Appliances & Lighting tab, offer form, send or share controls; no bench. `idb` is gone from `package.json`; the comparison database is deleted on first start; an old stored design with a removed layout opens a prepared design with a notice and does not crash.
- Summary shows picture, items and total; Download PDF works and the price matches.
- Garden visible (not white) through every window in Hero, Front, Overview and Interior for all five presets, including wardrobes.
- No black frame in ≥ 10 cold-load frame-by-frame captures of the corner wardrobe Interior view.
- Still images visibly sharper than before at normal viewing distance; seams even.
- Performance (owner's Chrome, section 7): no automatic quality change; frame rate during the first 10 seconds comparable to later; no sustained drop below ~55 fps while zooming, orbiting and opening fronts; no long frame (> 50 ms) on the first front tap. If the measured numbers fall short, report them honestly with the cause found.
- Tests, build, budget, asset check, offline pass. Download size reported before/after.

**Phase 2**

- Each kitchen Hero, side by side with the Schmidt/IKEA references (`verification/references/`), reads as a furnished room: windows with exterior, at least one larger furniture group (dining corner or chair), plant, shelves/books or sideboard, wall interest. Nothing floats, intersects or blocks opening fronts.
- Wardrobe Heroes read as a dressing room; no bench.
- Fronts separate clearly from walls, floors and worktops in all presets; all previous finishes still selectable.
- Bake decision recorded with live-vs-baked images; Home thumbnails match the first view.
- Shipped size under 9 MB; performance protocol still passes in the owner's Chrome.

**Phase 3 (task tests, done by the owner without help)**

- Starting from a full kitchen: select a wall cabinet and delete it; open Units, drag an open shelf into the gap; it fills the gap at a sensible width. Undo restores the cabinet.
- Same placement using taps only (no dragging).
- With the kitchen full, try to add a unit: the app explains and offers a replacement; replace a base cabinet with drawers of the same width.
- Wardrobe: add a wardrobe unit into a gap; inside a unit, add a drawer and remove a shelf with the "where it fits" help.
- All new text in SQ/EN/DE; touch targets ≥ 44 px; prices update correctly; tests cover the free-space finder.

## 7. Performance protocol (visible, normal Chrome window)

Headless or hidden-pane numbers never replace this.

1. Production build and preview (`preview_start` name `prod`, http://127.0.0.1:52775). The owner opens it in their normal Chrome window on the MacBook Air (on mains power, Chrome window at its usual size, no DevTools open), with `?brand=default&lang=en&fps=1`.
2. If an update prompt appears, choose Save and update; reload once so the service worker cache is current.
3. For each of: Cashmere/L kitchen, Anthracite island, Corner wardrobe (Interior view):
   - Open the design from Home and **immediately** zoom in and out with the trackpad for 10 s, orbit for 5 s, open all fronts, close them.
   - Wait one minute, repeat.
   - Copy the overlay report after each run.
4. Repeat step 3 once with Performance mode ON for comparison.
5. The implementer analyses the reports (first 10 s vs later, quality changes, long tasks, pixel ratio) and states conclusions only from them. Optionally also measure in the built-in browser pane, but only when `tabs_context` reports it as displayed, and label those numbers as secondary.

## 8. Useful commands and paths

- Install/run: `pnpm install --frozen-lockfile`; `pnpm build`; `pnpm test`; previews via `.claude/launch.json` (`dev` 5203, `prod` 52775).
- Isolated Chrome for review scripts: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --remote-debugging-port=9333 --user-data-dir=<empty dir> --use-angle=metal --enable-gpu about:blank`.
- Review scripts: `scripts/review/` (`capture-showroom.mjs`, `capture-closeups.mjs`, `capture-front-steps.mjs`, `check-front-interactions.mjs`, `measure-gpu.mjs`, `capture-thumbnails.mjs`, `calibrate-bakes.mjs`); bake: `scripts/bake-rooms.mjs` + `art/blender/bake_room.py`; model kit: `art/blender/phase2_kit.py` + `scripts/register-kit.mjs`; decor: `scripts/register-decor.mjs`; asset check: `node scripts/check-scene-assets.mjs dist`; budget: `scripts/check-budget.mjs`.
- Key source areas: `src/designer3d/Designer.tsx` (2,252 lines; menus and editing), `layout.ts` (rules), `Scene.tsx`, `SceneControls.tsx`, `cameraShots.ts`, `framing.ts`; `src/scene/Rendering.tsx`, `quality.ts`, `pipeline/`, `rooms/`, `lighting/`, `bake/`; `src/app/Summary.tsx`, `Compare.tsx`, `Settings.tsx`; `src/documents/offer.ts`; catalogs in `public/brands/*/catalog.json`; assets in `public/shared/` with provenance in `public/shared/ASSETS.md`.
- Constraints and references: `README.md` ("Working constraints", "How the visuals are built"); competitor images in `verification/correction-review/competitors/` (moved to `verification/references/` in Phase 1).
