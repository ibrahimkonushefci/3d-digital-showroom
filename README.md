# Digital Showroom Designer

A static, white-label sales demo for companies in Kosovo that make **kitchens and wardrobes**. A freelance developer walks into a showroom with a laptop (later a tablet) and shows the owner a working 3D designer that already carries their name, logo, colours and products. It must feel like a finished product, work offline, and be rebrandable in about 15 minutes.

- **Users:** the showroom salesperson next to a customer (touch-first, big controls), customers at home on a phone (including diaspora in Germany/Switzerland), and a non-technical business owner who must find it impressive and simple.
- **Languages:** Albanian (default), English, German. EUR, metric (cm).
- **Stack:** React + TypeScript + Vite, Three.js via React Three Fiber/drei, Zustand, Tailwind. No backend; state lives in memory, localStorage/IndexedDB and share URLs. PWA with offline support; deploys as a static site.
- **Out of scope for the demo:** accounts, backend, catalog admin UI (JSON editing is fine), manufacturing output, payments.

## Working constraints

- **Budget $0.** No paid assets, marketplace models or services. Only CC0 sources (Poly Haven, ambientCG) and original work. Provenance is recorded in `public/shared/ASSETS.md` and `public/shared/licenses/`.
- **Presentation machine:** M4 MacBook Air (16 GB) in Chrome. Visual and performance acceptance is judged there, in a normal window; headless numbers are supporting evidence only. Tablets are a later, separate check.
- **Blender 5.2** is a local authoring tool only (run headless by script), never a runtime or build dependency.
- **Review gate:** a phase is done when matched before/after captures and a live check on the laptop pass, not when tests pass.
- **Visual references:** IKEA (eye-level framing, soft shadows), Schmidt (complete room with ceiling, window and exterior, restrained decor), Cosentino (surface presentation). Showroom mode opens on an eye-level view inside the room; editing switches to the overview.

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

Browser checks use the built-in browser (@Browser). Layout has been checked at 1440×900, 1180×820, 1024×768, 820×1180 and 390×844; this verifies layout, not device performance. Review evidence (captures, reports) is kept locally in `verification/` and is not committed.

The renderer uses on-demand frames, adaptive pixel ratio, lazy routes/textures, reusable local environment lighting and a lower-quality performance mode. **30+ fps on physical iPad/Android hardware remains unverified.** Test orbiting, animations, camera/file capture and native sharing on the actual showroom devices before promising a hardware performance level.

This is a demo: editable illustrative prices, procedural products, simplified room/corner/appliance visuals and no manufacturing tolerances. Assets/camera angle/light adjustment improve a preview but cannot establish building dimensions or a supplier quotation. There are no accounts, backend, payments, catalog administration panel or manufacturing exports. Long designs may exceed a messaging service's URL limit; keep shareable examples reasonably sized. Viber draft text support varies by installed client.

## Code boundaries

`src/app` routes/shell; `brand` loading/setup/theme/export; `catalog` versioned schemas; `pricing` pure calculations; `designer3d` pure layout/collision logic plus render/editor/cameras; `scene` shared primitives, PBR materials, appliances and furniture storage details; `sharing` compression/draft URLs; `documents` Unicode PDF offers; `persistence` brand-scoped saves/IndexedDB; `i18n` translations; `pwa` readiness/updates. Product data stays in `public/brands`; local assets in `public/shared`.

`/preview-studio?brand=default` (development server only) has fixed fixture designs, camera/frame counters, motion samples, missing-model and context-loss tests. It never touches saved drafts and is excluded from production.

## Demo phone and presentation mode

Copy `.env.example` to `.env`, set `VITE_DEMO_CONTACT_PHONE=+383XXXXXXXX`, then restart development or rebuild production. Use an actual company-authorized number. This fallback applies only to fictional demo brands and fills missing phone/WhatsApp/Viber fields; configured contacts win. In `/setup`, editing Phone also fills WhatsApp and Viber until either is manually edited. Empty contacts never interrupt the flow: WhatsApp opens `https://wa.me/?text=...` without a recipient. Messaging buttons prepare a draft; the user sends it.

