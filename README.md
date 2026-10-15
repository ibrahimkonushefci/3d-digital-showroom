# Digital Showroom Designer

A static, white-label furniture sales demo dedicated to kitchens and wardrobes. `3d_designer.md` describes the current project scope. See [the removal report](verification/furniture-only/REPORT.md) for the permanent specialist-module cleanup and size comparison.

## Furniture sales release — 10 October 2026

The local sales flow is **prepared design → material family/decor → layout or storage inspection → A/B comparison → choose → indicative offer**.

- `/designer/kitchen` and `/designer/wardrobe` are the two product modules. Unknown product routes return Home.
- `/compare?brand=default&kind=kitchen` (or `wardrobe`) holds two named local alternatives. Save A/B captures a closed overall view independently of inspection/opening state. Storage uses the dedicated IndexedDB database `showroom-furniture-comparisons`; customer and offer fields are excluded. Choosing an alternative preserves the active offer details. This comparison is not shareable; the chosen design uses the existing PDF/share flow.
- Prices recalculate from the active catalog. Catalog changes queue sequential preview refreshes. Missing products block selection; capture/quota failures preserve the prior slot.
- Front and countertop families expose catalog-listed decors. Family changes keep a compatible decor or visibly select the first available decor. Collections change finishes, never cabinet arrangements.
- Countertops use optional catalog `thicknessMm`: 38 mm laminate, 12 mm compact, illustrative 20 mm quartz/granite. Omitted metadata keeps the legacy 38 mm default. Optional authored `presentationPresets[].cabinets` does not change catalog/design versions.
- Warm surroundings, material-specific responses, readable carcasses, supported upper cabinets and catalog hardware use bundled assets. Materials, storage clearances and prices remain illustrative, not manufacturer or fabrication specifications. Gola pricing retains its existing per-position calculation and is labelled as an indicative allowance.
- The representative kitchen and wardrobe proposals fit two pages in SQ/EN/DE; longer offers may legitimately paginate further.

See [current verification and remaining limitations](verification/furniture-sales/REPORT.md). Visual acceptance by the owner and physical tablet rehearsal remain required before calling the demo meeting-ready. Nothing in this release deploys the application.

## Run locally

Use Node 24 (or a Node release supported by Vite 7) and pnpm. This workspace was built with the bundled Node 24.19 / pnpm 11 runtime.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the local address printed in the terminal. For the production/offline demo:

```sh
pnpm test
pnpm build
pnpm preview --port 4173
```

On this Codex desktop, if Node/pnpm are absent from PATH:

```sh
export PATH="/Users/ibrahimi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/ibrahimi/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH"
pnpm dev
```

`pnpm exec prettier --write src tests` formats the source. The lockfile is included. Offline caching is enabled in the production build, not the Vite development server.

## What's included

| Area               | Working features                                                                                                                                                                                                                                                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundation         | Responsive shell; Albanian/English/German; EUR/cm; validated, versioned brand/catalog data; CSS themes; two fictional company brands; PIN setup with logo color extraction, device saving and ZIP export; PWA caching/status/update prompt.                                                                                                   |
| Room and furniture | Room dimensions and wall openings; procedural carcasses, fronts, worktops, handles, plinths and interiors; local textures and generated environment lighting; Hero/Overall/Inspect plus Front/Top cameras and orbit controls.                                                                                                                                        |
| Editing            | Straight, L, U, parallel and island kitchens; straight, corner and walk-in wardrobes; module selection, sizing, swapping, adding, deleting and wall positioning; collision/opening/aisle checks; rejected edits preserve the design; animations, undo/redo and performance mode.                                                              |
| Offers             | Catalog pricing per position and size with unit prices, discount, installation and VAT (single figure incl. VAT by default, range optional); branded two-page PDF offers with company registration/bank footer, client block, totals and signature/stamp boxes; PDF sharing through the native share sheet; compressed validated share links. |

