# Kitchen and wardrobe realism — phased implementation plan

13 October 2026 · Planning only · No implementation or asset acquisition authorized by this document

## 1. Decision and intended result

Keep React Three Fiber, Three.js, procedural furniture and the existing sales application. Build **two carefully authored furnished-room presentations around the customer's actual editable design**: one kitchen and one wardrobe. Use detailed, lightweight models for the few objects that attract attention, physically sized materials, lighting that belongs to each room, and individually editable wardrobe storage. Extend the existing camera controls rather than replacing them.

The first visual milestone should make a business owner want to explore the product within five seconds. The next minute should demonstrate a useful sales conversation: change finishes, inspect construction/storage, compare alternatives, then see the corresponding indicative offer in Albanian, English or German. Company branding and the prepared offline experience remain part of that demonstration.

The initial art direction is a proposed starting point, not a claim about every Kosovo customer's taste: warm neutral plaster, restrained oak, believable daylight, carefully balanced dark hardware, and little clutter. Offer a warmer and a darker finish combination using the same room assets. Keep furniture larger and more prominent than the surrounding decor, especially on a 10–13-inch tablet.

### Chosen approach

| Layer | Approach | Reason |
| --- | --- | --- |
| Cabinets, fronts, shelves, drawers, worktops | Continue procedural geometry; improve edges, construction, mapping and hardware | Arbitrary dimensions, layouts, opening interactions and pricing remain useful |
| Room | Authored room recipe applied to a procedural shell; selected static props in GLB | A believable room can adapt to changed dimensions without stretching an entire furnished model |
| Appliances, stools, pendants, garments | Small licensed or original GLB models with physical dimensions, anchors and reduced-detail variants | Large visual gain at the objects where primitives are most noticeable |
| Lighting | Window-directed dynamic key light, restrained fill, room-specific reflections, localized interior occlusion | Editable furniture cannot safely inherit fixed cabinet lighting maps |
| Static lighting maps | Optional for immutable decor or an exactly matching prepared room shell; never required for arbitrary designs | Adopt the useful part of Schmidt's method without baking wrong shadows into edited layouts |
| Finishes | Global defaults → zone override → cabinet override, resolved by shared pure functions | Rendering, pricing, PDF and comparison must describe the same design |
| Wardrobe storage | Stable component entities and catalog rules, with touch controls and precise numeric placement | Adopt IKEA's component-selection idea while retaining custom-furniture pricing |
| Camera | Extend existing bounds fitting, smoothing, inspection and gesture handling | These features already exist in this checkout |

Do not switch engines, replace the editor with a panorama, build a second disconnected “beautiful” furniture scene, add real-time path tracing/GI, simulate cloth, or run reflection captures continuously. A Cosentino-style inspiration panorama is a separate possible future product, outside this plan's first release.

## 2. Evidence checked and qualifications

Read the referenced chat **Research 3D visualizer competitors** and its [evidence report](</Users/ibrahimi/.codex/visualizations/2026/10/13/01a135e8-52a0-73d2-971d-8ba08f1e4752/rea-visualizers/REPORT.md>). Reviewed the project Markdown set: `README.md`, `3d_designer.md`, `public/shared/ASSETS.md`, `verification/furniture-only/REPORT.md`, its deletion inventory, and the kitchen-studio and furniture-sales reports. Earlier reports are historical evidence, not current performance measurements.

Current verification used the working tree based on commit `66d846d`, including pre-existing uncommitted camera, editor, interaction, CSS and translation changes. Those changes are part of this planning baseline and must not be overwritten. The lockfile resolves Three.js 0.180.0, R3F 9.8.1, drei 10.7.9 and camera-controls 3.1.2. No engine upgrade is a prerequisite.

| Report finding | Current verification | Planning consequence |
| --- | --- | --- |
| Sparse environment | `Scene.tsx:Decor` returns null, but `RoomDetails`, `StudioWindow`, `StudioDoor`, floors, skirting, stools and pendants already exist | Improve an existing room presentation; do not describe it as having no surroundings |
| Simplified focal models | `Appliances.tsx:Oven`, `Fridge`, `Garment`; garments are shallow extruded shirt outlines | Replace selected visible objects, keeping procedural fallbacks and cabinet geometry |
| Stretched panel grain | `Materials.tsx:SurfaceMaterial` defaults to repeat `[1,1]`; `Primitives.tsx:Box` supplies no physical panel mapping; floor also uses Box | Physical mapping applies to floors and cabinet panels, not just doors |
| Countertop mapping already exists | `Worktops.tsx` creates extruded connected slabs/cutouts; `Materials.tsx` samples world XZ at a fixed factor of 0.4 | Preserve continuous slabs; replace fixed scale and provide proper vertical edge mapping |
| Generic lighting | `StudioEnvironment` generates studio panels; `StudioSun` uses a fixed offset; `WallMesh` does not cast shadows | Introduce room-specific light directions and reflection content |
| Interior depth | Direct render path in `Rendering.tsx`; contact shadows are near the floor; no dedicated interior AO/lightmap pipeline | Add localized cavity treatment and dynamic shadows, not simply more ambient light |
| Storage editing is module-level | `storageMeasurements` computes fixed rails/shelves/drawer counts; `CabinetSchema` has no interior entity list | A component editor needs schema, validation, state, pricing and persistence work |
| Finishes are global | `CabinetMesh`, worktops, pricing and proposal summaries read `design.style` | One shared resolver must precede independent finish UI |
| Camera needs polish | `Controls` already uses smooth `setLookAt`, bounds, focus, custom wheel/pinch recentering and `smoothTime=0.2`; taps open, double-click focuses | Preserve the recent behavior; add touch-visible inspection, room-safe paths and reduced motion |
| Adaptive quality exists | `quality.ts` moves between balanced/high based on moving-frame samples; lightweight is manual | Budget assets first; avoid replacing existing behavior with an uncontrolled quality switch |

Additional source findings:

