# Showroom correction and improvement plan

14 October 2026, revised the same day for a $0 budget. Evidence: [verification/correction-review/REPORT.md](verification/correction-review/REPORT.md).

**Status (15 October 2026):** Phase 1 is implemented, including the follow-ups after the independent review (black-panel fix, reworked opening views and desktop fallback, seamless travertine, straight-kitchen staging, AO with automatic pause; smooth shadow filter, full-resolution AO, AO closes front gaps). The owner **approved Phase 1 for the demo** on 15 October 2026 (minor softness, occasional light seams and faint wall banding accepted; normal-window Chrome rehearsal still the owner's manual check). Its report is [verification/phase1-review/REPORT.md](verification/phase1-review/REPORT.md) (kept locally, not committed). Phase 1 is committed (`d1554d7`). Phase 2 was reviewed (Codex) and **approved by the owner for the demo** on 15 October 2026, then committed on the same branch; its report is [verification/phase2-review/REPORT.md](verification/phase2-review/REPORT.md) (local). A responsiveness fix (background shader compilation) is committed separately. **Phase 3 is implemented (uncommitted, same branch) and waiting at its review gate**: [verification/phase3-review/REPORT.md](verification/phase3-review/REPORT.md) (local). Deployment remains a separate request.

## 1. Why the result looks so similar, in one paragraph

The six phases mostly built correct infrastructure and sales features. They did not change the four things a viewer actually perceives:

1. **Where the camera stands.** The hero is still a high, telephoto "model on a table" view of a cut-away room in a beige void.
2. **How strong light and occlusion are.** The lighting is flat and ambient-dominated, there is no AO, and the gaps between fronts render light.
3. **What the objects are made of.** The models are script-built boxes and cylinders without textures, and several texture maps are blank or flat.
4. **Whether anyone compared the pictures.** No phase gate compared matched images.

Schmidt runs a 2017 Babylon beta and still looks better. Its advantage is an eye-level interior composition, baked lighting and authored content, not its engine. IKEA shows that a live, editable planner can look convincing through strong soft shadows, eye-level framing and sculpted props.

## 2. Constraints this plan is built around

- **Budget: $0.** No paid assets, marketplace models or freelance artists. Only CC0 sources (Poly Haven, ambientCG) and original work.
- **Blender 5.2.2 LTS** is installed on your **M4 MacBook Air (16 GB)**. Claude drives it headless through scripts (`Blender --background --python …`). Your part is reviewing images, not modelling.
- **Your time per phase:** about 1–2 hours of review on the laptop.
- **Presentation target:** this M4 MacBook Air in **Chrome**. Performance acceptance is measured on it. Tablets remain a later, separate check.
- **Preserve everything already built:** pricing, offers/PDF, A/B, sharing, zone finishes, component storage, SQ/EN/DE, branding, offline and saved drafts.

## 3. What to keep

| Keep | Why |
| --- | --- |
| R3F/Three.js, procedural editable furniture | Required for arbitrary sizes, opening fronts and pricing. No engine change is justified |
| Render-input/resolver boundary (`renderInput.ts`, `finishes.ts`, `interiors.ts`) | Rendering, price, Summary, A/B and PDF agree; visual work plugs in here |
| Design v3, migrations, pricing parity, zone finishes, component storage, A/B, PDF, SQ/EN/DE, branding, offline | Real sales value (Phases 4–6) |
| Physical UV mapping, cavity term, shadow shell, room recipes, asset manifest + precache checker, capture readiness, camera path maths | Good foundations that start paying off once the content and camera change |
| Budgets and the device-honesty discipline | Still right. There is headroom: 5.88 MB of 9 MB, and the kit used 0.98 of 2.5 MB |

Nothing here needs rollback or a rewrite.

## 4. Decisions (resolved)

| Decision | Outcome |
| --- | --- |
| Visual references | **IKEA PAX** for eye-level framing and soft shadows · **Schmidt** for room composition (ceiling, window with exterior, restrained decor) · **Cosentino** for surface presentation |
| Default wall/floor finishes | May change **in the prepared room recipes only**, for contrast (warm-white plaster walls, a floor that separates from the furniture). Saved customer drafts keep their choices |
| Art budget | **$0:** CC0 assets + Claude-scripted Blender generation and baking. No manual modelling by you |
| Presentation machine | M4 MacBook Air, Chrome |
| Default opening view | **Inside the room** (see below) |

### Opening view: inside the room, with the overview one tap away

- **Showroom mode opens on the interior Hero:** eye height about 1.5–1.6 m, vertical FOV about 50°, standing inside the room facing the furniture. This is what makes owners and customers read it as "a room", and it matches all three references.
- **Edit modules switches to Overview automatically.** Editing needs the whole layout visible, and the current outside view is good for that. Returning to Showroom restores Hero.
- **Small rooms:** if the furniture cannot be framed from inside at ≤ 60° FOV, Hero falls back to a slightly raised corner view that is still inside the room.
- **Kept unchanged:** Front, Top and Inspect up close, plus the Phase 6 behaviours (taps open fronts without moving the camera, transitions can be interrupted, reduced motion snaps the camera instantly, the user's view is preserved).
- Capture images for A/B and the PDF keep the closed **Overview**, so offers show the whole design. Hero imagery is used for Home only after approval.

## 5. Review gate after every phase (mandatory)

A completion report or passing tests cannot close a phase. To pass the gate:

1. Build the previous approved commit and the new one. Capture both with the committed capture tool (promoted from `verification/correction-review/tools/` to `scripts/capture-showroom.mjs` in Phase 1): all five presets × Hero/Overview/Front/Top/Open/Interior at 1440×900 @2×, plus the phase's specific close-ups.
2. Produce side-by-side sheets and a reference board next to the competitor references at the same framing class.
3. You review on the M4 MacBook Air in Chrome, at normal viewing distance (and on the external display/projector if you will use one), then do the 5-minute sales walkthrough live.
4. Record pass/fail against the phase's visual acceptance list, with the images. Functional checks (tests, budget, offline, PDF) are the other half; they never substitute for this.

If you say "still looks the same", the phase is not done. Diagnose before continuing.

## 6. Phase 1 — "A room you stand in" (code + CC0, no Blender dependency)

**Goal:** the largest visible change, delivered first. The opening view should read as "a kitchen I'm standing in", furnished and lit, not "a 3D model".

**Target look:** IKEA PAX framing and wall shadows ([ikea-frames-shadows](verification/correction-review/competitors/ikea-frames-shadows.jpg)). Schmidt's complete room with an exterior view ([schmidt-island-room](verification/correction-review/competitors/schmidt-island-room.png)). Compare with today's [kitchen L hero](verification/correction-review/annotated/kitchen-l-hero-annotated.jpg).

### Work

1. **Interior Hero and automatic Overview in Edit mode** (`cameraShots.ts`, `framing.ts`, `SceneControls.tsx`, `Designer.tsx` mode switch, room recipes), as specified in §4.
2. **Complete the room** (`RoomShell.tsx`, `Scene.tsx`, recipes):
   - Render a ceiling with emissive downlight discs.
   - Hide only the wall between the camera and the subject in Hero; hide walls and ceiling for Overview/Top.
   - Remove the visible floor-slab edge in interior views.
   - Replace the flat void outside windows with a CC0 exterior backplate (≤ 250 KB).
   - Remove or justify the wall-coloured "support" boxes (`Scene.tsx:1064`).
3. **One render pipeline with AO** (new `src/scene/pipeline/RenderPipeline.tsx`; `Rendering.tsx`, `CaptureAlternative.tsx`, `quality.ts`):
   - Three r180 `EffectComposer` + `GTAOPass` at half resolution + `OutputPass`. These are in `three/addons`, so no new dependency.
   - The same pipeline serves live view and capture.
   - On for balanced/high; off for lightweight.
4. **Lighting rebalance** (`lightingRecipe.ts`, `RoomEnvironment.tsx`, new v3 recipes; v1/v2 files kept):
   - Environment intensity about 0.35–0.5 with a stronger window key, a key:fill ratio of roughly 3–4:1, softer and wider shadows.
   - Emissive pendant shades and LED strips.
   - Exposure/white balance per recipe.
   - Calibrated on all five presets with fixed captures.
5. **Dark reveals and front details** (`CabinetShell.tsx`, `Primitives.tsx`):
   - Dark reveal material on gap-facing carcass edges.
   - Real sliding-door profiles instead of black lines.
   - Fix B2 (oak edge visible through the wardrobe gap) and B1 (island worktop line).
6. **Texture repairs and room surfaces** (`public/shared/textures`, ASSETS.md):
   - Re-derive the oak veneer from its CC0 source without flattening the grain (target std-dev ≥ 15).
   - Restore real ambientCG normal/roughness maps for travertine, marble and granite.
   - Add subtle micro-normal and roughness variation for lacquer/foil.
   - Make the travertine and laminate maps seamless.
   - Add a CC0 plaster wall material.
   - New recipe wall/floor defaults for contrast.
7. **Quick decor wins (CC0):**
   - 4–6 Poly Haven decor models chosen for size and quality, e.g. a plant, bowls, a cutting board, books or a vase, depending on what is available.
   - Optimised to GLB with a pinned dev-only `@gltf-transform/cli` (meshopt + WebP).
   - Placed through the existing clearance rules. Each entry records its source page, author, date and CC0 licence.
8. **First impression:**
   - Loading cue in the canvas (B8).
   - Regenerate Home thumbnails from approved Phase 1 captures (B7) after your approval.
9. **Refactor only what this touches:**
   - Move `Handle`/`DoorPanel`/`Drawer`/`WardrobeDrawer`/`CabinetMesh` from `Scene.tsx` into `src/scene/furniture/`.
   - Add the RenderPipeline abstraction.
   - Commit the capture tool.
   - Leave `Designer.tsx` alone except for the mode-switch hook.

### Effort, download, risks

- **Effort:** about 7–10 focused days.
- **Download:** +0.5–1.0 MB, staying under 9 MB.
- **Cost:** $0.
- **Risks:**
  - AO cost: half-res, sample limits, automatic lightweight fallback, measured on the M4 in Chrome.
  - Interior framing may crop large layouts: wider in-room fallback, and Overview one tap away.
  - AO halos on thin parts: tune the radius and exclude transparent/emissive materials.
  - Available CC0 decor varies: choose what fits and omit rather than force a poor asset.

### Visual acceptance (all five presets, matched before/after sheets)

- Hero camera is inside the room. The kitchen hero shows the ceiling or its edge, and the window shows an exterior. No floor-slab edge, beige void or cut wall end is visible in Hero.
- Furniture spans 60–80% of the frame width. Vertical edges stay vertical.
- Visible soft shadow/darkening under wall cabinets, where carcasses meet the floor and walls, and behind tall units.
- Gaps between fronts read **darker** than the fronts for white, cashmere, oak and anthracite.
- Anthracite fronts show shading variation across their faces. Cashmere fronts separate clearly from the wall.
- At least four new decor objects are present in kitchen heroes and look intentional, not scattered.
- B1–B8 fixed. Corrected texture maps meet the statistics above.
- M4 MacBook Air in Chrome: ≤ 33 ms p95 while orbiting at the presentation resolution with AO on. Lightweight still works. Captures match the live view.
- Pricing, PDFs, A/B, sharing, offline and all existing tests unchanged. Edit mode lands on Overview.

**What you should notice:** the opening view feels like standing in a furnished kitchen or dressing room, with a ceiling, a window to the outside, darker corners, crisp dark gaps and a few real objects. Furniture is bigger in the frame. Appliances and clothes are still the current simple models.

## 7. Phase 2 — Blender-generated objects (scripted, time-boxed)

**Goal:** replace the primitive-built props with convincing ones, at $0 and without manual modelling from you.

**Target look:** IKEA garment and propping detail ([ikea-interior-layout](verification/correction-review/competitors/ikea-interior-layout.jpg)); Schmidt appliance fronts, tap/sink and worktop props.

### Pipeline (all Claude-run, reproducible)

- `art/blender/*.py` scripts run headless on the M4. The outputs are metre-scale GLBs with UVs, baked AO (texture or vertex colour), 512–1K WebP textures and two levels of detail.
- They are then optimised by `scripts/optimize-assets.mjs` (meshopt/WebP) and registered in the existing manifest/precache checker with source script hashes.
- Blender sources and intermediate files stay outside `public/`. The procedural fallback remains for every asset.
- Blender is a local authoring tool only; it is not a runtime or build dependency, and the shipped files are original project work.

### Asset sets, each time-boxed

| Set | Method | Time box |
| --- | --- | --- |
| Hanging garments (8–12: shirts, blouses, trousers, a dress/coat) with hangers | Simple pattern meshes draped by **Blender cloth simulation**, colour/fabric variants, AO baked | 3 days |
| Folded stacks (3), towels, shoe pairs (2), boxes, a bag | Cloth sim or scripted modelling with bevels/subdivision and fabric textures (CC0) | 2 days |
| Oven, hob, hood, fridge front, inset/undermount sink, two taps | Scripted modelling with bevels, glass/steel PBR, generated control/burner decal textures, baked AO | 3 days |
| Stools, pendants (emissive diffuser), optional small dining table + chairs | Poly Haven CC0 where a good fit exists; otherwise scripted | 1–2 days |

**Rule:** if a set does not look convincing at its time box, it falls back to the best CC0 alternative or the current model. You are told which, with images. No open-ended polishing.

### Effort, download, risks

- **Effort:** about 8–12 days.
- **Download:** kit ≤ 2.5 MB plus about 0.5–1.0 MB textures, for a total of about 8–8.5 MB, under 9 MB. If approved assets would exceed 9 MB, you get an explicit choice (smaller textures/fewer variants vs. a lazily cached "showroom pack"). The 10 MB ceiling is never silently raised.
- **Cost:** $0.
- **Risks:**
  - Cloth simulation quality varies: time-box + fallback.
  - Inconsistent style between generated and CC0 assets: one material/colour palette sheet first.
  - M4 bake/sim time: minutes per asset, run in the background.
  - Texture memory on tablets: LODs and lightweight mode.

### Visual acceptance

- At 2× inspection, no visible primitive construction on focal props (sink depth, tap, oven door, hob, stools, pendants).
- Garments are recognisably different items with folds and real hangers. The wardrobe interior holds up beside the IKEA reference at the same framing, though it is not identical in close-up.
- Every asset is in the manifest with its source (script hash or CC0 page). The missing-model fallback still works.
- Budgets pass. M4/Chrome performance stays within the Phase 1 limit.

**What you should notice:** clothes, appliances and props stop looking like toys. The wardrobe interior and worktop close-ups become sales-worthy.

## 8. Phase 3 — Baked lighting for the five prepared designs (automated, optional)

**Goal:** Schmidt-like opening scenes for the prepared designs, while edited designs keep Phase 1–2 quality.

### Work

1. **Bake pipeline:**
   - A Blender Cycles script (Metal GPU on the M4) imports each preset's room shell + static decor.
   - It bakes 1K lightmaps on UV1 (about 150–250 KB each). Cabinet/front lightmaps are baked **only for unedited presets**, keyed by a geometry + opening + recipe signature (Schmidt bakes fronts because its layouts are fixed).
   - Output goes to `public/shared/bakes/<preset>/<signature>/`.
2. **Runtime:**
   - Apply lightmaps when the signature matches.
   - On any structural edit, crossfade over about 300 ms to the Phase 1 dynamic lighting.
   - Room-shell bakes stay valid while room dimensions and openings are unchanged.
   - Finish changes keep the bake, because albedo swaps over the same lightmap.
3. **Per-preset polish:** window treatment (blinds producing sun stripes), exterior, decor composition, Hero tuning.
4. **Presentation readiness:**
   - Regenerate Home/embed imagery from final scenes.
   - Full laptop rehearsal in Chrome (offline reload, PDF, A/B).

### Effort and value

- **Effort:** about 6–8 days, mostly automated bake time.
- **Cost:** $0.
- **Download:** about +1.0–1.5 MB.
- **Value:** high if meetings start from the prepared designs; lower if you mostly build designs live in front of owners. Decide after the Phase 2 gate. Skipping it loses nothing already built.

### Visual acceptance

- The five preset heroes, side by side with the Schmidt reference at the same framing class, show comparable corner shading, contact shadows, window light pattern and exterior.
- On edit, the scene changes smoothly with no stale shadows.
- Home imagery matches the live first view.
- The Chrome rehearsal on the M4 passes end to end.

## 9. Expectations

- **Live, edited designs:** close to IKEA-level credibility after Phases 1–2. Generated garments and appliances will be convincing at normal viewing distance, not artist-perfect in every close-up.
- **Prepared designs:** Schmidt-like after Phase 3.
- **Not achievable at $0 or live:** Cosentino's photographic panoramas, and brand-accurate appliances.
- **Biggest single visible step:** Phase 1. It needs no Blender work and is the first gate you review.

## 10. Classification of findings (for reference)

- **Bugs (fix in Phase 1):**
  - B1: island worktop line and end patch.
  - B2: oak shelf edge visible through the wardrobe door/drawer gap.
  - B3: flattened oak veneer colour map.
  - B4: flat normal/roughness maps where real maps are documented.
  - B5: non-tiling travertine and laminate maps.
  - B6: light front gaps.
  - B7: stale Home thumbnails.
  - B8: empty canvas without a loading cue.
- **Visual-quality shortcomings:** composition and camera, lighting balance, missing AO, room completeness, primitive props, flat lacquer.
- **Architectural issues:**
  - No shared live/capture post-processing pipeline.
  - `Scene.tsx` (1,121 lines) and `Designer.tsx` (2,246 lines) are hard to change safely.
  - No art pipeline; the model kit is generated by code.
  - No committed matched-capture tool.
- **Optional enhancements:** Phase 3 bakes, runtime room-shell lightmapping (`ProgressiveLightMap` prototype), a panorama inspiration mode (not recommended), tablet tuning.