`default` / Forma Studio and `druri-design` contain furniture catalogs. Company contacts remain blank until configured, or use the demo phone environment fallback. Demo badges identify fictional companies and sample prices.

## Rebrand in about 15 minutes

1. Open `/setup?brand=druri-design`. Enter the default demo PIN **2468**. Change it before a meeting through `VITE_SETUP_PIN` in `.env`; rebuild afterward. The PIN is a front-end convenience, **not authentication**.
2. Upload a logo. Suggested dominant colors appear. Select a suggestion or use the primary/accent color inputs.
3. Enter the company name, a lowercase hyphenated folder name, tagline, city, business telephone, email/address and WhatsApp/Viber numbers, plus the registration and payment details printed on every offer page: NUI, fiscal number, VAT number, bank, IBAN and website (`legal` in `brand.json`). Check the live preview.
4. Select **Use on this device** for a meeting on this browser. The override survives reload. Settings → **Remove device branding** restores the deployed brand. Each underlying demo brand has its own override.
5. Select **Export brand ZIP**. Unzip the company folder into `public/brands/`. It contains `brand.json`, `catalog.json` and `logo.png`. Shared texture/font assets stay in `public/shared/`.
6. Edit the exported `brand.json` if needed: `modules` controls which furniture tools appear and are accessible; `languages` and `defaultLanguage` control supported UI languages; `colors` contains all four theme values. Retain `version: 1` and `font: "Inter"`.
7. Adjust catalog names, supported widths/finishes and prices. Add authorized local furniture textures and record their provenance.
8. Build and deploy. Open `/?brand=your-company` and prepare offline use on the meeting device.

Brand precedence is **query parameter → subdomain under the configured base domain → `VITE_DEFAULT_BRAND` → neutral default**. Missing, malformed or unsafe brand files fall back to the neutral brand. `.env.example` documents the build-time settings. A custom subdomain needs DNS and hosting configuration; setting the environment variable does not create DNS records.

Shared links from device branding carry company name, colors, supported tools/languages and business contacts, with the underlying deployed catalog ID. They deliberately omit custom logo bytes. Deploy the exported folder and create a new link from its deployed URL to include full branding/assets. Shared branding persists within that tab while navigating/reloading; it does not overwrite the device's saved branding.

## Edit the catalog

`public/brands/<slug>/catalog.json` is the pricing and product source. `src/catalog/types.ts` contains the version-1 schemas. IDs must be unique within each group, accessories must reference real accessory IDs, colors use six-digit hex, and asset paths must stay local. Keep the supplied module and default finish IDs when preparing a brand; the demo's preset generator uses those IDs. Add new modules with supported types to the editor, or extend the generator for a different product family.

- `modules`: translated names, kitchen/wardrobe kind, level/type, allowed widths, height/depth in cm, `pricePerMeter`, `handleCount` and optional `accessory` ID.
- `fronts` and `carcasses`: finish multipliers. Module amount = width in metres × module rate × front multiplier × carcass multiplier × height ratio. Panel fronts also apply `pricing.panelMultiplier`.
- `countertops` / `backsplashes`: `perMeter` rates, applied to base-unit running length. Corner measurements are simplified demo estimates.
- `handles`: per-piece price multiplied by catalog handle counts.
- `plinths`: optional finish `perMeter` rate; zero uses `pricing.plinthPerMeter`.
- `accessories`: fixed price per matching module. LED uses wall-cabinet running length and `pricing.ledPerMeter`.
- `pricing`: installation %, VAT %, estimate range % (default 7), minimum aisle in cm, LED/plinth rates and panel multiplier.

An optional offer discount (0–30 %) applies to the subtotal first; installation applies to the discounted subtotal; VAT applies after installation. New designs quote VAT included as a single figure. Totals remain unrounded internally and display rounded EUR values. The default range is total ± `rangePercent`. A single estimate is a display preference, not a binding quotation. Prices are recalculated against the currently deployed catalog when a shared design opens; URLs carry no trusted quote total.

