## Context: what I'm trying to achieve

I'm a freelance developer in **Kosovo**. I sell custom software to established businesses that make **kitchens, wardrobes, furniture, doors and windows**. I want to walk into a showroom with a phone or a tablet and show the owner a working tool that **already has their company name, logo, colors and products in it**.

Build a **white-label "Digital Showroom Designer"** web app with two tools:

1. **3D Kitchen & Wardrobe Designer**: a salesperson (or the customer at home) enters room dimensions, picks a layout, changes fronts, countertops and handles, and sees the result in real-time 3D with a live price estimate.
2. **Door/Window Photo Preview**: the customer uploads a photo of their house, picks a door model, and sees it placed realistically on their own house (before/after).

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
  doors/...         (optional client door PNGs with transparent background)
```

Choose the brand with `?brand=<slug>`, a subdomain (`<slug>.mydomain.com`), or a build-time env var. Fall back to a neutral default brand.

`brand.json` example:

```json
{
  "slug": "druri-design",
  "companyName": "Druri Design",
  "tagline": "Kuzhina me porosi që nga 2005",
  "logo": "logo.svg",
  "colors": { "primary": "#1F3A5F", "accent": "#C8A165", "background": "#FFFFFF", "text": "#1A1A1A" },
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
  "modules": { "kitchenDesigner": true, "wardrobeDesigner": true, "doorPreview": true }
}
```

`catalog.json` holds materials, modules, door models and **pricing rules** (see the Pricing section). Theme colors are applied through CSS variables so the whole UI recolors from `brand.json`.

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

## Tool 2: Door/Window Photo Preview ("See it on your house")

### Flow

1. Customer uploads or takes a photo of the house entrance (phone camera works on mobile).
2. They **drag 4 corner handles** to mark where the door goes. The selected door image is warped with a **perspective transform (homography)** to fit exactly. Use a canvas/WebGL implementation, not just CSS scaling.
3. Pick a door model from the catalog. Pick a color (where the model supports recoloring) and handle style.
4. Adjust brightness to match the photo's lighting, plus a slight shadow on the edges for realism.
5. **Before/After slider** to compare.
6. Download the result image, or send it to the company via WhatsApp/Viber with the model name and an indicative price.

### Door assets

- Door models are transparent PNGs listed in `catalog.json` with name, price and available colors.
- For the demo, include **6–10 door designs generated in code** (SVG or procedural): modern flat, horizontal grooves, vertical glass strip, classic panel, with recolorable surfaces (anthracite RAL 7016, white, golden oak, black). That way it works before I have a client's real photos.
- Also support the client's own door photos with background removed (just a PNG).
- Bonus if time allows: the same tool for **windows** (place several windows on a façade photo, pick frame color).

## Lookbook bridge (small)

Add a simple **"Material Switcher"** entry screen: one beautiful pre-made kitchen scene where the user switches the front finish and countertop with big swatches. A **"Design your own kitchen"** button leads into the full designer. This screen can also be embedded on the client's website (iframe-friendly route `/embed/material-switcher`).

## Demo data

- Include **two complete demo brands**: one kitchen/furniture company and one doors/windows company, with fictional Kosovo-style names, realistic catalog data and realistic Kosovo market prices in EUR.
- Include **3 ready-made example kitchen designs** (modern handleless L-shape in anthracite + oak, classic white U-shape, minimalist straight kitchen with island) that load with one tap, so the demo looks good in the first 5 seconds.
- A **"Demo reset"** button in settings.

## Scope: demo now, production later

Build a **demo-ready MVP**: everything on the main path must work flawlessly and look polished. Structure the code so it's easy to extend later. **Do NOT build yet:**
- user accounts, backend, database, admin panel for editing the catalog through a UI (editing JSON is fine for now)
- exact manufacturing output (cut lists, CNC export)
- payment integration

Keep clean boundaries (`/brand`, `/catalog`, `/pricing`, `/designer3d`, `/doorPreview`, `/i18n`) so a backend can be added later without rewrites.

## Work plan

Work in milestones and make sure the app runs after each one:
1. Project setup, brand system, theming, i18n, PWA shell, `/setup` page
2. Procedural cabinet generator + room + straight layout + materials
3. L/U/parallel/island layouts, cabinet editing, snapping, door/drawer animations
4. Pricing engine + summary + share link + PDF + WhatsApp/Viber send
5. Door photo preview with homography, before/after, export
6. Material Switcher screen, example designs, demo brands, performance pass on tablet

Before you start coding, briefly give me the plan and folder structure. At the end, write a `README.md` with:
- how to run it
- how to add a new brand in under 15 minutes (step by step)
- how to edit catalog prices
- how to deploy