Settings → **Modaliteti i prezantimit** hides the offline badge, fictional-demo footer and development hints. It defaults on for brands saved through `/setup`; the device preference is saved per brand. Turn it off temporarily to verify **Gati pa internet**, then turn it on for the showroom. Settings also stores the salesperson name and offer validity days per brand. Performance mode disables normal maps, shadows and high DPR.

## Material tiers and offers

`frontTiers` defines Iverall, foil MDF, matt lacquer MDF, glossy acrylic and Fenix. Each tier references decor IDs in `fronts`; its multiplier controls module pricing. `countertopTiers` defines laminate 38 mm, compact 12 mm, quartz and granite with decor IDs and a per-metre rate. Decor records retain their own material maps and old IDs. `appliancePackages` supplies the optional package line. `pricing` supplies offer prefix, validity, translated payment terms, LED rates, installation, VAT and range. No supplier authenticity is implied by demo prices or textures.

Offer details contain optional customer name/phone/city, salesperson, device-generated brand/year sequence, date, validity, payment terms and notes. They are saved with the design and printed in the PDF, but omitted from share links. Device storage clearing resets the offer counter; this is a local sequence, not a company-wide invoice system. Furniture Design v1/v2 inputs are migrated in memory to Design v3 on read. Original furniture IDs, dimensions, room and offer details are preserved; reading alone does not rewrite the stored record.

## How the visuals are built

- **Furniture** is procedural (`src/designer3d/furniture/`, `src/scene/`), so any size can open, animate and be priced. Physical UV mapping, per-finish material responses and dark front gaps live in `src/scene/Materials.tsx`, `Primitives.tsx` and `GapShade.tsx`.
- **Render pipeline** (`src/scene/pipeline/`): MSAA → GTAO ambient occlusion → output, shared by the live view and every capture; lightweight quality bypasses it. Shaders compile in the background before new objects appear (`shaderWarmup.ts`).
- **Room** (`src/scene/rooms/`): walls, ceiling with downlights, window with a garden backplate and a half-lowered blind, room recipes in `public/shared/rooms/*-v3.json`, lighting in `src/scene/lighting/`. Decor props are placed by clearance rules (`decor.ts`).
- **Models** (`public/shared/models/`): clothes, appliances, stools, pendant and CC0 decor as meshopt-compressed GLBs with two detail levels and a procedural fallback each. Rebuild the kit (about 10 s): `/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python art/blender/phase2_kit.py -- <out-dir> [--preview]`, then `node scripts/register-kit.mjs <out-dir>`. After a build, `node scripts/check-scene-assets.mjs dist` checks the asset manifest and precache.
- **Baked room lighting** for the five prepared designs (`src/scene/bake/`, `public/shared/bakes/`): a Cycles lightmap of floor, walls and ceiling, applied only while the design's signature (room, openings, LEDs, cabinet placement) matches; finish changes keep it, structural edits fade to live lighting in 300 ms. Re-bake after changing a prepared design or its room (dev server, Chrome with `--remote-debugging-port=9333`, about 2 min per design): `pnpm dev --port 5203 --strictPort`, then `node scripts/bake-rooms.mjs http://127.0.0.1:5203 <work-dir> [name] [--preview]` and `node scripts/review/calibrate-bakes.mjs http://127.0.0.1:5203`.
- **Home thumbnails:** `node scripts/review/capture-thumbnails.mjs <preview-url> --write`.
- **Review tools** drive an isolated Chrome: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --remote-debugging-port=9333 --user-data-dir=<empty dir> --use-angle=metal --enable-gpu about:blank`. Captures: `pnpm capture:review <base-url> <out-dir>` (all presets × Hero/Overview/Front/Top/Open/Interior at 1440×900 @2×); close-ups `scripts/review/capture-closeups.mjs`; frame cost `scripts/review/measure-gpu.mjs`; front interactions `scripts/review/check-front-interactions.mjs`.

## History

Built in milestones from 8 October 2026: the foundation and sales release (brand system, layouts, pricing, PDF offers, A/B), six realism phases (materials, furnished rooms, lighting, finish zones, editable wardrobe storage, camera), then three correction phases: an eye-level room you stand in (`d1554d7`), Blender-generated objects (`299cd59`), background shader compilation (`ff93842`) and baked room lighting (Phase 3). Git history holds the detailed reports that were removed from the working tree.