- The plinth is always rendered dark in `CabinetMesh`, including when the catalog choice is “Matching fronts.” Resolve matching appearance explicitly while preserving its pricing semantics.
- The current backsplash catalog is only `none` or `stone`, whose label is “Matching worktop.” Using the countertop material is therefore intentional for current data. Encode this relationship explicitly before introducing genuinely independent backsplash decors.
- `furnitureResponse` groups the lacquer tier into a comparatively glossy response, while its UI name is matt lacquer. Review finish metadata and visual calibration; do not assume material parameters alone establish a correct supplier appearance.
- Presentation presets currently construct `room.openings: []`; Scene invents decorative windows on unoccupied walls when no openings exist. Authored lighting must distinguish staged openings from customer-specified openings. A visual window is not currently evidence of a validated architectural opening.
- `layout.ts:bounds` assumes 4 cm above base cabinets, while rendered worktops have tier-specific thickness. Share a thickness-aware bounds helper before changing worktop zones or camera clearance.
- `Rendering.tsx` measures motion by traversing scene objects every active frame. A much larger prop scene would increase this CPU cost. Replace that sampling trigger with explicit camera/animation/edit activity as part of optimization.
- A/B capture mounts another temporary Canvas; new models, decoders and reflection resources must be included in the peak-memory budget, not just the visible scene.

### Current checks

- `pnpm test`: **82 tests passed across 10 files** on this working tree.
- `pnpm exec tsc --noEmit`: **passed**.
- @Browser loaded the Vite development entry `/src/main.tsx` and `/@vite/client` from `http://127.0.0.1:5173`; this was current development source, not a claimed production/SW verification.
- At the confirmed **1024 × 768** viewport, kitchen and wardrobe displayed without horizontal document overflow. Wardrobe Interior view was inspected and restored. No warning/error entries were returned by the checked tab log query.
- A portrait viewport request did not change the showroom tab's reported 1024 × 768 dimensions. **Portrait was not verified in this pass.** It remains an acceptance gate below. Temporary viewport override was reset.
- Existing `dist` measured **4,645,982 shipped bytes**, **4,613,889 unique precache bytes**, 85 precache URLs. These are current on-disk output measurements, **not a fresh build of the audited source**. Previous Markdown size/test counts differ and should not be copied as current.
- No physical-device FPS, GPU-memory, thermal, native-share or new production-offline measurements were made. Unit tests do not prove visual quality.

Baseline images: [kitchen at 1024](</Users/ibrahimi/.codex/visualizations/2026/10/13/01a13625-e091-7772-b8e4-7c2571573b2a/showroom-plan/kitchen-current-1024.png>) · [wardrobe interior at 1024](</Users/ibrahimi/.codex/visualizations/2026/10/13/01a13625-e091-7772-b8e4-7c2571573b2a/showroom-plan/wardrobe-interior-current-1024.png>).

### Competitor evidence boundary

The supplied report supports Schmidt's prepared furnished scenes, second-UV lighting maps and bounded reflection probes; IKEA's component/product entities and individually selectable storage; and Cosentino's layered panorama approach. Its REA analysis was of acquired public scripts, with documented semantic-analysis limits, not private source or measured tablet performance. No fresh REA pass is necessary to choose this architecture. Reuse REA only if a future implementation decision genuinely depends on an unresolved competitor mechanism; keep all live interaction in @Browser. Do not copy competitor geometry, textures, scene layouts or code.

## 3. Delivery order and dependencies

Each phase produces a runnable review point after implementation is separately authorized. Effort is an engineering/art estimate, not a delivery promise; sourcing, original modeling and physical-device availability are the largest uncertainties.

| Priority / phase | Deliverable | Depends on | Rough effort | Exit gate |
| --- | --- | --- | --- | --- |
| P0 / 0 | Baseline, measurement, compatibility and render contracts | None | 1–2 days | Reproducible fixtures, preserved prices/state, measured render baseline |
| P0 / 1 | Correct physical materials and visible construction | 0 | 2–4 days | Grain/edges/plinth/matte-gloss close-ups pass |
| P0 / 2 | One excellent kitchen and one wardrobe room, focal models | 0–1, authorized asset pipeline | 4–7 days plus asset work | Convincing full-room images and working dimension edits |
| P0 / 3 | Room lighting, reflections and interior depth | 1–2 | 3–5 days | Light direction, open interiors and moving shadows pass within budget |
| P1 / 4 | Separate finish zones with accurate sales output | 0–1; visually reviewed in 2–3 | 3–5 days | Editor, image, price, A/B and PDF agree |
| P1 / 5 | Individually editable wardrobe storage | 0, 3–4 shared resolver/contracts | 5–8 days | Component fit, pricing, history and touch editing pass |
| P1 / 6 | Camera polish, full sales integration, tablet/offline release gate | All above | 3–5 days | Owner visual review plus real-device rehearsal |

**First substantial visual review: end of phase 3.** Do not hold room/material improvements until the larger storage editor is finished. Use measurements throughout; phase 6 is final validation, not the first performance check. Rough total: 21–36 focused working days plus uncertain asset/modeling time. Stop adding decorative detail when budgets or clarity deteriorate.

## 4. Phase 0 — protect the product and establish contracts

1. Record the current working-tree diff and exact source hashes; create fixed-ID, non-personal fixture designs from the five presentation presets. Keep a v1 design, v2 design, both brands, share payloads and A/B records as compatibility fixtures. Do not regenerate or reset existing user drafts.
2. Add a development-only render profiler to `src/app/PreviewStudio.tsx` and new `src/scene/RenderMetrics.tsx`. Record moving-frame p50/p95, renderer calls/triangles, texture/geometry counts, scene-ready time, capture peak and estimated texture/render-target bytes. Separate main pass from shadow/probe passes. Memory counters are estimates, not a measurement of total system GPU memory.
3. Define one render input assembled from `DesignDocument + Catalog + room recipe + quality`. Furniture dimensions/identity, resolved finishes and interior components feed both the image and commercial output. Props, camera motion and opening progress are presentation state and do not enter furniture pricing.
4. Establish per-scene resource ownership: shared decoded model/texture cache, reference-counted geometry/materials, per-instance transforms, disposal of obsolete render targets, and no mutation of a shared GLTF material for a single cabinet override.
5. Capture the baseline on the actual intended iPad and Android tablet as soon as available. Until model/OS are identified, use a provisional baseline of an iPad 9th generation and an Android tablet with 4 GB RAM in roughly the Galaxy Tab A8 class. These are test-target assumptions, not verified performance claims or purchasing recommendations. The actual weakest meeting device becomes the release gate.

