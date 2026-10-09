# Digital Showroom Designer

A static, white-label showroom demo for kitchens, wardrobes, exterior doors/windows, interior doors and laminate flooring. The original brief is preserved in `3d_designer.md`.

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

| Area                   | Working features                                                                                                                                                                                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundation          | Responsive shell; Albanian/English/German; EUR/cm; validated, versioned brand/catalog data; CSS themes; two fictional company brands; PIN setup with logo color extraction, device saving and ZIP export; PWA caching/status/update prompt.                                                          |
| Room and furniture  | Room dimensions and wall openings; procedural carcasses, fronts, worktops, handles, plinths and interiors; local textures and generated environment lighting; three camera presets and orbit controls.                                                                                               |
| Editing             | Straight, L, U, parallel and island kitchens; straight, corner and walk-in wardrobes; module selection, sizing, swapping, adding, deleting and wall positioning; collision/opening/aisle checks; rejected edits preserve the design; animations, undo/redo and performance mode.                     |
| Offers              | Catalog pricing, materials, accessories, installation and VAT; configurable range/single estimate; branded Unicode PDFs with screenshot/parts/dimensions; compressed validated share links; messaging preparation.                                                                                   |
| Exterior & photo    | Two-storey procedural house, physical 3D doors/windows, finish/profile/option pricing, camera and evening settings; photo placement from the same 3D factory, frame/glass layers, light matching, selectable polygons, corner loupe and direct before/after handle; three marked placeholder scenes. |
| Interior & delivery | Calibrated hallway/living/bedroom photographs, shared hinged-door products, sharp laminate grain and plank patterns, editable quote dimensions/quantities, bounded pan/zoom, skirting/pack/waste pricing, PDF/share; cached local assets and responsive touch controls.                                                       |

`default` / Forma Studio enables all four home entry points. `druri-design` enables furniture; `drita-home` enables doors/windows and interior doors/flooring. Company contacts remain blank until configured, or use the demo phone environment fallback. Demo badges identify fictional companies and sample prices.

## Rebrand in about 15 minutes

1. Open `/setup?brand=druri-design`. Enter the default demo PIN **2468**. Change it before a meeting through `VITE_SETUP_PIN` in `.env`; rebuild afterward. The PIN is a front-end convenience, **not authentication**.
2. Upload a logo. Suggested dominant colors appear. Select a suggestion or use the primary/accent color inputs.
3. Enter the company name, a lowercase hyphenated folder name, tagline, city, business telephone, email/address and WhatsApp/Viber numbers. Check the live preview.
4. Select **Use on this device** for a meeting on this browser. The override survives reload. Settings → **Remove device branding** restores the deployed brand. Each underlying demo brand has its own override.
5. Select **Export brand ZIP**. Unzip the company folder into `public/brands/`. It contains `brand.json`, `catalog.json` and `logo.png`. Shared texture/font assets stay in `public/shared/`.
6. Edit the exported `brand.json` if needed: `modules` controls which tools appear and are accessible; `languages` and `defaultLanguage` control supported UI languages; `colors` contains all four theme values. Retain `version: 1` and `font: "Inter"`.
7. Adjust catalog names, supported widths/finishes and prices. Add local textures or transparent door PNGs as described below.
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
- `doors`: fixed model price, allowed colors, procedural style 0–7, optional local `image`, and `recolorable`.
- `windows`: frame style, square-metre rate, minimum price and colors. Entered width/height determine the estimate; dragging the image does not measure the building.

Installation applies to the subtotal; VAT applies after installation. Totals remain unrounded internally and display rounded EUR values. The default range is total ± `rangePercent`. A single estimate is a display preference, not a binding quotation. Prices are recalculated against the currently deployed catalog when a shared design opens; URLs carry no trusted quote total.

For a client door image:

Exterior products are built by the shared procedural 3D model. The photo compositor renders that same model to local, high-resolution frame/glass/product layers; catalog `image` paths from older catalogs remain parseable, but do not replace the 3D source.

Catalog groups are optional. `validateCatalogForBrand` requires the sections needed by enabled tools. Druri contains only furniture data; Drita contains only exterior/interior products; default contains everything. Preserve IDs when updating deployed catalogs so saved links continue to resolve.

## Showroom walkthrough

