> Scope revised 11 October 2026: the project is exclusively Kitchen and Wardrobe. This supersedes the original multi-category brief.

## Context: what I'm trying to achieve

I'm a freelance developer in **Kosovo**. I sell custom software to established businesses that make **kitchens, wardrobes and furniture**. I want to walk into a showroom with a phone or a tablet and show the owner a working tool that **already has their company name, logo, colors and products in it**.

Build a **white-label "Digital Showroom Designer"** web app dedicated to furniture:

1. **3D Kitchen & Wardrobe Designer**: a salesperson (or the customer at home) enters room dimensions, picks a layout, changes fronts, countertops and handles, and sees the result in real-time 3D with a live price estimate.

**This is a sales demo that has to feel like a finished product**, but it must be built so it can grow into the production version once a client signs.

## Who uses it

- **Showroom salesperson** on a tablet (iPad / Android, 10–13"), sitting next to a couple choosing a kitchen. Touch-first, big buttons, no tiny controls.
- **End customer** on a phone at home, including **diaspora customers in Germany/Switzerland** who get a share link.
- **Business owner**: not technical. They must find it impressive and simple.

## Languages & locale

- UI languages: **Albanian (default)**, English, German. Use an i18n system and keep all strings in translation files, never hard-coded.
- Currency EUR, format `1.250 €` / `1,250 €` depending on locale. Metric units (cm).

## Tech stack

- React + TypeScript + Vite
- Three.js via `@react-three/fiber` + `@react-three/drei`
- Zustand for state
- Tailwind CSS
- No backend for the demo. State lives in memory + localStorage + URL (for sharing).
- **PWA with offline support.** Showroom Wi-Fi in Kosovo is often unreliable, so the demo must work with no internet after first load.
- Deployable as a static site (Vercel/Netlify/Cloudflare Pages).

## White-label brand system (VERY IMPORTANT)

The whole app gets personalized from one folder per client, so I can rebrand it for a new business in **under 15 minutes**.

```
/public/brands/<slug>/
  brand.json
  logo.svg (or logo.png)
  catalog.json
  textures/...      (optional client-specific material photos)
```

Choose the brand with `?brand=<slug>`, a subdomain (`<slug>.mydomain.com`), or a build-time env var. Fall back to a neutral default brand.

`brand.json` example:

```json
{
  "slug": "druri-design",
  "companyName": "Druri Design",
  "tagline": "Kuzhina me porosi që nga 2005",
  "logo": "logo.svg",
  "colors": {
    "primary": "#1F3A5F",
    "accent": "#C8A165",
    "background": "#FFFFFF",
    "text": "#1A1A1A"
  },
  "font": "Inter",
  "contact": {
    "phone": "+383 44 123 456",
    "whatsapp": "+38344123456",
    "viber": "+38344123456",
    "email": "info@druridesign.com",
    "address": "Rr. Agim Ramadani, Prishtinë",
    "city": "Prishtinë"
  },
  "languages": ["sq", "en", "de"],
  "defaultLanguage": "sq",
  "modules": { "kitchenDesigner": true, "wardrobeDesigner": true }
}
```

`catalog.json` holds materials and furniture modules and **pricing rules** (see the Pricing section). Theme colors are applied through CSS variables so the whole UI recolors from `brand.json`.

**Brand Setup page** (`/setup`, hidden, protected by a simple PIN):

- Upload a logo → auto-extract 2–3 dominant colors as suggested primary/accent (use a library like `node-vibrant` or a canvas-based extractor)
- Fields for company name, tagline, phone, city
- Live preview of the app with the new branding
- **"Export brand"** downloads a zip with `brand.json` + logo, ready to drop into `/public/brands/`
- **"Use on this device"** saves the brand to localStorage, so I can personalize the demo on my tablet right before a meeting without redeploying

## Tool 1: 3D Kitchen & Wardrobe Designer

### Flow (wizard plus free editing)

1. **Room**: enter wall lengths and ceiling height (cm). Optionally mark a window or door on a wall.
2. **Layout**: Straight (I), L-shape, U-shape, Parallel, optional Island. Wardrobe mode: straight wall wardrobe, corner wardrobe, walk-in.
3. **Auto-fill**: generate a sensible default kitchen for that layout: base cabinets, wall cabinets, tall units, sink cabinet, oven tower, fridge space, dishwasher slot, corner unit. Use standard module widths (30/40/45/50/60/80/90/100 cm), base height 72 + plinth 10 + worktop 4 cm, wall cabinet heights 72/90 cm, depth 60/35 cm.
4. **Customize**:
   - Tap a cabinet to select it, then change width, type (doors / drawers / open shelf / glass), swap it, delete it, or add one next to it.
   - Modules snap along walls and can't overlap or go past the wall length.
   - Global style controls: **front finish**, **carcass color**, **countertop**, **handles** (none/push-to-open, bar, profile, knob), **backsplash**, **plinth**, **LED under wall cabinets** (on/off).
5. **Summary**: render screenshot, parts list, total price estimate, and actions:
   - **Share link** (design encoded in the URL, compressed with `lz-string`)
   - **Send via WhatsApp/Viber** (prefilled message with the link, sent to the company's number from `brand.json`)
   - **Download PDF offer** with company logo, contact info, screenshot, item list and price, marked "Ofertë orientuese" (indicative offer). Use `jspdf` or similar.

### 3D quality requirements (the "wow" factor)

- Cabinets are **generated procedurally** from parameters (box carcass, fronts with small gaps, handles, worktop with thickness, plinth). No dependency on heavy 3D model files.
- PBR materials with real textures: wood grains (oak, walnut), matte lacquer colors (white, anthracite, black, sage green, cashmere), high-gloss, concrete and marble countertops. Use CC0 textures (ambientCG / Poly Haven), compressed to keep the app small. Load textures lazily.
- Soft realistic lighting: an environment map, soft shadows, light ambient occlusion. A floor and walls with neutral materials.
- Camera presets: **Front**, **Perspective**, **Top**, plus orbit/pan/zoom with touch gestures. Smooth camera transitions.
- **Doors and drawers open on tap** (animated) to show the inside: drawer organizers, pantry pull-out, corner carousel. Owners love this.
- Must run smoothly (30+ fps) on a mid-range Android tablet and an iPad. Provide a "performance mode" that lowers shadow quality.

### Pricing engine (configurable per client)

All in `catalog.json`, nothing hard-coded:

- Each module type has a **base price per width** (or price per running meter).
- **Material multipliers** for fronts (e.g., matte lacquer ×1.0, high-gloss ×1.25, real veneer ×1.6).
- Countertop **price per running meter** per material.
- Handles price per piece, LED price per meter, accessories (pantry pull-out, corner carousel, drawer organizer) as fixed prices.
- Optional installation % and VAT toggle.
- Show the price as a **range** (e.g., ±7%) by default, with a setting to show an exact number.

## Lookbook bridge (small)

Add a simple **"Material Switcher"** entry screen: one beautiful pre-made kitchen scene where the user switches the front finish and countertop with big swatches. A **"Design your own kitchen"** button leads into the full designer. This screen can also be embedded on the client's website (iframe-friendly route `/embed/material-switcher`).

## Demo data

- Include **two complete demo brands**: two kitchen/furniture companies, with fictional Kosovo-style names, realistic catalog data and realistic Kosovo market prices in EUR.
- Include **3 ready-made example kitchen designs** (modern handleless L-shape in anthracite + oak, classic white U-shape, minimalist straight kitchen with island) that load with one tap, so the demo looks good in the first 5 seconds.
- A **"Demo reset"** button in settings.

## Scope: demo now, production later

Build a **demo-ready MVP**: everything on the main path must work flawlessly and look polished. Structure the code so it's easy to extend later. **Do NOT build yet:**

- user accounts, backend, database, admin panel for editing the catalog through a UI (editing JSON is fine for now)
- exact manufacturing output (cut lists, CNC export)
- payment integration

Keep clean boundaries (`/brand`, `/catalog`, `/pricing`, `/designer3d`, `/i18n`) so a backend can be added later without rewrites.

## Work plan

Work in milestones and make sure the app runs after each one:

1. Project setup, brand system, theming, i18n, PWA shell, `/setup` page
2. Procedural cabinet generator + room + straight layout + materials
3. L/U/parallel/island layouts, cabinet editing, snapping, door/drawer animations
4. Pricing engine + summary + share link + PDF + WhatsApp/Viber send
5. Local A/B comparison, storage inspection and indicative proposals
6. Material Switcher screen, example designs, demo brands, performance pass on tablet

Before you start coding, briefly give me the plan and folder structure. At the end, write a `README.md` with:

- how to run it
- how to add a new brand in under 15 minutes (step by step)
- how to edit catalog prices
- how to deploy

## Authorized realism implementation status — 13 October 2026

Phase 0 foundations are implemented in the current source: fixed-ID compatibility fixtures for both brands, development-only render measurements, shared current-style/interior resolution, and explicit shared/scene resource lifetimes. Existing v1/v2 reads, pricing, sales tools, branding and SQ/EN/DE remain supported. This does not introduce Design v3, finish zones, storage-component editing, new room assets, new lighting or camera choreography.

Evidence and the physical-tablet protocol are in `verification/showroom-realism/BASELINE.md`; the development entry is `/preview-studio?brand=default`. Browser timing is separate from real-device acceptance. No physical tablet result or meeting-readiness claim is recorded. Stop after Phase 0; subsequent phases require explicit authorization.

## Authorized Phase 1 implementation status — 14 October 2026

Phase 1 was separately authorized and implements authored physical UVs/finish responses in both catalogs, explicit matching plinth/backsplash appearance, recessed backs, shelf setbacks, fitted drawer bodies and instanced fittings. Worktop cutouts/continuity remain procedural; the tier's true outer thickness also drives layout clearance and framing. Design versions, IDs, dimensions, prices, SQ/EN/DE, offers, sharing, A/B and persistence remain compatible. No runtime asset, dependency, furnished-room kit, lighting redesign, finish-zone or component editor was introduced.

See `verification/showroom-realism/phase-1/REPORT.md` for matched evidence, final checks, browser timing failures and device-test instructions. Implementation checks pass; repeated browser p95 and physical-device acceptance remain open. Stop after Phase 1. Phase 2 requires explicit authorization and review of the visual/performance gaps.

## Authorized Phase 2 implementation status — 14 October 2026

Phase 2 was explicitly authorized and adds two furnished-room recipes, original fixed-size generic models with lower-detail variants and isolated fallbacks, clearance-based prop placement and rail/shelf-based wardrobe population. Actual preset windows are catalog data; user-defined openings and legacy solid rooms take precedence. Model/room decoration never enters the quote. Procedural cabinets/worktops, storage presets, dimensions, v1/v2 persistence, pricing, branding, SQ/EN/DE, offers, sharing, A/B and offline support remain supported.

The Phase 1 performance gaps were reproduced/reviewed before the kit was added. Repeated contact work was bounded and duplicate directional/contact shadow work removed; carcass panels/handle parts are batched, and opaque closed interiors are hidden only after closing settles. All Phase 1 mapping/construction remains available for inspection. Models are original project geometry, self-hosted and under the existing budgets; no acquisition/purchase, dependency upgrade, deployment, Phase 3 lighting/reflection system or later editor was performed.

Current evidence, test commands, reproduction steps and physical-device gaps are recorded in `verification/showroom-realism/phase-2/REPORT.md`. Implementation checks and short desktop samples are separate from owner/physical-tablet acceptance. Stop after Phase 2.

## Authorized Phase 3 implementation status — 14 October 2026

Phase 3 was explicitly authorized. It adds window-aligned direct light, a wall shadow shell independent of visible cutaways, room-authored reflections with a bounded structural refresh/fallback, stationary cabinet/shelf cavity contrast and capped combined kitchen/wardrobe LED fills. Moving doors and drawers remain dynamically lit; no closed-front shadow is baked into their interiors. Existing procedural furniture, v1/v2 drafts, commercial totals, brands, languages, offers, sharing, A/B and offline preparation remain supported.

New code is in `src/scene/lighting/`; integration is in Scene, Rendering, Materials, Primitives, CabinetShell, RunLights and quality. Reflection and lighting diagnostics are development-only. V2 recipe files preserve prior public v1 recipe bytes. No purchase/acquisition, deployment, dependency upgrade, Phase 4 finish-zone state or later storage/camera editor was introduced. See `verification/showroom-realism/phase-3/REPORT.md` for measured checks and acceptance gaps. The phase is implemented and ready for owner review; physical-tablet performance/release acceptance remains open. Stop after Phase 3.

## Authorized Phase 4 implementation status — 14 October 2026

The user confirmed proceeding after Phase 3 while retaining the documented physical-device acceptance gaps. Phase 4 adds Design v3 finish zones, per-cabinet front/carcass/handle/profile/plinth overrides and independent main/island worktops. Global defaults remain in `design.style`; explicit scope controls, Mixed states and one-step override clearing use the existing undo/redo store. Shared finish/run resolvers drive furniture, thickness/clearance, prices, Summary, A/B and PDF material associations.

Legacy v1/v2 furniture migrates in memory without regeneration; IDs, sizes, room, offers, existing storage keys and private-data exclusions are preserved. Unsupported references/future versions fail compatibility and do not overwrite a stored draft. Frozen legacy quote lines/totals remain exact, with discount → installation → VAT ordering retained. Matching products retain their own price while resolving the effective appearance.

Important code: `src/designer3d/finishes.ts`, `FinishScopeControl.tsx`, `Designer.tsx`, `src/catalog/migrations.ts`, `types.ts`, `src/scene/renderInput.ts`, `Worktops.tsx`, `countertopGeometry.ts`, pricing, document finishes/offer, Summary and Compare. Evidence is in `verification/showroom-realism/phase-4/REPORT.md`. No new models/textures, purchases, dependency upgrades or deployment. Phase 3 lighting and all earlier dirty work remain present. Stop after Phase 4; individual storage editing and Phase 6 are not implemented.

## Authorized Phase 5 implementation status — 14 October 2026

The user confirmed proceeding after Phase 4. Phase 5 adds individually selected shelf/rail/drawer/basket inventories, translated catalog fit/mounting/pricing rules, touch-sized numeric/list controls and independent component opening. Untouched wardrobes resolve deterministic legacy presets without being rewritten. First editing materializes stable IDs; compatible resizing retains components and invalid edits retain the last valid geometry/quote/history. Layout/room regeneration has an explicit in-page replacement warning with Cancel/Rebuild and one-step Undo.

Shared resolution feeds rendering, stationary cavity treatment, decorative population, measurements, quantity-difference pricing, Summary, A/B descriptions and PDF inventory. Included components are not charged again; zero removal credits are the shipped default, and published credits are bounded. Existing module accessories stay separate. V3 inventories survive persistence/sharing/A/B; transient component selection/opening and decoration visibility are excluded. Existing limits are preserved: 200 cabinets, 32 components per cabinet, 512 explicit components per design, current share payload and delivery budgets.

Important files: `src/designer3d/interiors.ts`, `interiorValidation.ts`, `InteriorEditor.tsx`, `useInteriorInteraction.ts`, `storage.ts`, `store.ts`; `src/scene/InteriorComponents.tsx`; schema/catalogs, Scene/Designer, rendering/population, pricing, documents, Summary/Compare and SQ/EN/DE. `verification/showroom-realism/phase-5/REPORT.md` contains current evidence, exact startup/testing and acceptance gaps. Full-width editing ships; dividers/partial spans/dragging remain deferred, and full-width sliding pull-outs are blocked. Rules/prices are illustrative, not supplier specifications.

159 tests, TypeScript, production build, asset/precache closure, budget and whitespace pass. Production/browser cache tests preserve custom inventory, branding, languages and commercial invariants. The requested viewport overrides stayed at 1280×720; exact tablet/portrait/phone controls and physical-device touch/thermal/performance/offline acceptance remain open. No new asset, acquisition, dependency upgrade, deployment or Git handoff. Stop after Phase 5; Phase 6 camera/touch/sales/release validation is not started.

## Authorized Phase 6 implementation status — 14 October 2026

The owner explicitly authorized Phase 6 after Phase 5, then clarified that the first presentation will use a laptop and no iPad/Android tablet is currently owned. Phase 6 implements composed room shots, touch-visible deliberate inspection, conservative safe-path transitions/cancellation/reduced motion, camera preservation through finish/component edits and resize, background demand-loop suspension, recoverable WebGL loss, responsive touch controls and unobstructed/deferable update handling. Tap/click opening and wheel/pinch zoom/recentering remain in use.

Shared closed Overall capture serves A/B and the offer. Summary navigation no longer captures the live inspection scene; unsuccessful captures cannot reuse an unrelated old image. Active captures/exports and dragging block update activation. Existing dimensions, layouts, finish/storage resolution, illustrative pricing, migration/persistence/privacy, brand isolation and SQ/EN/DE remain intact. Camera and opening state remain transient. Important files: `cameraShots.ts`, `SceneControls.tsx`, `framing.ts`, Scene/Designer/CaptureAlternative, `SceneLifecycle.tsx`, Rendering, Summary, PWA Status/busy, CSS and translations. DEV-only metrics and context-loss/sustained-motion tools remain outside production.

Final evidence and exact laptop test actions are in `verification/showroom-realism/REPORT.md` and `phase-6/`. Owner visual approval and the actual laptop meeting rehearsal remain the immediate acceptance task. Tablet touch/thermal/installed-PWA checks are deferred until hardware is available. Static Home thumbnails still await approval of final scenes before regeneration. No new phase, new asset, purchase, dependency upgrade, deployment, commit or push is included.