**Exact changes:** extend `src/app/PreviewStudio.tsx`, `src/scene/Rendering.tsx`, `src/scene/quality.ts`, `scripts/check-budget.mjs`; add `src/scene/RenderMetrics.tsx`, `src/scene/resources.ts`, `tests/fixtures/realism/`, `verification/showroom-realism/BASELINE.md` and later measured JSON/images. Keep profiler code out of production routing.

## 5. Phase 1 — physical materials and credible construction

### Material data and mapping

Extend `MaterialSchema` in `src/catalog/types.ts` with optional, validated metadata:

```ts
mapping?: {
  tileSizeCm: [number, number]; // positive physical width/height of one repeat
  grain: 'none' | 'vertical' | 'horizontal';
  variation: 'none' | 'stable-offset';
};
response?: {
  roughness: number;
  normalStrength: number;
  clearcoat: number;
  clearcoatRoughness: number;
  envMapIntensity: number;
};
matches?: 'front' | 'countertop'; // e.g. matching plinth or backsplash
aoMap?: LocalAssetPath;
```

Treat these as proposed contracts, not implemented types. All numeric response values receive bounded schemas. Existing entries retain current behavior until their metadata is deliberately populated. Do not invent measured supplier sizes: mark reused illustrative maps with an authored/calibrated scale and retain their illustrative status.

- Add `src/scene/materialMapping.ts` for physical UV calculation and deterministic offsets derived from cabinet ID + panel role. Work in metres in rendering, centimetres in design/catalog state, with conversion at the boundary.
- Extend `Primitives.tsx:Box` to accept panel mapping/role rather than passing a texture with a fixed 1×1 repeat. Map each face along its own axes, including rounded edges; front grain stays vertical across 40/60/90 cm widths and tall doors. Drawer fronts use a chosen consistent grain policy.
- Do not mutate global texture transforms per object. Prefer geometry UVs with shared GPU textures, or bounded material variants where necessary. Current per-Box texture cloning should be audited for upload/resource duplication before adding maps.
- Make the floor's repeat derive from room metres and tile dimensions. Preserve countertop continuity across each connected run; implement local top/edge UVs so a vertical slab edge does not collapse into a line of XZ sampling.
- Color textures use sRGB; normal/roughness/AO remain linear data. Use OpenGL normal orientation. Confirm map orientation, UV channels and shader hooks against the installed Three.js 0.180.0 source. A shared second UV set for AO/lightmaps must be explicitly assigned; do not assume a Babylon UV index maps directly to Three naming.
- Move material-response choices into `furnitureMaterials.ts` and catalog metadata. Calibrate chipboard/veneer, matt lacquer, Fenix, acrylic, laminate, compact and stone under the same neutral light, then check the room-lit result. Avoid double tinting baked color maps and excessive clearcoat on everything.

### Cabinet construction

Retain editable panels and existing gaps/bevels. Use small real-size edge highlights, a recessed back panel, shelf setbacks, credible drawer sidewalls and bottom, and economical hinge/runner/bracket details visible during inspection. Reuse/instance repetitive fittings. Reduce rounded-box subdivisions where the silhouette does not benefit.

Fix matching plinth appearance without changing its recess or allowance. Add explicit matching backsplash metadata before separate materials are introduced. Preserve worktop sink/hob cutouts; do not cover them with flat imported appliance planes. Use the same tier thickness in layout clearance and framing helpers.

**Exact changes:** `src/catalog/types.ts`, `src/scene/Materials.tsx`, `src/scene/Primitives.tsx`, `src/scene/furnitureMaterials.ts`, `src/scene/Worktops.tsx`, `src/scene/countertopGeometry.ts`, `src/scene/StorageDetails.tsx`, `src/designer3d/Scene.tsx`, `src/designer3d/layout.ts`, `src/designer3d/framing.ts`; populate both `public/brands/default/catalog.json` and `public/brands/druri-design/catalog.json`. Add `src/scene/materialMapping.ts` and `tests/material-mapping.test.ts`; extend `tests/realism.test.ts`, `tests/framing.test.ts`, `tests/assets.test.ts`.

**Acceptance:** matched close-ups of a narrow base door, a tall wardrobe door, shelves, drawer fronts and slab edges; grain has the same physical size instead of stretching to each panel; repeated doors do not have identical knots; finish changes do not randomize grain; no seams, swimming textures or changed cabinet dimensions. White fronts remain separable, graphite remains readable, gloss highlights differ visibly from matte without clipping to white.

## 6. Phase 2 — furnished rooms and focal models

### Two initial room recipes

1. **Kitchen:** refine the existing cashmere L presentation first; add a believable window/reveal, plaster walls, real-scale floor/skirting, limited countertop objects and detailed appliance fronts/sink/tap. Stage the existing island presentation with two stools and pendants using the same asset kit after the L view passes. Do not force an island or dining table into a small room.
2. **Wardrobe:** refine the straight wardrobe first; a restrained dressing-room setting with a small bench/rug where space allows, varied hanging clothes, folded textiles, shoes and storage boxes. Showroom view sells the room; Interior view makes storage legible. Adapt the same kit to corner/walk-in layouts after the first view passes.

Preserve every current layout. Non-featured layouts receive the same material/model improvements and a simpler safe room arrangement. No layout silently switches to an unrelated staged kitchen.

### Room and asset contracts

Add `src/scene/rooms/types.ts`, `resolveRoom.ts`, `RoomShell.tsx` and `RoomProps.tsx`; add `src/scene/assets/manifest.ts`, `ModelAsset.tsx` and `placement.ts`. Put authored recipes under `public/shared/rooms/kitchen-warm-v1.json` and `wardrobe-warm-v1.json` and model files under `public/shared/models/` only after sourcing is authorized.

Room recipe fields: version, ID, compatible furniture kinds/layouts, supported room range, finish defaults, staged opening recipe, prop anchors/exclusion volumes, light recipe, environment reference and camera shots. A presentation preset gains optional `roomSceneId`, actual `room.openings`, and `sceneRevision`. The design may retain `presentation.roomSceneId`; camera position itself stays transient.

Asset manifest fields: ID, revision/hash, local path, optional lower-detail path, native dimensions in metres, origin/up/forward convention, attachment anchors, bounding volume, material slots, quality level, triangles/draw calls/decoded texture estimate, source/license ledger key and `quotedProduct: false` for decoration. No remote URLs are loaded at runtime.