Catalog groups are validated against the enabled kitchen/wardrobe tools. Preserve furniture IDs when changing catalogs so saved furniture designs continue to resolve.

## Showroom walkthrough

- Choose a prepared design on Home: cashmere L, warm-white straight, anthracite island, straight wardrobe or corner wardrobe. Existing drafts load unchanged; presets replace a design only when explicitly chosen.
- Room → enter dimensions/openings → Apply. Layout → choose a layout. Rebuilding the room/layout regenerates modules, so make detailed edits afterward.
- Showroom mode: tap a module to inspect/open it. Wardrobe Interior view hides fronts without changing the design; select a compartment for approximate clearances and shelf/drawer counts. Overall view returns to the complete design. Switch to Edit modules to resize, swap, delete, add beside a module, or enter a position along a wall. Position edits snap to 10 cm; cabinets use catalog widths. A failed change explains the fit problem and retains the previous valid design.
- Open Your offer to enter the client, salesperson and discount and adjust installation/VAT/single estimate. **Send offer (PDF)** opens the iPad/iPhone share sheet with the PDF attached and a message in the company's voice (offer number, total, validity, design link); choose WhatsApp and the client. If iOS reports the tap expired while the PDF was being prepared, the button says the offer is ready and the next tap sends it. Desktop browsers download the PDF and open WhatsApp to attach it. WhatsApp/Viber buttons send the text with the link; Viber only appears when a number is configured. “Dërgoja dikujt” uses native sharing where available and recipientless WhatsApp otherwise.

## Offline preparation

1. Deploy over HTTPS, or use the production preview on localhost.
2. Load the app online and wait for **Offline ready** (shown in the desktop header; the compact phone header hides this text).
3. Visit the tools and desired brand, load an example, and check textures/PDF export before leaving for the meeting.
4. Reload and navigate with the network disconnected. The app, bundled catalogs/logos, fonts, textures and code-generated lighting work locally. Furniture drafts, A/B alternatives and device branding live on the device.
5. When an update is offered, choose Save and update while connected. Existing designs are saved continuously. Prepare the new version before going offline again.