- Home offers equal enabled-tool entry points. Load a ready-made example or choose Kitchens, Wardrobes, Doors & Windows, or Doors & Flooring.
- Room → enter dimensions/openings → Apply. Layout → choose a layout. Rebuilding the room/layout regenerates modules, so make detailed edits afterward.
- Tap a module in the scene to select it; tap it again or choose Open/close to animate it. The module list is an accessible alternative. Resize, swap, delete, add beside it, or enter a position along a wall. Position edits snap to 10 cm; cabinets use catalog widths. A failed change explains the fit problem and retains the previous valid design.
- Open Your offer to adjust installation/VAT/single estimate, download a PDF or copy a share link. WhatsApp/Viber open a prepared draft; the user sends it. If no number exists, WhatsApp opens without a recipient so the customer can choose someone. “Dërgoja dikujt” uses native sharing where available and recipientless WhatsApp otherwise.
- Photo preview → upload a JPG/PNG/WebP or use the demo house. The file input supports mobile camera capture. Drag four corners around the opening; arrow keys adjust a focused handle. Crossed, tiny or out-of-bounds selections are rejected. Select Door/Window, choose a 3D model and finish, adjust brightness, then drag the vertical before/after handle or export. Tap a placed product to select it; touch corner dragging shows a magnified loupe. Add/select/remove multiple windows and enter each window's dimensions.
- Image export uses the same full-resolution WebGL placement as the screen. Comparison position is excluded from the final composite. Native file sharing is attempted where supported; otherwise the app downloads the image and supplies a message for manual attachment.
- Photos/placements stay in IndexedDB on the current browser origin, outside shared design links. Browser storage clearing removes them. Designs save separately by company and kitchen/wardrobe mode; settings reset clears that brand's saved design configurations and restores its examples; uploaded photos remain local. Removing device branding is a separate action.

## Offline preparation

1. Deploy over HTTPS, or use the production preview on localhost.
2. Load the app online and wait for **Offline ready** (shown in the desktop header; the compact phone header hides this text).
3. Visit the tools and desired brand, load an example, and check textures/PDF export before leaving for the meeting.
4. Reload and navigate with the network disconnected. The app, bundled catalogs/logos, fonts, textures and code-generated lighting work locally. Uploaded photos and device branding already live on the device.
5. When an update is offered, choose Save and update while connected. Existing designs are saved continuously. Prepare the new version before going offline again.