- Keep the existing room/cabinet coordinate convention: design x/z are measured from a room corner and the renderer translates the group to center it. Convert anchors once. GLBs are Y-up, metre-scale, +Z front, with declared floor/front/countertop origins.
- Attach appliances to module slots and worktop cutouts, not global coordinates. Select models by their fit ranges. Do not distort a fixed 60 cm oven into a 40 cm unit; hide/fallback or reject an incompatible product selection with a useful message.
- Attach clothes to rail components and boxes to shelf surfaces. Deterministic distribution must follow available width, rail height and shelf clearance; keep hems/shoes clear of drawers and floor.
- Place room props only in valid free zones after cabinet/door/drawer swept-envelope checks. Reposition or omit decor on room/layout changes; never move the customer's cabinets to accommodate decor. Decorative objects should not intercept furniture selection.
- A staged window belongs to an explicitly chosen presentation recipe. User-entered openings take precedence. Do not invent sunlight through a wall that the customer explicitly defined as solid.
- Use isolated loading boundaries and procedural fallback models. A missing stool must not blank the entire Canvas. A missing quoted component/model remains a visible compatibility issue; decoration can be omitted without changing the quote.
- Give imported models reusable mesh/material resources and per-instance transform wrappers. Use instancing for garments/boxes/handles where material and geometry match. Avoid transparent clothing cards and excessive hidden geometry.

**Other existing files:** `Scene.tsx` becomes composition glue while `RoomShell`/`RoomProps` take over relevant room helpers; update `Appliances.tsx` to asset-backed wrappers with its existing primitives as fallback, `StorageDetails.tsx`, `presets.ts`, `PreviewStudio.tsx`, catalog preset records, `tests/showroom.test.ts`, and new `tests/room-placement.test.ts` / `tests/model-manifest.test.ts`.

**Acceptance:** no floating stools, stretched appliances, fabric intersecting shelves, unsupported cabinets, lighting fixtures without credible attachment, or decor obstructing drawers. At 1024 × 768 furniture is the visual subject; a 2× inspection view reveals useful construction detail. Resize/re-layout the room and confirm it remains the same editable product. Opening fronts exposes real geometry, not a photograph or a duplicate closed model.

## 7. Phase 3 — lighting, reflections and interior depth

Add `src/scene/lighting/RoomLighting.tsx`, `RoomEnvironment.tsx`, `InteriorOcclusion.tsx` and `lightingRecipe.ts`. Extract/replace `StudioSun` and `StudioEnvironment` through this boundary; extend `Rendering.tsx`, `RunLights.tsx`, `quality.ts` and `Scene.tsx`.

1. **Direct lighting:** derive the key direction from the recipe's real/staged window and room orientation. One shadow-casting directional light per scene. Set its bounds from furniture plus relevant room geometry; minimize bias/peter-panning. Existing RectAreaLights remain non-shadowing fill for under-cabinet strips, with a strict count. Wardrobe point lights must be capped/combined rather than growing one light per cabinet without limit.
2. **Cutaway/shadow separation:** visible walls may disappear for editing while an independent shadow shell preserves a consistent room. Prototype a shadow-only shell with no camera color/depth output and verify it in the installed renderer. Simply setting a wall group's `visible=false` will not provide a reliable shadow shell. Window apertures remain real holes. Check exterior/top views as well as the hero shot.
3. **Reflection environment:** start with one room-authored, low-resolution environment per room, with brightness and orientation aligned to the window. It supplies plausible rough reflections, not exact mirror geometry. For edited room geometry, use one bounded 128/256 px runtime cube capture after loading or an explicit layout/room change, debounced and budgeted; fall back to the authored map if capture is too slow. Do not capture every pointer frame, door animation or material hover. Avoid self-feedback during probe capture and dispose the previous PMREM target.
4. **Interior occlusion:** start with restrained per-cavity AO/vertex treatment derived from the current shell and stationary shelf positions. Recompute on structural interior edits. Apply to indirect response, not as black paint on the base color. Keep moving fronts/drawers separately lit; do not bake a closed door's shadow into an open compartment. Combine with true shadow casting and geometry setbacks. Low-quality mode retains inexpensive cavity contrast even when dynamic shadows are disabled.
5. **Optional prepared-room lightmaps:** use only after the dynamic lighting baseline passes. Bake indirect contribution for immutable room/decor geometry with a separate UV channel and a geometry/light-recipe signature. Do not bake cabinet shadows into room maps that survive cabinet movement. Dimension/opening/static-object changes invalidate the map; use the dynamic fallback. Never non-uniformly stretch a lightmapped whole room.
6. **Postprocessing decision:** no bloom/SSR or full-screen AO dependency for the first pass. If cabinet-local AO cannot produce acceptable depth, prototype half-resolution SSAO behind a high-quality flag, measure its cost, and retain the direct-render fallback. Any composer must also be used by export/capture so screenshots do not have a different appearance. Do not add it merely because a competitor has a shader with a similar name.

For mirrors/glass, start with opaque or mildly transparent approximations appropriate to the viewing distance. Accurate planar mirrors and refractive multi-layer glass are deferred; do not market a cubemap as an exact mirror.

**Acceptance:** the primary shadow direction agrees with the visible window; cavities are darker than exposed faces but remain readable with LEDs off; drawer movement changes shadows and never leaves painted shadow ghosts; chrome reflects recognizable room brightness; black matte is not featureless and glossy fronts are not uniformly white. Validate all three camera presets, closed/open states and manual performance mode. No visible lighting jump when cutaway walls hide.

## 8. Phase 4 — independent finish zones and truthful offers

### State and resolution

Keep `design.style` as the global default. Introduce a Design v3 schema with optional `finishZones`, optional per-cabinet `finishOverride`, and optional `presentation`. Proposed zone keys are `base`, `wall`, `tall`, `island`, `wardrobe`. Resolve island before level; all other zones follow cabinet level. Cabinet front/carcass/handle/profile/plinth overrides use catalog IDs, never inline material blobs.

For worktops, use `worktopFinishes.main` and `.island` (finish ID) rather than an arbitrary per-cabinet countertop override in this release. Each connected slab has one finish/thickness; split only at a defined seam or disconnected island. Backsplash can be none, matching that run's worktop, or an explicit catalog material when such materials are added. Keep product selection and matching semantics distinct.