`vite.config.ts` explicitly lists `brands/**/*`, `shared/**/*` and icons in `includeAssets` and all emitted code/CSS/HTML/JSON/image/font patterns in Workbox `globPatterns`, following the [Vite PWA static asset guidance](https://vite-pwa-org.netlify.app/guide/static-assets.html). New local brand assets are included on rebuild. Compress large assets: the per-file cache ceiling is 6 MB. Environment reflections are generated from local lights; no remote HDRI is needed. Browser storage eviction/private mode can prevent persistence. Messaging destinations and first-time access to a different hosting origin still need internet.

## Deploy

Build command: `pnpm build`. Output: `dist`. Serve at the domain root with HTTPS and an SPA fallback to `index.html` for `/designer/*`, `/setup`, `/summary`, and `/embed/*`. Do not cache `sw.js` with immutable headers. Hashed build assets may use immutable caching.

- **Vercel:** import the folder/repository, select Vite, use `pnpm build` and `dist`. `vercel.json` provides the SPA rewrite. Configure environment variables and optional custom/wildcard domain.
- **Netlify:** build with `pnpm build`, publish `dist`. Included `public/_redirects` is copied into the build and provides the SPA fallback.
- **Cloudflare Pages:** use the same build/output settings. Pages provides its SPA fallback when no top-level `404.html` is present. Verify direct route reloads on the deployed domain.
- **Other static host:** upload the contents of `dist`, retain all directories, provide the SPA fallback, HTTPS, and appropriate service-worker headers.

Embed the material switcher on a client site:

```html
<iframe
  src="https://showroom.example/embed/material-switcher?brand=your-company"
  title="Material preview"
  style="width:100%;height:800px;border:0"
  loading="lazy"
></iframe>
```

Adjust iframe height for the host site's phone layout. The embed route omits app navigation/footer and keeps material controls. The designer button navigates within the frame. If the hosting provider adds frame restrictions, configure allowed embedding domains there.

## Verification and limits

Run `pnpm test` for schemas, brand precedence, translations/formatting, all layouts, corners, islands/aisles, openings/collisions, rejected edits/history, catalog pricing, VAT/ranges, share round trips and A/B storage/compatibility. Production build also type-checks the app.

Browser verification is performed exclusively in **@Browser**. The furniture release checks cover 1180×820, 1024×768, 820×1180 and 390×844. This verifies layout, not physical device performance. See `verification/furniture-sales/REPORT.md` for current results, screenshots and SQ/EN/DE PDFs. Earlier reports remain historical context. `/qa.html` remains an optional iframe harness.

The renderer uses on-demand frames, adaptive pixel ratio, lazy routes/textures, reusable local environment lighting and a lower-quality performance mode. **30+ fps on physical iPad/Android hardware remains unverified.** Test orbiting, animations, camera/file capture and native sharing on the actual showroom devices before promising a hardware performance level.

This is a demo: editable illustrative prices, procedural products, simplified room/corner/appliance visuals and no manufacturing tolerances. Assets/camera angle/light adjustment improve a preview but cannot establish building dimensions or a supplier quotation. There are no accounts, backend, payments, catalog administration panel or manufacturing exports. Long designs may exceed a messaging service's URL limit; keep shareable examples reasonably sized. Viber draft text support varies by installed client.

## Code boundaries

Phase 1 material/construction verification is recorded in [verification/showroom-realism/phase-1/REPORT.md](verification/showroom-realism/phase-1/REPORT.md). The development studio adds fixed inspection shots, temporary decor controls and neutral/highlight calibration lights. These do not replace customer drafts or appear in production. One repeat uses authored centimetre dimensions; oak's source grain is horizontal and walnut's is vertical. These remain illustrative maps, including supplier references. Optional catalog `mapping`, `response`, `matches` and local `aoMap` metadata are validated; older entries retain the previous material response until deliberately populated. AO uses explicit Three r180 `uv1` / texture channel 1; no AO assets or baked lighting have been added.

Run `pnpm dev --port 5173 --strictPort` and open `http://127.0.0.1:5173/preview-studio?brand=default` (or `brand=druri-design`). Each **Run 10s motion sample** clears motion history while keeping the warmed renderer; **Reset measurements** rebuilds the scene. Repeat samples remain variable and exceed the proposed 33 ms p95 target in this browser session. Draw-count/asset-budget checks pass; physical-tablet, thermal and installed-PWA acceptance remain open. See the Phase 1 report before authorizing Phase 2.

`src/app` routes/shell; `brand` loading/setup/theme/export; `catalog` versioned schemas; `pricing` pure calculations; `designer3d` pure layout/collision logic plus render/editor/cameras; `scene` shared primitives, PBR materials, appliances and furniture storage details; `sharing` compression/draft URLs; `documents` Unicode PDF offers; `persistence` brand-scoped saves/IndexedDB; `i18n` translations; `pwa` readiness/updates. Product data stays in `public/brands`; local assets in `public/shared`.

## Demo phone and presentation mode

Copy `.env.example` to `.env`, set `VITE_DEMO_CONTACT_PHONE=+383XXXXXXXX`, then restart development or rebuild production. Use an actual company-authorized number. This fallback applies only to fictional demo brands and fills missing phone/WhatsApp/Viber fields; configured contacts win. In `/setup`, editing Phone also fills WhatsApp and Viber until either is manually edited. Empty contacts never interrupt the flow: WhatsApp opens `https://wa.me/?text=...` without a recipient. Messaging buttons prepare a draft; the user sends it.

Settings → **Modaliteti i prezantimit** hides the offline badge, fictional-demo footer and development hints. It defaults on for brands saved through `/setup`; the device preference is saved per brand. Turn it off temporarily to verify **Gati pa internet**, then turn it on for the showroom. Settings also stores the salesperson name and offer validity days per brand. Performance mode disables normal maps, shadows and high DPR.

## Material tiers and offers

`frontTiers` defines Iverall, foil MDF, matt lacquer MDF, glossy acrylic and Fenix. Each tier references decor IDs in `fronts`; its multiplier controls module pricing. `countertopTiers` defines laminate 38 mm, compact 12 mm, quartz and granite with decor IDs and a per-metre rate. Decor records retain their own material maps and old IDs. `appliancePackages` supplies the optional package line. `pricing` supplies offer prefix, validity, translated payment terms, LED rates, installation, VAT and range. No supplier authenticity is implied by demo prices or textures.

Offer details contain optional customer name/phone/city, salesperson, device-generated brand/year sequence, date, validity, payment terms and notes. They are saved with the design and printed in the PDF, but omitted from share links. Device storage clearing resets the offer counter; this is a local sequence, not a company-wide invoice system. Furniture Design v1/v2 inputs are migrated in memory to Design v3 on read. Original furniture IDs, dimensions, room and offer details are preserved; reading alone does not rewrite the stored record.

## Showroom realism — Phase 0 (13 October 2026)

Phase 0 adds reproducible compatibility fixtures, a shared render-input boundary and resource ownership, plus a **development-only** measurement studio. Appearance, furniture editing, document versions, commercial rules and existing storage keys remain unchanged. No models/textures were acquired, dependencies upgraded or deployment performed.

```sh
pnpm dev --port 5173 --strictPort
```

Open `http://127.0.0.1:5173/preview-studio?brand=default` (or `brand=druri-design`). The studio uses fixed-ID fixture designs without touching saved drafts. Select a preset and quality, run the 10-second motion sample, toggle fronts/interior, measure the temporary closed A/B Canvas peak, then download metrics JSON or an image/PDF. Reset measurements starts a fresh renderer; the decoded source cache can remain warm. Quality is locked locally in this studio and does not change the editor's performance preference.

Main/shadow/contact passes are reported separately; initial PMREM probe work has its own cumulative count. Moving-frame p50/p95 excludes explicit idle boundaries; CPU submission time is not GPU execution time. Texture/target/geometry/framebuffer bytes and the combined capture peak are estimates. The studio and profiler are excluded from production routing and bundles.

See [the Phase 0 baseline and device protocol](verification/showroom-realism/BASELINE.md) for exact evidence, known limits and real-tablet steps. Physical iPad/Android performance, thermal stability and installed-PWA/native-sharing rehearsal remain unverified. Phase 1 (physical materials and visible construction) requires separate authorization.

## Showroom realism — Phase 2 (14 October 2026)

Phase 2 adds warm kitchen/dressing-room recipes and an original generic model kit: appliance fronts/tap, stools/pendants, bench, countertop ceramics, hanging silhouettes, folds, shoes and boxes. Both catalogs declare actual preset windows; existing saved rooms keep their openings, including solid walls. Furniture, storage presets and pricing remain procedural. Presentation is inferred by furniture kind; no Design v3 or finish/interior editor was introduced.

Models are metre-scale, have two local detail levels and isolated procedural fallbacks. Props are omitted when room, cabinet, swept-front or door clearance fails, when the room is outside the authored range, or for 24+ cabinets. Enclosed contents stay available through closing and inspection. Carcass panels/handle parts are batched without changing their Phase 1 mapping or outer dimensions. The room floor now matches the zero-height furniture/prop anchors. Lighting/environment remain inherited; Phase 3 has not started.

The 30 GLBs total 980,308 bytes. No asset was purchased/downloaded and no dependency upgraded. Provenance, hashes, dimensions, draw/triangle counts and original-use permission are in `public/shared/asset-manifest.json`, `public/shared/ASSETS.md` and `public/shared/licenses/original-room-kit-v1.txt`. Authoring source is `scripts/author-room-kit.mjs`. After a build, run `node scripts/check-scene-assets.mjs dist` in addition to the normal budget check.

Use `/preview-studio?brand=default` for fixed fixtures without touching drafts. **Models → Missing model test** exercises isolated failure; **Original room kit** restores the models. Repeat balanced/lightweight samples and inspect open fronts. Production excludes this studio. Offline preparation now checks the complete required room asset set; on a first visit, choose **Finish setup** if prompted. Keep the normal save/update flow.

See `verification/showroom-realism/phase-2/REPORT.md` for current checks and remaining acceptance gaps. Desktop browser results do not establish physical-tablet performance, thermal stability, native sharing or owner visual approval. Stop after Phase 2; Phase 3 requires a separate instruction.

## Showroom realism — Phase 3 (14 October 2026)

Phase 3 replaces generic studio lighting with one shadowed key derived from the actual room window, restrained fill and a separate no-color/no-depth shadow shell. Visible walls still cut away for editing; shadow walls retain real apertures. Solid saved rooms use overhead presentation lighting without adding a window. Balanced uses a 1024 shadow map; high uses 2048. Kitchen and wardrobe LED fills share a maximum of three combined runs.

Both rooms have an original code-authored 64 px reflection fallback and one debounced 128 px room/decor refresh after loading or structural edits. Furniture, opening animations, orbit and finish hovers do not feed that probe. A refresh over 50 ms falls back and disables further runtime attempts for that renderer. Performance mode keeps the authored environment and inexpensive stationary cavity contrast, with dynamic shadows and LED fills disabled. The reflections approximate room brightness; they are not accurate mirrors. No lightmaps, full-screen AO, bloom/SSR, new runtime dependency or acquired asset was added.

`public/shared/rooms/*-warm-v2.json` carries the lighting recipes while the old v1 files remain available unchanged. Design versions, stored furniture, prices, offer details and editing remain compatible. Capture waits for reflection readiness and uses the same scene. Existing A/B previews refresh through a lighting revision without rewriting their furniture.

Run `pnpm dev --port 5173 --strictPort`, then open `http://127.0.0.1:5173/preview-studio?brand=default`. Reflections, Window study, Lighting camera and LED fills are temporary development checks that do not save drafts. Choose Actual fixture opening for normal staging; study windows may intentionally intersect furniture and are not customer layouts. Use Perspective, Front and Top, toggle fronts/interior, compare matte/acrylic and test balanced/lightweight/high. Wait for assets/probe to settle before a motion sample. Production excludes these controls.

Evidence and exact test steps are in [the Phase 3 report](verification/showroom-realism/phase-3/REPORT.md). Automated checks and desktop browser evidence pass within delivery/draw/memory budgets. Owner visual review and sustained physical-device acceptance are still required. Stop after Phase 3; Phase 4 is not started.

## Showroom realism — Phase 4 (14 October 2026)

Phase 4 adds independent finish zones and matching indicative offers. `design.style` remains the global default; `finishZones` (`base`, `wall`, `tall`, `island`, `wardrobe`) and cabinet `finishOverride` records take precedence. Island wins over cabinet level. Overrides contain catalog IDs for fronts, carcasses, handles and plinths, plus the front profile. Shared resolvers in `src/designer3d/finishes.ts` feed rendering, pricing and material associations. Matching plinth appearance follows the effective front; its selected product still determines its price.

In Styles & Finishes choose All · defaults, a relevant zone, or Selected cabinet. All changes defaults while retaining overrides. Mixed means the cabinets in that scope differ; select a family to choose a compatible decor. Apply defaults to all / clear overrides clears cabinet, zone and worktop overrides in one undo step. Clear this scope’s overrides restores inheritance. Collections explicitly apply to the shown scope; All collections clear overrides, while zone collections preserve individual cabinet overrides. A collection on Selected replaces that cabinet's finishes. Room/layout regeneration retains its existing explicit replacement behavior for individual module edits.

Worktop scope is separate: Global default, Main worktop or Island worktop. Each surface uses a catalog finish and its tier thickness; connected main corners/cutouts remain procedural. Use global default clears that surface's override. Matching backsplash follows the main surface's worktop. Current catalog running-length allowances remain indicative, including existing backsplash rules; this is not a fabrication takeoff.

Pricing separates different effective finishes, handles/plinths and split worktops. Summary and A/B show zone associations and quantities; comparison details expand to show every material role. Mixed PDFs add a complete zone/cabinet-position association section and may exceed two pages. Uniform legacy designs keep their exact frozen line prices and totals. Discount → installation → VAT ordering is unchanged.

`src/catalog/migrations.ts` normalizes v1/v2/v3; unknown future versions and unsupported finish references are rejected. Incompatible drafts remain stored and display an error instead of being replaced with a differently priced default. Existing localStorage keys and A/B database names stay unchanged. Share envelope v1 now carries Design v3; updated apps still read old links, but older deployed apps cannot read new v3 links until updated. Private offer/customer fields remain excluded from sharing and A/B. Encode/decode retain the 30,000 encoded / 150,000 decompressed-character limits with localized size feedback.

The isolated Phase 4 dev preview uses `pnpm dev --port 52745 --strictPort`; production review uses `pnpm preview --port 52746 --strictPort`. Open `/designer/kitchen?brand=default` or `/designer/wardrobe?brand=druri-design`. See [Phase 4 evidence and exact test actions](verification/showroom-realism/phase-4/REPORT.md). All prior lighting/material/construction work is retained. Physical-device acceptance gaps remain open. No Phase 5/6 work, purchase, deployment or dependency upgrade was performed.

## Showroom realism — Phase 5 (14 October 2026)

Phase 5 implements individual wardrobe shelf/rail/drawer/basket editing. In **Storage & Lighting**, choose a cabinet and component, then Move up/down, Apply height, Replace, Remove or Add. Interior-view scene taps select components without toggling fronts. Drawers/baskets open independently; the accessible list provides the same workflow. First edit materializes a stable inventory; untouched designs retain their legacy presets/quotes. All mounting, fit and prices are illustrative rather than supplier manufacturing rules.

Optional catalog `interiorItems` / `interiorPresets` and module `interiorPricing` declare included presets, additions and bounded removal credits. Moving is free; unchanged included items are not charged twice. Removal credits default to zero; accessories remain separate. Both catalogs ship zero credits. Component inventory follows undo/redo, reload, sharing and A/B, and appears in Summary/PDF. Selection, opening and decorative-content visibility remain transient. Full-width editing ships first; partial spans/dividers and dragging are deferred. Sliding-front full-width pull-outs are blocked. Incompatible resize is rejected; Reset to included interior is explicit. Room/layout rebuilds warn before replacing custom inventories and remain undoable.

Review with `pnpm dev --port 52747 --strictPort`, or production `pnpm build` then `pnpm preview --port 52748 --strictPort`. Open `/designer/wardrobe?brand=default` (or `druri-design`); `/designer/kitchen` retains its existing flow. The development studio's **Custom wardrobe storage** inspection study uses disposable fixed fixtures and saves no drafts.

See [Phase 5 evidence and complete test actions](verification/showroom-realism/phase-5/REPORT.md). Final checks: 159 passing tests, TypeScript/build/asset closure/budget/whitespace pass; 5.87 MB shipped. @Browser verified storage/price/history/share/A/B/brand/language and stopped-origin cache behavior. Viewport override stayed at 1280×720, so new tablet/portrait/phone layouts remain unverified. Physical touch, sustained performance, supplier rules and installed-device acceptance remain open. Stop after Phase 5; Phase 6 requires a separate instruction. No deployment, dependency upgrade or new asset was performed.

## Showroom realism — Phase 6 (14 October 2026)

Phase 6 adds room Hero, Overall, Front and Top shots, a visible **Inspect up close** toolbar action, 600 ms deliberate camera moves with conservative obstacle checks, immediate pointer/orbit cancellation and reduced-motion snapping. The first view is composed immediately. Tap/click still opens one unit without flying the camera. Material and storage-placement changes preserve the chosen view; rotation also preserves it, so use Overall to refit after changing orientation. Inspection includes conservative open-front clearance; pinch/wheel can move closer for construction details.

The camera math is in `src/designer3d/cameraShots.ts` / `framing.ts`; `SceneControls.tsx` coordinates transitions and keeps wheel/pinch recentering. Unclear/blocked travel snaps to the destination instead of crossing a cabinet or wall. The entire demand loop pauses in background tabs, and a lost WebGL context offers **Restore 3D view** while retaining the design. Visible rendering pauses during the temporary closed A/B capture. Summary owns its own closed Overall capture; opening the offer no longer waits for the inspection camera, and failed capture never substitutes an older/inspection image. Offer URLs retain the furniture kind across reload, including when another tab edits the other module.

Camera/language/material/storage controls have 44 px minimum targets and the camera toolbar wraps on narrow screens. Update notices have **Later**, sit above the phone offer bar and disable activation while capture/export or cabinet dragging is in progress. An explicit update still preserves the normal saved drafts and A/B flow. Home, material switcher, embed, comparison and PDF use the same scene/resolvers. Existing static Home thumbnails are retained pending owner approval of final imagery; no new thumbnail is represented as approved.

Laptop presentation is the immediate target, following the owner's clarification that no tablet is currently available. Actual tablet touch/thermal and installed-device/native-sharing checks remain deferred. See [the Phase 6 report](verification/showroom-realism/REPORT.md) for final evidence, limitations and the laptop rehearsal checklist. No deployment or Git handoff is included.

```sh
cd /Users/ibrahimi/3d_designer
pnpm build
pnpm preview --port 52750 --strictPort
```

Open `http://127.0.0.1:52750/designer/kitchen?brand=default` or `/designer/wardrobe?brand=druri-design`. Reuse the owned preview if it is already running. Offline checks require this production build, Finish setup / Save and update if offered, and Offline ready. Development: `pnpm dev --port 52749 --strictPort`; `/preview-studio?brand=default` has disposable fixed fixtures, camera/frame counters, 10-second or 10-minute motion samples, Stop, context-loss simulation and the existing image/PDF/memory tools. These diagnostics are excluded from production. A motion sample pauses in a hidden tab; its timings remain browser measurements, not physical GPU or tablet results.

Phase 6 final checks: 164 tests, TypeScript, production build, asset/precache closure and budget pass; 5,881,827 shipped bytes. The stable ten-minute desktop sample recorded 24.9 ms p95 / 110.6 ms maximum at the documented DPR/viewport, with stable counters. Normal-editor rendering became idle. Both brands/rooms, A/B and the Albanian PDF worked with the owned origin stopped; the preview was restarted. Physical-device and owner acceptance are still separate.

## Showroom correction — Phase 1 (15 October 2026)

Showroom mode now opens **inside the room**: an eye-level, nearly level camera chosen to show the most cabinet fronts, with a ceiling, downlights and a garden view through windows. **Edit modules** switches to the Overview. Enclosed layouts (U, galley, walk-in) and narrow portrait screens keep the outside composition. One render pipeline (MSAA → GTAO → output) serves the live view and every capture; lightweight quality bypasses it. v3 room recipes add a soft in-room key light and lower the uniform room radiance. Closed front gaps read dark; CC0 surfaces (oak, floor, plaster, lacquer micro-texture) and six CC0 decor props are included, all local and offline. Prices, offers, A/B, sharing, languages and saved designs are unchanged.

Review: `pnpm build && pnpm preview --port 52771 --strictPort`, then open http://127.0.0.1:52771/?brand=default in Chrome. Matched gate captures: `pnpm capture:review <base-url> <out-dir>` (Chrome with `--remote-debugging-port=9333`; see `scripts/review/capture-showroom.mjs`). Evidence and acceptance: [verification/phase1-review/REPORT.md](verification/phase1-review/REPORT.md). Asset sources: `public/shared/ASSETS.md`, `art/`.
