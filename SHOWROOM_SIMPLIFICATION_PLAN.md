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

### 2.1 Owner feedback after testing the first Phase 1 build (16 October 2026)

Phase 1 was **not approved**. The owner tested the build and asked for the following. The plan then kept three phases (four since decision 2.5); the "Look" panel work that Phase 3 described moves forward into Phase 1 (round 2), and the Home page redesign joins Phase 2 (owner choice: design Home together with the final rooms and colours).

- **General:** each panel tab remembers its own scroll position (an unvisited tab starts at the top). *Inspect up close* is a toggle: a second press returns to the camera position from before the inspection. The reset confirmation is a small notice at the bottom right with Undo that never moves or resizes the showroom. Beginner-friendly wording and visual choices instead of technical terms. Keep every finish colour, but drop the separate "Colour" step: browse finishes in clear visual collections with better previews. Smoothness and quality remain priorities; performance counts as verified only with the owner's visible-Chrome measurements.
- **Room & layout:** remove the *Daylight window*, *Interior door* and *Room openings* editors (they cause fit errors and are not needed); the rooms keep their staged windows, doors and garden; the Corner wardrobe keeps no middle window. Floors get small image previews. Wall colours: a short list of useful colours, no custom picker. Custom dimensions stay, shown expanded, and must behave predictably: changing the L kitchen from 420 × 360 × 270 to 440 × 360 × 280 rebuilt it from 15 to 19 units. Layout icons small enough to fit in one row on the laptop.
- **Styles & finishes:** a much clearer visual explanation of which parts a finish scope changes; real-looking previews for handles and front styles; no backsplash control; no carcass control (it follows the chosen finish or collection); one simple worktop choice instead of the worktop-scope controls; no "Clear this scope's overrides" or similar technical wording.
- **Showroom and editing:** no *Cabinets & Units* tab in Showroom mode (unit management belongs to editing). Inspecting the Corner carousel put the camera behind the fridge; fix it and check every inspection position. Continue towards the visual adding/replacing experience (Phase 4, formerly Phase 3).
- **Wardrobes:** the same improvements, including handle and front-style previews; remove the wardrobe Plinth control (no useful visible difference); keep finish choice and interior editing simple.
- **Home page:** a complete modern redesign that feels like a small furniture website or catalogue, with the Showroom as the standout feature; attractive browsing of kitchens, wardrobes and ready-made designs; entering the Showroom obvious; lightweight. → Phase 2.

### 2.2 Owner feedback after Round 2 — final Phase 1 pass (16 October 2026)

Round 2 was generally accepted (Codex re-check: 188 tests and the asset check passed; Inspect return, tab scroll memory, scoped finishes, Undo and separate island worktops worked). One focused final pass, then Phase 1 closes. No expansion into small bugs or unrelated improvements.

1. **Dimensions:** room and furniture dimensions were confused. Kitchens keep *Kitchen width*; L layouts add a clearly named second side length; Straight and Island hide room depth; the ceiling control is called *Ceiling height*; kitchen-unit heights stay fixed (no adjustable-height system). Wardrobes the same: room depth must not look like wardrobe depth; wardrobes that get shorter under a lower ceiling must say so. Compact / Standard / Spacious follow the same simplified dimensions.
2. **Essential appliances:** Cashmere L → Compact → 200 × 200 cm fell to four units without fridge, hob and hood. Essential units must stay; rejecting a size that cannot keep them is acceptable.
3. **Preview images:** floor, front-style and handle pictures looked like weak screenshots; make them attractive, clear and easy to tell apart. Previews and scene materials must show the intended choice (F206 Black Pietra Grigia looked pale and speckled in both). Keep Ready-made looks and the visual Fronts and handles approach.
4. **Colour browsing:** keep every colour; Ready-made looks stay prominent; choosing a colour should be straightforward with material details secondary (kitchens and wardrobes).
5. **Wall colours:** swatches without visible names; names stay as tooltips and accessibility labels.

Performance felt good overall (very little lag); preserve it. Room presentation and the Home redesign stay in Phase 2; Edit units and the wardrobe-interior redesign stay in Phase 3. *(Superseded by 2.5: Home is Phase 3, editing Phase 4.)*

### 2.3 Phase 1 approved (16 October 2026)

The owner **approved Phase 1, including the final pass**, and asked for it to be committed on `main` (192 tests and the build passed). One limitation is accepted and tracked, not fixed in Phase 1:

- **Accepted limitation — zoom lag with Performance mode OFF.** Zooming in and out still lags badly in the owner's normal Chrome window when Performance mode is OFF. The cause is unresolved. Normal-Chrome FPS has **not** been measured (the `?fps=1` protocol in section 7 has not been run by the owner). This does not block Phase 1 and no further performance round starts now. Future work: run the section 7 protocol with Performance mode OFF, paste the reports, find the cause from them (candidates in 4.2) and fix it. Phase 2 must not make it worse: keep added room detail cheap (few draw calls, small textures, no new per-frame work).

### 2.4 Owner feedback on the first Phase 2 attempt (16 October 2026, evening)

The first Phase 2 attempt (uncommitted: `staging.ts`, `StagingPieces.tsx`, seven CC0 models) was **not approved**. The owner likes the added objects but the rooms still feel small, basic and artificial; the dining group hid the kitchen; a dark blurred rectangle shows on a wall. References: Schmidt (strongest: architecture, materials, lighting, surroundings, kitchen stays the focus), a Schmidt open-plan view (room depth, large window, doorway, surrounding architecture; no living room or TV needed), Cosentino (simple, clean, intentional).