Add `src/designer3d/finishes.ts` with pure contracts:

```ts
finishZone(cabinet: Cabinet): FinishZone;
resolveCabinetStyle(design, cabinet, catalog): ResolvedCabinetStyle;
resolveRunStyle(design, run, catalog): ResolvedRunStyle;
validateFinishReferences(design, catalog): ValidationIssue[];
applyFinishChange(design, scope, patch): DesignDocument;
```

Precedence: explicit cabinet override → zone override → global style. Matching plinth derives its appearance from the effective front, while its price still comes from the selected plinth catalog record. Resolve compatibility after family changes: retain an allowed decor or visibly select the first valid decor, as today.

Add `FinishScopeControl.tsx` and extract shared material controls from `Designer.tsx` as appropriate. Expose All, Base, Wall, Tall, Island and Selected only when relevant. A global-default change leaves existing overrides intact; provide a clearly named “Apply to all / clear overrides” action as a single undo step. Show a Mixed state instead of a misleading active swatch. Curated collections explicitly apply to all or to the selected scope; they never silently erase overrides.

### Pricing and documents

Update `src/pricing/index.ts` to calculate each cabinet using its effective front family/decor, carcass and profile. Group lines by module + dimensions + effective finish signature, not module/dimensions alone. Group handle/plinth quantities by effective selection and worktops by run/finish using the existing indicative running-length rules. Room props do not become billable; appliance display models do not silently change `appliancePackage`.

Update `src/documents/finishes.ts`, `offer.ts`, `src/app/Summary.tsx` and `Compare.tsx` to list zone/material associations and corresponding quantities. A/B cards need an understandable mixed-finish description. Preserve discount → installation → VAT ordering, current range/exact display, company details and indicative wording.

Update `Worktops.tsx` and `countertopGeometry.ts` so finish/thickness partitioning does not create overlaps/gaps at corners. Extend thickness-aware bounds and validation. Reuse the resolver in Home, MaterialSwitcher and embed instead of adding a visually different material path.

**Acceptance:** warm-white wall cabinets + oak base cabinets + dark island survive undo/redo, reload, share, A/B selection and PDF. Changing only island finish changes only island material/pricing. A legacy uniform design has exactly its previous total. Unsupported finish IDs fail compatibility explicitly instead of falling back to a different priced material.

## 9. Phase 5 — individually editable wardrobe storage

### Catalog and document data

Add optional catalog `interiorItems` and `interiorPresets`. Each item contains ID, translated label, kind (`shelf`, `rail`, `drawer`, `basket`, `divider`), compatible module types, supported/min/max widths and depths, occupied height, required clearances, mounting step/origin, material/asset reference and pricing rule. Use illustrative rules until a furniture business supplies actual hardware specifications; do not claim manufacturing fit.

Add `Cabinet.interior?: { version: 1; components: InteriorComponent[] }`:

```ts
type InteriorComponent = {
  id: string;        // stable within the design
  productId: string; // catalog interiorItems ID
  yCm: number;      // from the internal cabinet floor
  span?: { xCm: number; widthCm: number }; // initially full width unless divided
};
```

Dimensions that follow the cabinet are derived by one geometry/layout function, not stored twice. Optional divider support comes after full-width shelf/rail/drawer/basket editing is reliable. Set bounded arrays (initially 32 components per cabinet, 512 per design) and validate total shared payload size. Do not reduce the existing 200-cabinet design-schema limit; render unusually large designs with reduced decoration and quality.

Absent `interior` means the existing procedural module preset. `resolveInterior(cabinet,module,catalog)` creates deterministic component descriptors matching today's geometry/counts, without saving a rewritten design on load. First edit materializes those descriptors with stable IDs. Standard presets and manual editing use that same resolver.

### Editing, validation and selection

- Add `interiors.ts`, `interiorValidation.ts`, `InteriorEditor.tsx` and `useInteriorInteraction.ts` under `src/designer3d/`; add `InteriorComponents.tsx` under `src/scene/`. Keep `storage.ts` as the shared measurements facade, now deriving clearances/counts from resolved components.
- Extend the store with transient `selectedInterior: {cabinetId, componentId} | null` and opened component IDs. Do not serialize hover, open progress or camera focus. Reconcile component selection/open state on undo, cabinet replacement and deletion.
- In Interior view, tap a shelf/rail/drawer/basket to select that component. Stop event propagation so it does not toggle the cabinet front. Provide Move up/down, Height, Replace and Remove controls plus an accessible component list. Make Add component a large touch action; dragging is optional refinement, not the only workflow.
- Snap to catalog mounting positions; do not assume every manufacturer uses a 32 mm system. Validate inside-panel bounds, thickness, shelf/drawer overlap, rail/garment clearance, drawer extension, and sliding-door access. Preview a drag; commit one history entry on release. Reject invalid edits without changing the last valid design or price.
- On cabinet resize, keep compatible components and reject a change that would invalidate the rest, explaining the problem. Offer an explicit “reset interior to compatible preset” alternative; never silently discard a priced basket. Layout regeneration keeps its existing explicit replacement semantics and must warn when custom interiors would be replaced.
- Clothing is decorative population derived from available space; it is not a capacity claim or a priced storage product. Turning decoration off never changes the storage inventory.

### Component pricing without double charging

Do not add prices for shelves already included in the current module rate. Introduce a catalog module `interiorPricing` contract:

- `includedPresetId`: components already represented by the existing module price;
- `additionPrices`: item unit rates (or references to item rates);
- `removalCredits`: explicit item credits, defaulting to zero; zero means removing an included item does not reduce the base package;
- bounded catalog rules that prevent total credits exceeding the included interior allowance.

Calculate an additions/credits difference from the included preset using item quantities/size class, not rendering mesh counts. Moving a shelf is free. A replacement removes one inventory item and adds another according to these published rules. Negative credit lines must have clear labels, consistent quantity × unit price, and tested PDF formatting. Default components cause a zero adjustment, so every unchanged legacy quote remains identical. Keep existing module accessory charges separate; an item covered by `module.accessory` must not also become an interior surcharge.

Update `pricing/index.ts`, document finish/detail summaries, A/B descriptions and validators together. Future shell-plus-components pricing can be a separate explicit catalog model; do not reinterpret every existing `pricePerMeter` automatically.