`vite.config.ts` explicitly lists `brands/**/*`, `shared/**/*` and icons in `includeAssets` and all emitted code/CSS/HTML/JSON/image/font patterns in Workbox `globPatterns`, following the [Vite PWA static asset guidance](https://vite-pwa-org.netlify.app/guide/static-assets.html). New local brand assets are included on rebuild. Compress large assets: the per-file cache ceiling is 6 MB. Environment reflections are generated from local lights; no remote HDRI is needed. Browser storage eviction/private mode can prevent persistence. Messaging destinations and first-time access to a different hosting origin still need internet.

## Deploy

Build command: `pnpm build`. Output: `dist`. Serve at the domain root with HTTPS and an SPA fallback to `index.html` for `/designer/*`, `/setup`, `/summary`, `/preview`, and `/embed/*`. Do not cache `sw.js` with immutable headers. Hashed build assets may use immutable caching.

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

Run `pnpm test` for schemas, brand precedence, translations/formatting, all layouts, corners, islands/aisles, openings/collisions, rejected edits/history, catalog pricing, VAT/ranges, share round trips and homography validation/accuracy. Production build also type-checks the app.

Browser verification is performed exclusively in **@Browser**. Responsive checks cover 1440×900, 1024×768, 768×1024 and 390×844. This verifies layout, not physical device performance. The current viewport control supports the four requested sizes directly in @Browser. `/qa.html` remains an optional iframe harness. `verification/` contains representative browser screenshots, PDF offers and a photo composite; `verification/REPORT.md` records the completed checks.

The renderer uses on-demand frames, adaptive pixel ratio, lazy routes/textures, reusable local environment lighting and a lower-quality performance mode. **30+ fps on physical iPad/Android hardware remains unverified.** Test orbiting, animations, camera/file capture and native sharing on the actual showroom devices before promising a hardware performance level.

This is a demo: editable illustrative prices, procedural products, simplified room/corner/appliance visuals and no manufacturing tolerances. Assets/camera angle/light adjustment improve a preview but cannot establish building dimensions or a supplier quotation. There are no accounts, backend, payments, catalog administration panel or manufacturing exports. Long designs may exceed a messaging service's URL limit; keep shareable examples reasonably sized. Viber draft text support varies by installed client.

## Code boundaries

`src/app` routes/shell; `brand` loading/setup/theme/export; `catalog` versioned schemas; `pricing` pure calculations; `designer3d` pure layout/collision logic plus render/editor/cameras; `doorPreview` house/product controls, exterior pricing, schema/homography/WebGL/photo editor; `interior` scene/store/layout and pure pack/door/skirting pricing; `scene` shared primitives, PBR materials, appliances and door/window factory; `sharing` compression/draft URLs; `documents` Unicode PDF/image exports; `persistence` brand-scoped saves/IndexedDB; `i18n` translations; `pwa` readiness/updates. Product data stays in `public/brands`; local assets in `public/shared`.

## Demo phone and presentation mode

Copy `.env.example` to `.env`, set `VITE_DEMO_CONTACT_PHONE=+383XXXXXXXX`, then restart development or rebuild production. Use an actual company-authorized number. This fallback applies only to fictional demo brands and fills missing phone/WhatsApp/Viber fields; configured contacts win. In `/setup`, editing Phone also fills WhatsApp and Viber until either is manually edited. Empty contacts never interrupt the flow: WhatsApp opens `https://wa.me/?text=...` without a recipient. Messaging buttons prepare a draft; the user sends it.

Settings → **Modaliteti i prezantimit** hides the offline badge, fictional-demo footer and development hints. It defaults on for brands saved through `/setup`; the device preference is saved per brand. Turn it off temporarily to verify **Gati pa internet**, then turn it on for the showroom. Settings also stores the salesperson name and offer validity days per brand. Performance mode disables normal maps, shadows and high DPR.

## Material tiers and offers

`frontTiers` defines Iverall, foil MDF, matt lacquer MDF, glossy acrylic and Fenix. Each tier references decor IDs in `fronts`; its multiplier controls module pricing. `countertopTiers` defines laminate 38 mm, compact 12 mm, quartz and granite with decor IDs and a per-metre rate. Decor records retain their own material maps and old IDs. `appliancePackages` supplies the optional package line. `pricing` supplies offer prefix, validity, translated payment terms, LED rates, installation, VAT and range. No supplier authenticity is implied by demo prices or textures.

Offer details contain optional customer name/phone/city, salesperson, device-generated brand/year sequence, date, validity, payment terms and notes. They are saved with the design and printed in the PDF, but omitted from share links. Device storage clearing resets the offer counter; this is a local sequence, not a company-wide invoice system. Furniture design version 1 is migrated to version 2 on read. Exterior designs use their version-1 schema; interior designs migrate to version 2 inside the existing version-1 compressed share envelope.

## Add a laminate decor

1. Photograph an authorized sample board straight-on in even light, without glare or perspective. Crop to the decor and make opposite edges seamless. Do not use a floor photograph containing perspective-distorted joints as a veneer front.
2. Create 1024×1024 color, OpenGL normal and roughness maps. Use subtle height detail and compress to WebP. Put files in `public/shared/textures/` or the brand's texture folder; record the source/license in `public/shared/ASSETS.md`.
3. Add a `laminates` record with a stable `id`, translated `name`, `color`, `roughness`, local `texture`/`normalMap`/`roughnessMap` paths, class AC4/AC5, `thickness` 8/10/12, `plankLength` and `plankWidth` in cm, `groove`, `waterproof`, `m2PerPack`, and `pricePerM2`. The shader supplies plank separation and variation, so the source should be continuous decor grain.
4. Configure `interiorPricing.waste` (fractions: straight 0.10, diagonal 0.15, herringbone 0.20 in this demo), underlay/floor installation per m², door installation per piece and fixed transport. `skirtings.heightRates` prices 6/8/10 cm variants per metre; perimeter subtracts door widths. Packs round up, and charged flooring is whole packs × pack area × price/m². Optional `quickCombos` reference laminate ID, door finish ID and finish tier.
5. Run tests/build, then inspect straight/diagonal/herringbone and the result PDF. Keep total precache under about 12 MB.

## Add a photo scene with marked corners

The three shipped scenes are original placeholder illustrations, not real Kosovo house photographs. Replace them with licensed or client-authorized JPG/PNG/WebP files in `public/shared/scenes/`.

Create `public/shared/scenes/<id>.json`:

```json
{
  "version": 1,
  "photo": "shared/scenes/<id>.jpg",
  "placements": [
    {
      "kind": "door",
      "width": 100,
      "height": 210,
      "corners": [
        { "x": 0.3, "y": 0.3 },
        { "x": 0.4, "y": 0.3 },
        { "x": 0.4, "y": 0.8 },
        { "x": 0.3, "y": 0.8 }
      ]
    }
  ]
}
```

Coordinates are normalized to the photo: top-left → top-right → bottom-right → bottom-left. Add window placements the same way. Dimensions are centimetres and drive pricing; photographs do not measure them automatically. Add the ID and SQ/EN/DE name to `public/shared/scenes/index.json`. Choose the scene in **Fotoja ime → Skenat demo** and load it with one tap. Check corners, brightness match, glass reflection and before/after. Photos stay outside share URLs; a recipient can reopen the product configuration and use their own local photo. Rebuild to precache added scenes.


### Interior photographic scenes

`src/interior/renderer.ts` owns the WebGL photo compositor. The exterior preview is unchanged. `public/shared/interior/scenes.json` defines normalized leaf/frame/opening quadrilaterals, floor projections, furniture exclusions, skirting and hardware anchors. Photographs are fixed illustrative environments: switching rooms changes the preview only. Quote measurements determine purchased quantities and pricing.

New interior documents use version 2 with one `doorStyle` and individual door dimensions/opening directions. New quotes start at 220 × 600 cm and four doors (90/80/80/70 cm, 200 cm leaves, 205 cm frames, 15 cm adjustable depth). Version-1 saves and links migrate in memory; original 210 cm specifications and mixed products retain their quote until an explicit global selection. Unsupported legacy models show an unavailable preview and block image capture.

The two asset preparation scripts accept external original-image paths; Sharp is needed only to regenerate assets. `previewTexture` is optional catalog metadata and does not replace materials in other modules. Photo provenance is in `public/shared/ASSETS.md`. Sprint screenshots, checks and limitations are documented in `verification/interior-photo/README.md`; sample offers are in `output/pdf/`.