- Rooms must become **genuinely larger and belong to a real home**; enlarging the presentation room must **not** enlarge the kitchen or add cabinets. Furniture gets space around it and stays clearly visible and easy to explore.
- Keep clocks, pendants, plants and dining furniture, composed so they support the kitchen and make sense from every normal view and during inspection.
- Wardrobes: a convincing, spacious dressing room (not a box with a rug and picture). The existing window stays; the Corner wardrobe keeps no middle window.
- Fix the dark blurred wall rectangle (cause found: the Phase 3 lightmap still holds the shadow of the wall picture at its old position) and any other medium or large visual problems. Finish Phase 2 including the Home redesign on top of the new rooms. *(Superseded by 2.5: Home is its own Phase 3.)*
- Owner answers: the shipped-size working limit may rise to **about 11 MB** if the rooms need it; the **Island kitchen gets no dining table** (the island stools seat people).
- The zoom lag with Performance mode OFF stays an accepted, unresolved limitation; do not present it as fixed.

### 2.5 Owner decision: Home becomes its own phase (16 October 2026, evening)

The owner wrote (relayed from a forked session): "you can have home redesign in a new standalone phase so you dont work at multiple things at the same time". So:

- **Phase 2** covers only the rooms: kitchens and wardrobes (larger architecture, staging, the dark blurred wall rectangle fix, default colours, the re-bake), then its review gate.
- **Phase 3 — Home page** is a separate phase after Phase 2, with its own gate, built on the approved rooms. It is not started during Phase 2.
- **Phase 4 — Easy editing** is the former Phase 3 (renumbered; content unchanged).

This supersedes the earlier choices to design Home together with the rooms (sections 2.1, 2.2 and 2.4). The Home redesign that the second Phase 2 round had already implemented in the working tree is not part of the Phase 2 gate; see section 3 for its status.

### 2.6 Phase 2 approved (16 October 2026)

The owner **approved Phase 2 (rooms only)** and asked for it to be committed on `main` without the Home files, not pushed. The Home redesign stays uncommitted in the working tree for Phase 3 (section 3). The zoom lag with Performance mode OFF remains the accepted, unmeasured limitation from section 2.3.

### 2.7 Phase 3 Home — approved and complete (16–17 October 2026)

The owner selected **A — The Room Edit** from Codex's three concepts and asked for an optional **Home-only deep green appearance (`#252c29`)**, including Home's header and footer. Light is the first-visit default; the device remembers the choice. This supersedes the older large photographic-header / promotional-band structure described in Phase 3 below.

**What was built** (`src/app/Home.tsx`, `home.css`, `HomeShowroomChooser.tsx`, `preferences.ts`, `App.tsx`): a split opening with the approved island front view and wardrobe interior detail (`public/shared/showroom/home-island-front.webp`, `home-wardrobe-interior.webp`, from the approved Phase 2 captures); DM Serif Display / DM Sans bundled locally; equal-sized kitchen and wardrobe cards with calculated "As shown" prices that open their prepared room directly; a visual Showroom chooser (`<dialog>`) opened from the main button and the header; "Continue your design" only when a draft exists; on Home the header shows Kitchens / Wardrobes anchors, Showroom, a compact language selector on phones and the light/green switch; the appearance is removed on every other route. SQ/EN/DE.

**Owner approval (17 October 2026):** the owner approved the visual design and user experience. Technical review was left to Claude.

**Claude's technical review and fixes (17 October 2026):**
- Home fonts converted losslessly from TTF to WOFF2 (283 KB → 117 KB, identical glyphs, SQ/DE characters covered).
- Removed the two wide Home photographs of the previous draft (`hero-kitchen.webp`, `hero-wardrobe.webp`, 132 KB) that nothing referenced any more, and the code in `capture-thumbnails.mjs` that generated them.
- Removed nine translation keys of the old Home in all three languages (`enterShowroom`, `step1Body`, `step2*`, `step3*`, `showroomBand*`, `contactBody`).
- Review scripts that click Home's picture cards (`scripts/review/*.mjs`, `scripts/bake-rooms.mjs`) now skip the chooser's images, so they no longer see every prepared design twice. (Rendering the chooser only while open was tried and reverted: it left the pictures blank for a moment on first open.)
- Verified: `pnpm test` 28 files / 201 tests, `pnpm build` (TypeScript and budget), `node scripts/check-scene-assets.mjs dist`; in @Browser on the production preview: card entry (Cashmere L 5,196 €), header and main-button chooser, Escape with focus return, chooser entry into the corner wardrobe (2,777 €) on a phone width, SQ/EN/DE text and prices, green appearance remembered and absent in the Showroom (Inter, brand background), no horizontal overflow at 375 px, 44 px header targets, the update prompt, and an offline reload with the preview server stopped (Home, pictures and fonts from the cache).
- Shipped size with the committed files: about 10.04 MB (11 MB working limit).

**Phase 3 is complete** and committed on `main` (not pushed). Codex's evidence: `verification/phase3-home/REPORT.md` (local).

### 2.8 Owner authorization: Phase 4 follows Phase 3 directly (17 October 2026)

The owner authorized starting **Phase 4 (easy editing)** immediately after the Phase 3 commit, without another confirmation. Phase 4 ends at its own review gate: report, visual evidence and manual checks, then stop; Phase 4 is **not** committed before the owner's review. Approved rooms, Phase 1 behaviour and the accepted zoom lag (section 2.3) stay as they are.

### 2.9 Phase 4 easy editing — implemented, awaiting owner review (17 October 2026)