**Acceptance:** select one shelf, move it one mounting position, add a basket, remove/replace a rail and open one drawer. Siblings remain unchanged; invalid overlap is rejected; price lines explain the delta; undo restores geometry and total. Check 180 cm and taller cabinets, narrow widths, sliding fronts, corner/walk-in context, both brands, all languages, share and offline reload.

## 10. Shared migration, persistence and capture work

These contracts begin in phase 0 and ship with the phase that introduces each field:

- `src/catalog/types.ts`: explicit v1/v2 legacy input schemas and v3 normalized output. Do not just change the existing `transform(() => 2)`. Catalog version remains 1 for additive optional fields with defaults; only enable interior editing where its additional catalog data validates. Unknown future design versions are rejected rather than silently stripped.
- New `src/catalog/migrations.ts`: pure `parseDesignDocument(input): DesignDocumentV3`, idempotent migration, reference validation after catalog load. Preserve original cabinet IDs, layout, environment, offer fields and dimensions. Do not regenerate furniture during migration. Missing new presentation fields use a safe default room.
- Update all read boundaries: `src/persistence/index.ts`, `src/sharing/index.ts`, `src/brand/index.tsx`, `src/designer3d/comparison.ts`, preset creation and store initialization. Share envelope may remain v1 with nested Design v3; document that old deployed apps cannot read v3 until updated. New code must still read old links.
- Keep existing localStorage keys and A/B IndexedDB names. Parse legacy A/B designs in memory and persist only after successful user action. Failed migration/capture/quota keeps the original record. Add render/room-asset revision to comparison-preview invalidation; catalog-only signatures miss a visual asset update.
- Share/A/B privacy exclusions remain unchanged: offers/customer details stay out. Do not encode model URLs, texture payloads or complete generated meshes. Keep existing decode limits (30,000 encoded characters / 150,000 decompressed characters), and enforce them on encode too with a localized explanation. Test typical custom wardrobes; do not introduce a backend link-shortener in this scope.
- `src/designer3d/CaptureAlternative.tsx`, `src/scene/Rendering.tsx`: capture only after models/textures/environment and camera animations are ready, with a bounded timeout. Preserve the current closed overall comparison policy. The screenshot must include the selected room, correct zones and storage configuration; hide selection aids. Suspend visible-scene rendering during temporary capture where safe and release the extra renderer/resources afterward.
- `src/brand/Setup.tsx`: shared models remain shared dependencies of the normal deployment, just like today's textures. Keep ZIP export carrying complete updated catalog fields. If brand-local assets are later allowed, either include their dependency closure in the ZIP or clearly require their deployed folder; do not export a broken catalog. No new supplier asset copying is implicit in brand setup.
- Extend `tests/core.test.ts`, `offers.test.ts`, `proposal.test.ts`, `comparison.test.ts`, `showroom.test.ts`, `interaction.test.ts`; add migration, finish-resolution and interior-fit tests focused on behavior, price invariants and invalid data.

## 11. Asset sourcing, rights and preparation

**This phase has not sourced, purchased, downloaded or generated any new model or texture.** The following is the authorized-later sourcing strategy, not an assertion that every needed model already exists in a library.

| Asset need | Preferred source/route | License/fit requirement | Initial allowance |
| --- | --- | --- | --- |
| Wood, stone, plaster, floor PBR | Reuse existing local maps first; then ambientCG / Poly Haven | Verify per-asset page, scale and CC0 provenance; preserve existing illustrative supplier notes | 1K maps, selectively 2K only if close-up demonstrates need |
| Room reflection environment | Original simplified room render/probe; CC0 HDRI only if it matches window arrangement | Rights to redistribute the derived environment; avoid unrelated exterior lighting | One compact environment per room; runtime fallback |
| Stool, pendant, bench, containers | Suitable Poly Haven CC0 models or original modeling | Commercial web redistribution, usable topology and physical dimensions | Small shared prop kit; reuse instances |
| Oven/fridge/sink/tap/hob | Original generic models first; supplier-authorized product files when a client provides them | Written permission for interactive web delivery, modification/optimization, offline redistribution and white-label client use | Fixed-size appliances, explicit slot anchors and fallbacks |
| Hanging clothes, folded textiles, shoes | Original/commissioned low-poly set; individually verified CC0 assets if suitable | Rights cover meshes and textures; no unlicensed logos or scanned branded designs | 3–4 hanging silhouettes, 2 folds, 1 shoe pair, 2 boxes |
| Supplier-authentic decor | Client/supplier-provided swatch/scan | Explicit product identity, repeat dimensions, allowed use and redistribution | Later calibrated replacements; physical sample still required |

Official pages read through @Browser on 13 October 2026: [Poly Haven asset license](https://polyhaven.com/license) permits commercial use and asset redistribution under CC0; its website text/logos/example renders are not automatically covered. [ambientCG license](https://docs.ambientcg.com/license/) states CC0 applies to its downloadable assets and material preview renders, including distribution of raw files. Record the specific asset page and license snapshot during later acquisition. A library's license does not establish that a model fits an oven opening or depicts a supplier's product accurately.

Avoid marketplace assets whose license permits rendered images but prohibits distributing extractable source assets. Web GLBs/textures remain downloadable; obfuscation does not fix that restriction. Do not select CC-NC/editorial-only files for this commercial white-label application. Prefer CC0 or original work to avoid a complicated per-client attribution/share-alike pipeline. Paid assets or commissioned work require a concrete future scope and budget; no purchases are assumed here.

### Asset acceptance pipeline after authorization

1. Shortlist only the specific missing objects. Record source, author, license/version, acquisition date, permitted uses and whether textures have separate rights.
2. Inspect in Blender: native units, applied transforms, normals, UVs, closed silhouettes, material count, moving pivots, dimensions, and absence of hidden camera/light payloads. Remove unseen internals only when opening interactions will not expose them.
3. Retopologize/reduce, atlas where appropriate, create lower-detail variants, preserve important silhouettes and normal detail. Export glTF/GLB with PBR metallic/roughness materials. Avoid cloth rigs for static garments.
4. Prefer Meshopt geometry compression if savings justify the decoder cost; use existing Three GLTFLoader support. KTX2/Basis is optional after measuring GPU texture pressure, not an automatic extra dependency. Do not ship both Draco and Meshopt unless content requires it. WebP reduces transfer bytes but is still decoded for GPU use.
5. Self-host every decoder/transcoder JS/WASM file; never rely on drei/loader CDN defaults for offline use. Include worker/transcoder dependencies in the precache dependency audit.
6. Add `public/shared/asset-manifest.json`, append provenance to `public/shared/ASSETS.md`, and store required license texts under `public/shared/licenses/`. Include source/optimized hashes, transforms, native dimensions, LOD counts and decoded-size estimate. Store large Blender sources outside runtime public assets.
7. Validate local paths, units, metadata and licenses; inspect in the actual room under both quality levels. Approve screenshot quality and budget together before replacing the fallback.

**Dependencies:** existing R3F/drei/Three and camera-controls suffice for the base approach. Blender is an offline authoring tool, not a runtime dependency. Optional pinned development tools: glTF Transform/meshoptimizer for optimization; optional Basis transcoder for KTX2. Record and ship their required notices if used. No new animation library, remote asset service, commerce SDK or runtime asset account is needed.

## 12. Performance and offline budgets

These are proposed acceptance targets, not measured achievements. Benchmark representative designs of roughly 12–20 kitchen modules and 4–8 wardrobe modules, then stress the existing maximum supported design separately. Full-detail decoration is conditional on scene cost; valid large designs must remain editable with simpler staging.

### Delivery budget

Keep the current **9,000,000-byte working target and strict less-than-10,000,000-byte shipped/precache ceiling** in `scripts/check-budget.mjs`. The measured existing dist is about 4.65 MB, leaving approximately 4.35 MB to the working target, subject to a fresh implementation build.

| Increment above measured existing dist | Initial allocation |
| --- | ---: |
| Both room/prop/model kits, including model-embedded textures | 2.50 MB |
| Additional standalone/replacement material maps, net increase | 0.75 MB |
| Environments and optional static-lighting maps | 0.40 MB |
| Incremental runtime/decoder code and manifests | 0.35 MB |
| Resulting target total | about 8.65 MB, leaving about 0.35 MB working headroom |

These allocations overlap neither embedded nor standalone texture bytes. Optimize or reduce the decorative kit if it does not fit; do not quietly raise the ceiling. Retain the 6 MB per-file Workbox ceiling; target each model below 1 MB. Future optional high-resolution packs need a separate cache/readiness design and explicit budget decision; they are not required for this release.

### Tablet rendering budget

| Metric | Balanced target | Fallback / test rule |
| --- | --- | --- |
| Sustained active motion | p95 frame time ≤33 ms; aim ≤22 ms for ordinary orbit | Measure 10-minute warm sessions on both physical devices; do not count idle demand frames as low FPS |
| Input acknowledgement | ≤100 ms for selection/controls | No network dependency; warm material visible ≤200 ms; report slower cold asset loads |
| Visible scene triangles | ≤250k closed; ≤350k interior/open | Reduced-detail props/garments first; omit invisible interior population |
| Main-pass draw calls | ≤250 closed; ≤400 open | Shared materials, instancing and culling; measure actual passes rather than mesh count |
| Total draws including shadows | target ≤650 closed / ≤1,000 open, excluding separately timed probe refresh | One shadow caster; reconsider any feature exceeding frame-time budget even below draw target |
| Estimated active textures | ≤128 MiB including mipmaps | 512/1K garments/props; selected 2K only with measured headroom |
| Estimated textures + targets + geometry | ≤192 MiB steady, ≤256 MiB capture peak | Count temporary Canvas/probe/PMREM and decoded fallback resources; measure leaks separately |
| DPR | balanced ≤1.5, high ≤1.75, manual performance 1 | Keep current quality intent; add hysteresis/cooldown, adapt only during measured motion |
| Lights/shadows | 1 shadowed directional, 1024 balanced / 2048 high; ≤3 LED fill lights combined | Lower shadow resolution and decor LOD before forcing manual lightweight mode |
| Probe | One active environment; ≤256 px cube, ≤128 px on slower tier | Refresh only on meaningful structural changes; target ≤150 ms total with no >50 ms UI stall; otherwise use authored fallback |
| Warm prepared offline scene | interactive within 2 seconds target | Actual tablet measured; persist only supported scene state |
| Cold network scene | core furniture usable within 5 seconds at a documented 10 Mbps/80 ms test profile | Stage nonessential props progressively; do not equate shell loaded with scene ready |
| Stability | No context loss/reload over 10-minute session and 30 material/layout changes | Geometry/texture counters settle near baseline after repeated routes/captures; investigate >10% residual growth after settling |

Profile CPU and GPU separately where supported. Browser context/renderer counters do not establish the device's actual physical GPU memory consumption. Do not claim 60 FPS or general tablet compatibility from desktop emulation.

### Offline integration

Update `vite.config.ts` asset inclusion/patterns for GLB/GLTF/BIN/KTX2/WASM and any selected environment format. `includeAssets: shared/**/*` already catches public assets, so inspect the generated Workbox manifest rather than assuming an extension omission is currently a bug. Ensure lazily loaded models and their decoders are all precached, local, versioned and below the file limit.

Add `scripts/check-scene-assets.mjs` to walk manifests and verify dependency closure against the built precache, missing paths, measured sizes and license entries. Keep all assets needed for both initial rooms in the prepared offline bundle. Loading only the kitchen once must not leave the wardrobe dependent on an external decoder later.

`src/pwa/Status.tsx` currently accepts service-worker readiness as a ready signal. Extend readiness to confirm the current release's required asset set, with localized loading/failure feedback and retry; an old installed worker is not proof of new room-asset availability. Preserve prompted updates and drafts. Use content hashes/versioned filenames; never overwrite an old version's asset with incompatible bytes during an update. Do not activate a new worker mid-capture or mid-edit.

Required production test: build to a stable output, verify loaded entry hash and active SW version, wait for asset readiness, stop the origin, then reload and use both modules/materials/models, A/B, PDF and branding. Separately rehearse actual network-offline installed-PWA restart and update on the physical tablet. Messaging and first-time visits still require connectivity; do not send messages during testing.

## 13. Phase 6 — camera, touch and complete sales-flow polish

Keep `framing.ts` as pure camera math and extend tests instead of embedding all decisions in Scene. Add `src/designer3d/cameraShots.ts` for room shots and a small transition coordinator in `Controls` or an extracted `SceneControls.tsx`.

- Author Hero, Overall and Inspection shots for the two rooms, with Front/Top retained for editing. Fit furniture plus open-front/drawer extents and account for the actual visible Canvas/sidebar area. Do not include every decorative object in framing bounds.
- Preserve current one-tap open behavior and deliberate focus. Add a visible “Inspect” action for touch users; double-click alone is insufficient. Selecting a shelf should not unexpectedly fly the camera through a door.
- Initial view appears already composed. Subsequent deliberate shot changes use approximately 450–700 ms easing, cancel immediately on touch/orbit, and respect reduced-motion preference with a snap or very short transition.
- Avoid straight-line camera travel through cabinets/walls. Use a tested retreat–orbit–approach path or safe intermediate point where required. Interrupted transitions end in a valid controllable state. Preserve the user's chosen view across material changes and viewport changes; explicit Overall remains the way back.
- Keep no continuous decorative motion. Demand rendering should become idle after camera/front animation settles. Stop animation/probe work in background tabs and recover gracefully after WebGL context loss.
- Review `src/app/style.css`, `Designer.tsx` and new scope/interior controls at landscape, portrait and phone sizes. Controls have at least 44 × 44 CSS-pixel touch targets; swatches have names/selected/mixed states, not color alone. Price and offer actions remain accessible without covering the furniture.
- Integrate the same room/assets/resolver into `Home.tsx`, `MaterialSwitcher.tsx`, embed, Summary, A/B and PDF. Regenerate thumbnails from actual final application scenes only after the visual milestone is approved for use. Keep screenshot framing consistent and verify offers in SQ/EN/DE, including ë/ç and long German labels.

**Exact supporting files:** `src/designer3d/framing.ts`, `Scene.tsx`, `Designer.tsx`, `useCabinetInteraction.ts`, `store.ts`, new `cameraShots.ts` / optional `SceneControls.tsx`; `src/app/style.css`, `Home.tsx`, `MaterialSwitcher.tsx`, `Summary.tsx`, `Compare.tsx`, `src/i18n/sq.json`, `en.json`, `de.json`, `src/documents/offer.ts`, `tests/framing.test.ts`, `tests/interaction.test.ts`, `tests/proposal.test.ts`. Finish documentation in `README.md`, `3d_designer.md` and `verification/showroom-realism/REPORT.md` after implementation, not during this planning pass.

## 14. Visual and functional acceptance matrix

Use the same fixed design IDs, camera shots, quality tier, viewport and exposure for before/after pairs. Capture full scene and detail crops separately. Approve visual quality at normal tablet viewing distance and at inspection distance; passing a UV/unit test is insufficient.

| Scenario | Required visual/functional evidence |
| --- | --- |
| Kitchen hero | Furnished room, clear cabinetry hierarchy, believable appliance scale; furniture fills roughly 65–80% of its scene's useful width without clipping |
| Kitchen details | Sink cutout/rim and tap contact, oven recess, real edge thickness, handle attachment, dark plinth recess, no floating fittings |
| Finish comparison | Matte vs acrylic and laminate vs stone differ visibly under fixed lighting; wood repeat remains physically consistent across cabinet sizes |
| Split finishes | Wall/base/tall/island colors change independently; connected worktops remain continuous and correctly thick; PDF/price labels match |
| Wardrobe closed/interior | Attractive closed fronts; open interiors show back/shelf depth, varied garments, credible folded objects and fittings; no identical giant grain pattern on every side |
| Storage edits | Shelf/basket/rail can be selected without opening unrelated doors; invalid fit rejected; price/undo/saved inventory agree |
| Lighting | Window/key/shadows/reflections agree; LEDs-off cavities remain legible; moving drawers do not retain static shadows |
| Camera | Hero → Inspect → Overall and Front/Top paths avoid geometry; rapid interruption and portrait resize do not reset the user's view unexpectedly |
| Layouts | Straight/L/U/parallel/island kitchens and straight/corner/walk-in wardrobes; min/typical/large rooms and door/window conflicts |
| Responsive UI | 1180×820, 1024×768, 820×1180 and 390×844; no horizontal overflow, clipped price, inaccessible scope control or touch target hidden behind an overlay |
| Commercial invariants | Legacy totals unchanged; component/zone deltas itemized; VAT/discount/installation ordering preserved; no decor charges; appliance-package selection remains explicit |
| Persistence/privacy | v1/v2/v3 load, history, shared URL, A/B restoration, brand isolation; no private offer information leaks into links or comparisons |
| Failure modes | Missing model, slow decoder, failed texture, quota exhaustion, interrupted capture, incompatible catalog and context loss retain valid design/previous A/B slot and useful feedback |
| Offline/update | Verified production entry/SW; both complete rooms available after origin shutdown; installed-device offline restart/update, capture and PDF checked separately |

Automation targets after implementation:

```sh
pnpm test
pnpm exec tsc --noEmit
pnpm build
pnpm check:budget
node scripts/check-scene-assets.mjs dist
git diff --check
pnpm preview --port 4173
```

The scene-asset checker is a proposed new script. Use the bundled Node/pnpm PATH documented in README when needed. New tests should exercise migration, texture scale math, fit rejection, price parity and export/capture behavior; do not substitute implementation-mirroring tests for visual review.

Perform browser acceptance in **@Browser only, never Firefox**. Record which tests were desktop browser checks and which were physical-device checks. Test native sharing up to the share sheet without sending. No deployment is part of this plan.

## 15. Decisions to confirm at the relevant implementation milestone

These do not block the written plan, and no answer is required to finish this planning task:

- Before sourcing: whether original/commissioned generic appliances and garments are acceptable, and a concrete asset/modeling budget if free sources are insufficient.
- Before supplier-authentic presentation: client-authorized material/product files, use rights and calibrated physical samples. Demo reference names are not certification or stock availability.
- Before release performance claims: the actual iPad/Android model, OS/browser and weakest device used in meetings.
- At the first visual review: whether the two rooms meet the owner's desired presentation style and whether the furniture, material difference and interior depth are convincing enough to continue expanding the kit.

Start implementation only after a separate instruction authorizes it. The recommended first batch is phases 0–3; then add finish zones and component storage without compromising the verified sales flow.