Implemented in the working tree on `main` (not committed): the plan's Phase 4 below, with these decisions.

- **Free-space finder** (`src/designer3d/placement.ts`, pure): free stretches per wall at the unit's height and depth (other units and the room's windows/doors block them), each width checked with `validateDesign`; the unit goes against its neighbour, otherwise positions along the stretch in 10 cm steps (island aisle). The L corner is offered once; the carousel never on the island. Also `replaceUnit`, `resizeUnit`, `replaceable` and `makeRoom` (narrow a neighbour), which never suggest essentials (sink, hob, hood, oven, fridge, corner). It is not built on `resizeRoom`'s column analysis as section 5 suggested: both rest on `validateDesign`, so their answers cannot disagree, and the finder also has to handle gaps `resizeRoom` never creates (between units, over the corner, on the island).
- **Units tab** (`UnitsPanel.tsx`; Edit mode now opens on it): picture cards by level with "Free places: n"; tap → places listed and shown as green boxes with "+ cm" labels in the room (`PlacementSpots.tsx`, labels as DOM buttons); drag a card into the room → the real unit previews in the nearest place (existing drag-preview path) and drops as one undo step; nothing fits → replace / narrow suggestions with the units lit up. Selected unit: picture, widths that fit, *Replace with* picture cards, Open/Close, Delete (+ Delete key) with Undo notices; arrow keys move it 10 cm. Removed: the text unit list, nudge buttons, Duplicate (adding a card does the same without the dead end) and the old catalog grid.
- **Wardrobe interiors** (`InteriorCards.tsx`, replaces `InteriorEditor.tsx`): rows with pictures (move to the next free height ≥ 10 cm away, open drawers/baskets, remove), add cards (drawers/baskets low, rails high, shelves in the largest free space), honest "no free height" / "not behind sliding doors" / "no room in front to pull it out" with swap offers, ready-made interiors. Height fields and product drop-downs are gone; `interiorPositions` / `pullOutBlocked` in `interiorValidation.ts`.
- **Pictures:** 17 unit types and 4 interior parts rendered from the real scene (`render-previews.mjs`, stages in `PreviewRender.tsx`), 53 KB in total.
- **Checks:** `pnpm test` 29 files / 225 tests (24 new for the finder and interiors), `pnpm build`, asset check; `scripts/review/check-easy-editing.mjs` runs the Phase 4 task tests with real mouse/keyboard input in the review Chrome (15/15). Evidence: `verification/phase4-review/` (local).
- Not verified: the owner's own task tests without help (section 6), touch dragging on a real tablet (touch uses tap-to-place; a horizontal drag works, vertical swipes scroll the panel), frame timing in a visible window.

### 2.10 Phase 4 visual pass before approval (17 October 2026)

The owner tested Phase 4 (functions fine, dragging works in normal Chrome; Codex independently confirmed deletion, tap-to-place, fitting, replacement, narrowing, interiors, Undo and 225 tests) and asked for one focused visual pass before approving; no redesign.

- **Selection:** `src/designer3d/furniture/SelectionFrame.tsx` draws one frame per unit (white halo + 6 px blue `#1f66e5` line, pale grey-blue tint at 6 %) around the carcass, so it stays while fronts open and covers units without doors; a selected interior part gets its own frame (`InteriorComponents.tsx`). Suggestions (`highlight`) are a dashed amber frame; free places stay green. The per-panel drei `Edges` and the `selected` prop on `Box` are removed; lines and tint stay excluded from AO and exports (`tests/selection-ao.test.ts` updated). A saturated tint was tried and rejected: it turned anthracite navy and walnut purple.
- **Cards:** catalog, *Replace with* and interior add cards share one grid (`minmax(72px, 1fr)`, three per row in the side panel), 4:3 pictures, tighter padding/spacing.
- Checks: 225 tests, build (10.41 MB), asset check, `check-easy-editing.mjs` 15/15; captures via `scripts/review/capture-selection.mjs`. Evidence: `verification/phase4-review/selection-sheet.jpg`, `cards-before-after.jpg`. **Approved by the owner on 17 October 2026 and committed on `main`** (not pushed).

### 2.11 Final Home and materials refinements (17 October 2026)

Owner requested improvements to the approved Home, stronger Showroom/materials
visibility, more catalog variety, a wardrobe material study and phone usability
fixes. Scope is the website presentation and standalone material pages; no
`/designer` functionality, scene rendering, room recipes, layout/pricing rules or
catalog sources may be changed. No commit, push or deployment is authorized.

Implemented: prominent Showroom navigation; collapsed phone/tablet menu below the
header; direct kitchen/wardrobe Materials navigation; 67px desktop title; larger,
clickable phone hero; six kitchen and three wardrobe looks (four existing-finish
editions with original renderer captures); compact Materials section; standalone
`/wardrobe-materials` with local finish/handle/interior previews; compact phone
material-study heading and tiles; Settings icon toggles back to the originating
page; Back to top reaches document top. Approved Home palette and green preference
remain. SQ/EN/DE and conditional categories remain supported.

Verification is recorded in `verification/home-final/REPORT.md`; the owner
approved these refinements on 20 October 2026 (section 2.12). This is a refinement of approved Phase 3, not
a restart of its design or authorization to change Showroom/editing behavior.

### 2.12 Final review and demo approval (20 October 2026)

- Owner commit `1a9e902` (Settings): Reset demo clears only this brand's kitchen and wardrobe drafts; the brand list comes from `src/brand/deployed.ts`; brand ZIP export refuses a deployed or loaded folder name; device branding restores the brand's own presentation default when added or removed.
- Claude's full review found no presentation blockers. Fixes, owner-approved: `src/scene/resources.ts` no longer restores R3F's start-up `shadowMap.needsUpdate = true` after every render, so the GTAO normal pass stops redrawing both shadow maps every frame (headless, zooming with Performance mode OFF: L kitchen 956 → 678 draw calls per frame, island 1156 → 814, corner wardrobe 325 → 241; pixel-compared, no visible change). `?lang=` wins over the brand default on a first visit. PDF file names use the company name. `public/.DS_Store` and `src/.DS_Store` are no longer tracked.
- Owner requests: the selection frame is thinner (`SelectionFrame.tsx`: halo 4 px, line 2 px; suggestions 4.5 / 2.5 px), superseding the 6 px line of section 2.10; the Home "Kitchen materials" card uses `showroom/home-materials-kitchen.webp` (1150 × 1020 render of the Nordic Sage L kitchen) instead of the 320 × 200 Styles thumbnail.
- **The owner approved the Home refinements of section 2.11 and the demo as it is.** All four phases are complete; no further phase is planned. The zoom lag with Performance mode OFF remains the accepted limitation of section 2.3; the section 7 protocol was not run and normal-Chrome frame rates remain unmeasured.
- Checks: `pnpm test` 30 files / 234 tests, TypeScript, production build (10.41 MB shipped), asset check, offline reload (headless, after Offline ready), PDF generation, Phase 4 task script 15/15.

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
- `.claude/launch.json` (untracked) has three preview configurations: `dev` (Vite dev server, port 5203), `prod` (`vite preview` of `dist`, port 52775) and `baseline` (`vite preview` of `verification/phase1-review/baseline-dist`, port 52776, the "before" build for the Phase 1 gate). Use `preview_start` with these names; never start servers through Bash. A second preview of `dist` on port 52777 was used as the "after" build in the first Phase 1 review.
- **Phase 1 status (16 October 2026, afternoon):** round 1 is implemented in the working tree on `main` (uncommitted; report in `verification/phase1-review/REPORT.md`). The owner reviewed it and asked for round 2 (section 2.1, Phase 1 step 6). Round 1's build is kept as `verification/phase1-review/round1-dist` for comparison. Round 2 is implemented in the working tree (uncommitted, report in `verification/phase1-review/round2/REPORT.md`). The owner then asked for one final pass (section 2.2, Phase 1 step 7); it is implemented in the working tree (uncommitted, "Final pass" section of the same report; the Round 2 build is kept as `verification/phase1-review/round2-dist`). **Phase 1 was approved by the owner on 16 October 2026 and committed on `main`** (section 2.3). Normal-Chrome FPS is still not measured; zoom lag with Performance mode OFF is an accepted, tracked limitation.
- **Phase 2 status (16 October 2026, evening):** `main` at `cc4a46e`. First attempt not approved (section 2.4). Second round implemented in the working tree (presentation envelope, architecture, staging, re-bake, default colours), report `verification/phase2-review/REPORT.md`; **approved by the owner and committed on `main`** (section 2.6), not pushed. Next: Phase 3 (Home page), only when the owner asks. A Home redesign was also implemented in that round before decision 2.5 arrived (`src/app/Home.tsx`, Home CSS, new i18n keys, the wide Home photographs from `capture-thumbnails.mjs`); it belongs to Phase 3. **Owner choice: keep it in the working tree for Phase 3 and leave it out of the Phase 2 commit.** Held (uncommitted) for Phase 3:
  - `src/app/Home.tsx`, `src/app/style.css` (the only changes in it are Home's), `src/i18n/en.json`, `sq.json`, `de.json` (new Home keys, five old ones removed);
  - `scripts/review/capture-thumbnails.mjs` (the wide Home photographs), `public/shared/showroom/hero-kitchen.webp`, `hero-wardrobe.webp`;
  - README text for Phase 3 (add it with the Home commit, replacing the "Home thumbnails" bullet): - **Home:** a small catalogue without 3D: a large photograph with *Enter the showroom*, three steps, the prepared kitchens and wardrobes as picture cards with their price (each opens in the Showroom), a showroom band and the company's contacts. Thumbnails and the two wide photographs: `node scripts/review/capture-thumbnails.mjs <preview-url> --write`.
  - Commit Phase 2 on approval with these paths excluded, e.g. `git stash push -u -m phase3-home -- <the paths above>`, commit, `git stash pop`. Verified 16 October 2026: with them set aside, `pnpm build` (9.30 MB shipped), `pnpm test` (196 passed) and the asset check pass, and the Phase 1 Home shows the new rooms. The prepared designs' thumbnails (`showroom/classic|japandi|modern|wardrobe|wardrobe-straight.webp`) are Phase 2 and go with its commit. Phase 1 "before" captures: `verification/phase2-review/before/`, build `verification/phase2-review/baseline-dist` (`baseline` preview).
- **Phase 3 status (17 October 2026):** Home (The Room Edit) approved visually by the owner, technically reviewed and verified by Claude, **committed on `main`** (`fbd2c78`), not pushed (section 2.7).
- **Phase 4 status (17 October 2026):** functions and visual pass (section 2.10) **approved by the owner and committed on `main`**, not pushed. The five old untracked `public/shared/fonts/DM-*.ttf` files (replaced by WOFF2 in Phase 3, unreferenced) were deleted at the owner's request after the commit; shipped size 10.12 MB.
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

Four phases (since owner decision 2.5), each producing a visible, reviewable result. Order: simplify and make smooth first (smaller codebase, honest performance baseline), then the room and colours (largest visual step), then the Home page on top of the approved rooms, then editing (largest interaction step, built on the simplified code).

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
- **Appliances & Lighting / Storage & Lighting tab**: remove. Fix the appliance package to the catalog default (keep its price line, no choice). LED stays on (kitchen and wardrobe internal LED). Floor material and wall colour move to the Room tab (keep the floors; replace the raw colour picker with a row of wall-colour swatches plus "custom"). Wardrobe interior editing (`InteriorEditor`) moves under the selected wardrobe in the Units tab (fully redesigned in Phase 4, Easy editing).
- **Wardrobe bench**: remove the prop, its placement and camera reference, and its GLBs if nothing else uses them.
- **Offers**: Summary page keeps the picture, item list, total and **Download PDF**. Remove the offer/customer form (client, salesperson, discount, validity, notes), send buttons (WhatsApp/Viber/native share/"send to anyone"), share-link buttons and related Settings fields from the interface. Keep pricing. Remove code that becomes unused; keep share-link *reading* only if it stays cheap, otherwise remove `lz-string` too.
- Download reduction: exclude the PDF's optional `html2canvas` (and `dompurify` if unused by the PDF path) from the build, or at least from the precache (≈ 230 KB). Remove unused models/recipes/textures found by the asset check.

**Step 6 — Review round 2 (owner feedback, section 2.1)**

*Behaviour*

- Panel tabs: one remembered scroll position per tab (and per Showroom/Edit mode); a tab not yet visited opens at the top.
- *Inspect up close* toggles. Pressing it stores the live camera (position and target); pressing it again, or *Back* on the unit card, glides back to exactly that view. Other camera buttons still go to their presets.
- Notices (reset done, design replaced, fit problems, units removed by a resize) become small toasts at the bottom right, outside the page flow, with Undo where it applies. The header buttons keep one height.
- Inspection camera: replace the fixed "4 m in front of the unit" heading with a search over viewing angles (straight on, then up to ±60°) and eye heights that keeps the camera inside the room and keeps the line of sight from the camera to the unit's front free of other furniture (`segmentHitsBox` on `cameraObstacles`). Aim at the unit's real height (wall cabinets were aimed at floor level). A unit test checks every unit of all five prepared designs.
- Showroom mode shows only *Styles* and *Room*; a selected unit shows its card (name, size, open/close, inspect, and for wardrobes "Edit inside" that switches to editing). Units and interiors are edited in Edit mode.

*Predictable room size and layout*

- Cause of 15 → 19 units: every room change (custom dimensions, the size buttons) discarded the prepared units and ran the greedy generator (`generateLayout`: units of at most 60 cm, a wall cabinet above every base unit). Room height played no part.
- New pure `resizeRoom(design, room, catalog)`: keeps every unit and its order; each wall run stays attached to its corner, and a block of tall units at the far end of a run stays at that end; extra length is absorbed by widening flexible units (doors, drawers, wall cabinets, pantry and wardrobe units, keeping wall cabinets aligned with the base units below) to other catalogue widths; a remaining gap of at least 30 cm gets a matching unit (base + wall cabinet, or a wardrobe unit); shrinking narrows flexible units first, then removes the least important ones from the open end (never sink, hob, oven, fridge or corner while others can go). Wardrobe heights follow the room height. The staged window keeps its wall and is moved only when it no longer fits. A toast reports added or removed units, with Undo. Unit tests: the 440 × 360 × 280 case keeps 15 units, growth/shrink steps change the count by at most what is needed, and every result passes `validateDesign`.
- Layout buttons start from that layout's prepared design (same units and arrangement as on Home), resized to the current room and keeping the current finishes, instead of the generator.

*Room tab*

- Remove the window, door and opening editors; existing openings in designs stay. Layout icons in one compact row (three kitchen layouts, two wardrobe layouts). Room size buttons, then *Custom dimensions* expanded (width, depth, height, Apply; Enter applies; invalid values explained in place). Floor choices as small image tiles. Five wall colours (off-white, warm white, warm grey, sage grey, charcoal) without a custom picker; a design whose colour is not in the list shows it as a sixth "current" tile until changed.

*Styles tab (kitchens and wardrobes)*

- Order: **Ready-made looks** (the existing collections, as picture cards rendered from the real scene) → **Fronts** → **Front style** → **Handles** → **Worktop** (kitchens) → **Plinth** (kitchens only).
- **Which parts change** ("Whole kitchen / Wall cabinets / Base cabinets / Tall units / Island / Selected unit"; wardrobes: "All wardrobes / Selected unit") with a small drawing for each choice that highlights the affected parts. It applies to fronts, front style and handles. Choosing "Whole kitchen" now really changes every unit (it also clears per-zone and per-unit choices for that property), a zone choice changes every unit in the zone, and a single unit that differs offers "Match the rest of the kitchen". This replaces "Apply defaults to all / clear overrides" and the related hints.
- **Fronts:** the five material tiers shown together as collections (heading = material, with a simple price hint), each with its colours as picture tiles and names; no separate tier dropdown and Colour step. All 32 finishes stay.
- **Front style** and **Handles:** picture cards rendered from the real 3D front (flat / panelled; handle-free, steel bar, Gola profile, black bar).
- **Worktop:** one row of picture tiles for all worktops (material name under each); for kitchens with an island a switch "Different worktop on the island" reveals a second row. No worktop-scope dropdown.
- **Removed controls:** backsplash (stored value kept), carcass (follows the front: light fronts → white, dark → graphite, oak-like wood → oak, collections keep their own), wardrobe plinth.
- Previews are rendered by a script from the real scene materials (dev-only page + `scripts/review/render-previews.mjs`) into small WebP files under `public/shared/previews/` with a manifest; a missing preview falls back to the colour swatch. Re-run after Phase 2 changes colours or rooms. Phase 4 (Easy editing) reuses the same script for unit picture cards.

*Wardrobes:* the same Styles and Room changes; interior editing stays under the selected wardrobe in Edit mode, with the redesign of its controls in Phase 4 (Easy editing).

**Step 7 — Final pass (owner feedback, section 2.2)**

- *Dimensions* (`RoomPanel.tsx`): fields follow the layout. Straight and Island kitchens: **Kitchen width** and **Ceiling height** (room depth is hidden and kept); L kitchens add **Second side length** (the left wall, i.e. the room depth). Wardrobes: **Wardrobe width**, **Second side length** for Corner, **Ceiling height**. Kitchen units keep fixed heights (a short line says so); for wardrobes a live line says how tall they will be under the ceiling being entered ("made 220 cm tall to fit, normally 230 cm"), and the room notice reports it. The size buttons per layout: one number for one-wall layouts (Straight 3.2 / 4.2 / 5 m, Island 4 / 4.8 / 5.6 m, wardrobes 2.8 / 3.6 / 4.4 m), two for L / Corner. The canvas caption reads "420 × 360 cm · Ceiling height 270 cm". The custom form skips the browser's step validation (it silently blocked values such as a 225 cm ceiling).
- *Essential units* (`resize.ts`): sink, hob with its hood, oven, fridge and corner unit are never removed and every wall run keeps at least one unit; a size that cannot keep them is rejected, the design stays unchanged and the form names the smallest size that works (`smallestRoom`, e.g. 210 × 210 cm for the Compact Cashmere L). Dishwasher and pantry may still go after the flexible units.
- *Materials*: F206 gets its own dark stone map (`f206-color/roughness`, derived from the CC0 Marble012 veining; it used the pale granite map and colour); the concrete map loses its terrazzo pebbles; the tiles map gets 5 mm grout joints (`art/textures/derive_surfaces_phase1.py`).
- *Previews* (`PreviewRender.tsx`): floors as an empty room corner with skirting; front style as a three-quarter product view of a sage unit (kitchen) and a close view of the upper door corners (wardrobe, where the frame is a fine groove); handles on a cashmere drawer unit at three-quarters (kitchen) and at handle height (wardrobe). All 64 pictures re-rendered. `render-previews.mjs` gained a try-out mode (`PREVIEW_OUT`, `PREVIEW_CAM`); stage cameras sit at least 1.6 m from their target (orbit limits).
- *Colour browsing* (`StylesPanel.tsx`, `frontColours.ts`): one grid of 11 colours (identical-looking finishes grouped, light to dark, wood decors last); below it **Material for <colour>** with the materials that colour comes in and a €–€€€€ hint. Changing colour keeps the material when available. Supplier codes appear only to tell two decors apart. All 32 finishes stay selectable; same for wardrobes.
- *Wall colours*: round swatches only, names as tooltip and accessible label.

**Preserves:** the three kitchen and two wardrobe prepared designs, rooms, Phase 2 objects, Phase 3 bake pipeline, lighting, prices, branding and `/setup`, SQ/EN/DE, offline use, undo/redo, Performance mode, every finish, stored finish zones and per-unit finishes.

**What the owner should notice:** fewer buttons; a sharper picture when still; smooth zoom and orbit from the first seconds; gardens in every window; no black flash. After round 2: picture choices instead of technical lists, a clear "which parts change" drawing, resizing that keeps the kitchen, an Inspect button that takes you back, and notices that never move the showroom.

### Phase 2 — A convincing room and better default colours

**Goal:** the opening views read as real, furnished rooms at the level of the competitor references, with crisper default colour combinations. (Home: Phase 3, owner decision 2.5.)

**Revised approach after the owner's feedback (section 2.4) — this replaces the "Room" bullets below where they conflict:**

- **Presentation envelope.** `design.room` stays the editable kitchen/wardrobe space (validation, resizing, pricing, the Room tab, captions unchanged). A pure function `presentationRoom(design)` derives a larger box around it: walls that carry units stay where they are; walls without units move outwards (target roughly 6–7 × 5.5 m for kitchens, 5 × 4.5 m for dressing rooms, never smaller than the design room). Shell, wall cut-aways, ceiling, downlights, stance and `seesInterior`, the hero camera search, orbit limits, inspection obstacles, staging, environment probe and bake use the envelope; the design's openings keep their walls (translated where the wall moved).
- **Architecture** (built in code, few draw calls): large dark-framed windows / a glazed garden door on envelope walls, a wide doorway with a lit hallway glimpse (floor continues, one lit wall, a small piece of furniture), ceiling shadow gap and a lowered bulkhead with downlights over the kitchen run, door architraves, skirting, refined plaster and floors.
- **Composition**: the dining group stands in the added space beside the kitchen, out of the line of sight to fronts from the Main, Front and Overview views and outside inspection paths (checked by unit tests). Island kitchens: no table (owner). Plant, clock, shelves, pendant support the composition; the hero camera stands inside the envelope (real depth, no cut-away wall).
- **Dressing rooms**: same envelope; wardrobe wall, window, doorway to the bedroom, mirror, lounge chair with side table, rug, pendant/ceiling detail.
- **Lighting**: re-bake all five presets against the envelope (fixes the stale shadow); bake surfaces are the envelope's six planes.
- **Budget**: up to about 11 MB shipped (owner, 2.4); report the actual figure.
- Keep the uncommitted Phase 2 models and the optimisation script; rewrite the placement on the envelope.

**Room (kitchens):**

- Composition tuned to each preset's Hero, Front and Overview cameras: dark-framed windows (black/anthracite frames) with the Phase 1 exterior; a doorway or opening to another room; a dining corner (table + 2–4 chairs) or a reading chair where space allows; one large floor plant; a rug where appropriate; open shelves or a sideboard with books and ceramics; a wall clock or framed art; a textured feature wall or subtle wall panelling; a tiled or stone backsplash option where it suits the preset; ceiling edge/cornice detail and pendants consistent with the room.
- Sources: free CC0 models and textures (Poly Haven, ambientCG) or other clearly permitted free sources, plus simple architecture built in code. Optimise with the existing pipeline (`scripts/register-decor.mjs`, meshopt + WebP, two detail levels where useful), register in the asset manifest with provenance. Decorative objects are not interactive and never enter the price.
- Placement through the existing clearance rules, authored per preset where needed; objects omitted when they collide with furniture, opening fronts or doors.
- Budget: keep shipped size under about 11 MB (raised from 9 MB by the owner, section 2.4; 7.2 MB before Phase 2). Check memory (texture count/size) and frame cost with the `?fps=1` overlay in the owner's Chrome.

- Floors: tile joints and a calmer concrete were added in the Phase 1 final pass (step 7); re-render the floor previews after any further floor change.

**Room (wardrobes):** dressing-room staging without the bench: a mirror, an armchair or pouf, a plant, a rug, soft textiles, framed art; Corner wardrobe without the middle window (Phase 1).

**Colours:**

- Keep the entire existing palette and every finish. Change only the **default combinations** of the prepared designs (fronts, carcass/interior, worktop, handles, plinth, floor, wall colour) using existing finishes; wall colours may use new hex values for contrast. Proposed starting point (all from the existing palette), shown to the owner earlier:
  - Straight kitchen: white fronts, oak worktop, black profile handles and plinth, warm grey wall, concrete floor.
  - L-shaped kitchen: sage fronts, marble worktop, steel bar handles, off-white wall, light oak (laminate) floor.
  - Island kitchen: anthracite wall run, oak island fronts (island finish zone), quartz worktop, black profile handles, light wall, oak floor.
  - Straight wardrobe: white fronts, oak interior (carcass), bar handles, soft sage-grey wall, oak floor.
  - Corner wardrobe: walnut fronts, white interior, handle-free, off-white wall, concrete floor.
- Present these as rendered before/after images of each preset at the gate; the owner may swap any combination. The previous defaults remain selectable finishes.
- The "Ready-made looks" cards (Phase 1 round 2) are the one-tap combinations; align their content with the new defaults and re-render all previews (`scripts/review/render-previews.mjs`) after the rooms and colours are final.

**Baked lighting — recommendation:** keep the bake pipeline as the starting point: it costs almost nothing at runtime (one ~20–30 KB lightmap per preset, applied only while the design is unedited, fading to live lighting on structural edits) and gives softer corners and contact shading. Because Phase 2 changes room contents, windows and wall colours, **re-bake all five presets** after the room is final (`scripts/bake-rooms.mjs`, `scripts/review/calibrate-bakes.mjs`, see README) and decide at the gate with live-vs-baked image pairs. If the bake does not visibly improve the new rooms (for example GTAO plus bake makes corners too dark), remove it to keep the code simpler. Regenerate the Home thumbnails of the prepared designs (`scripts/review/capture-thumbnails.mjs --write`) so the current Home shows the new rooms.

**Preserves:** editing behaviour, prices, Performance mode, offline use, all finishes.

**What the owner should notice:** furnished, believable rooms with real windows and a garden; fronts that separate clearly from walls and floors.

### Phase 3 — Home page (standalone, owner decision 2.5)

**Status: complete (section 2.7).** What was actually built is described there; the bullets below are the original brief.

**Goal:** a Home page that presents the approved rooms like a small furniture catalogue, with the Showroom as its highlight. Starts only after the Phase 2 gate is approved; built on the approved room renders.

A complete redesign (owner feedback 2.1), lightweight (no new libraries, no 3D on Home):

- Feels like a small furniture website or catalogue: a large photographic header from the best Hero render with one clear call to action "Enter the showroom"; sections for **Kitchens** and **Wardrobes**, each with picture cards of the prepared designs (name, layout, size, "from … €" from the real price calculation) that open the design directly in the Showroom; a short "How it works" strip (choose a design → change colours → get your offer), and the brand's contact details.
- Showroom is the standout: the call to action, the cards' primary action and the header all lead into it; continuing the last design on this device is offered when one exists.
- Images are the regenerated Home thumbnails (`scripts/review/capture-thumbnails.mjs --write`) plus one or two larger WebP renders; responsive at 1440×900 down to 390×844; SQ/EN/DE.
- Gate: before/after screenshots at laptop and phone width, Home download size before/after.

**Preserves:** the approved rooms, Showroom behaviour, prices, offline use, SQ/EN/DE.

**What the owner should notice:** a Home page that looks like a furniture catalogue and leads straight into the Showroom.



### Phase 4 — Easy editing (kitchens and wardrobes)

**Goal:** someone with no design-software experience can add, remove and replace units without help.

- **Tabs:** *Styles* and *Room* were simplified in Phase 1 round 2 (picture choices, "which parts change" drawing, no window/door editors). This phase rebuilds **Units** (Edit mode only). Keep the Showroom / Edit distinction only if it still helps; Edit should land on a clear overview.
- **Picture cards:** every unit type shown with a small image rendered from the real 3D unit (extend `scripts/review/render-previews.mjs` from Phase 1 into static WebP files; a runtime render in the current finish only if the static ones look wrong next to the chosen finish), with its name and available widths.
- **Free-space finder:** a pure function on top of `validateDesign` that, for a unit type, lists every wall/level gap where it fits and the largest catalog width that fits each gap (10 cm steps). Unit-tested on full, partly full and empty kitchens and wardrobes.
- **Drag from the menu:** dragging a card into the 3D view shows a ghost unit that snaps to the nearest valid gap and resizes to the best width; invalid areas show why. Dropping adds it as one undo step.
- **Easy alternative to dragging:** tap a card → the scene highlights the places it fits ("+ 40 cm"), and the panel lists them ("Back wall, left of the sink — 40 cm"); tap one to place it.
- **When nothing fits:** never a dead end. Explain and offer actions: "No free wall space for an open shelf. Replace a wall cabinet?" with suggested units of the same level (and width where possible) highlighted; "Make the 80 cm unit 60 cm to free space" where that would work.
- **Selected unit:** clear actions — Replace with… (picture cards of compatible types, same width preferred), Width, Delete (button and Delete/Backspace key) with an Undo toast, Open/close. Remove the ±10 cm nudge buttons (dragging along the wall replaces them; keep keyboard arrows if cheap).
- **Wardrobes:** same flow for wardrobe units; "Inside this unit" for shelves, rails, drawers and baskets as picture cards with add/remove/replace and the same "where it fits" help (reuse `interiorValidation.ts`).
- Touch-friendly sizes stay (44 px minimum). SQ/EN/DE strings for all new text.

- **Free-space finder and resizing** share code: build the finder on the run/gap analysis of `resizeRoom` (Phase 1 round 2), so "where does it fit" and "what happens when the room changes" give the same answers.
- **Wardrobe interior:** "Inside this unit" as picture cards (shelf, rail, drawer, basket) with plain-language help; replaces the current interior form controls.

**Removes:** text-only unit list and catalog grid, nudge buttons, interior form controls.

**Preserves:** layout rules (`validateDesign`), pricing, undo/redo, predictable resizing, finishes and finish zones, wardrobe interior data.

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
- Performance (owner's Chrome, section 7) — *not met at approval; accepted as a tracked limitation (section 2.3): zoom lags with Performance mode OFF, FPS unmeasured*: no automatic quality change; frame rate during the first 10 seconds comparable to later; no sustained drop below ~55 fps while zooming, orbiting and opening fronts; no long frame (> 50 ms) on the first front tap. If the measured numbers fall short, report them honestly with the cause found.
- Tests, build, budget, asset check, offline pass. Download size reported before/after.
- Round 2 (section 2.1): each tab returns to its own scroll position, an unvisited tab starts at the top; Inspect up close twice returns to the earlier view; Reset shows a bottom-right toast with Undo and the canvas does not move or resize (measured canvas rectangle before/after); the Corner carousel and every other unit of the five prepared designs are visible when inspected; Showroom mode has no Units tab; no window/door/opening editors, backsplash, carcass or wardrobe plinth controls, no custom wall-colour picker, no "overrides" wording; floors, fronts, front styles, handles, worktops and ready-made looks are picture choices; every previous finish is still selectable; "Which parts change" shows a drawing for each choice; the L kitchen resized to 440 × 360 × 280 keeps its 15 units; layout icons fit in one row at 1440×900.
- Final pass (section 2.2): Straight and Island show only Kitchen width and Ceiling height, L and Corner add Second side length, wardrobes say Wardrobe width; the size buttons match; the Cashmere L at Compact → 200 × 200 is refused with the smallest working size and no essential unit ever disappears (unit test over all prepared designs); a lower ceiling's effect on wardrobe height is stated; F206 reads as dark stone in its picture and the scene; floors, front styles and handles are clearly distinguishable pictures; fronts are chosen by colour, then material; wall colours are text-free swatches with tooltips.

**Phase 2**

- Each kitchen Hero, side by side with the Schmidt/IKEA references (`verification/references/`), reads as a furnished room: windows with exterior, at least one larger furniture group (dining corner or chair), plant, shelves/books or sideboard, wall interest. Nothing floats, intersects or blocks opening fronts.
- Wardrobe Heroes read as a dressing room; no bench.
- Fronts separate clearly from walls, floors and worktops in all presets; all previous finishes still selectable.
- Bake decision recorded with live-vs-baked images; the prepared designs' Home thumbnails match their first view.
- The visible room is clearly larger than the kitchen and reads as part of a home (window, doorway, architecture); the kitchen itself keeps its size and unit count. No staged object hides fronts in the Main, Front or Overview views or blocks an inspection view. No dark blurred rectangle or other medium/large visual fault.
- Shipped size under about 11 MB; no new per-frame work; zoom lag with Performance mode OFF reported honestly as the accepted limitation.

**Phase 3 — Home page**

- Reads as a small furniture catalogue; Kitchens, Wardrobes and the prepared designs are browsable as picture cards; "Enter the showroom" is the most prominent action and every card opens its design in the Showroom; works at 1440×900 and 390×844; no heavier than before; images come from the approved Phase 2 rooms; SQ/EN/DE.

**Phase 4 — Easy editing (task tests, done by the owner without help)**

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
