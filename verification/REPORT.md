# Verification record — 8 October 2026

The six requested milestones were completed in the existing application. Architecture, brand loading, i18n, pure pricing, persistence, shared rendering and offline support were retained. The optional interior floor-photo overlay was omitted. Browser work used only @Browser.

## Build and automated checks

Each implementation milestone was followed by a successful build and test run. Final verification: **55 tests pass across seven files**, TypeScript/Vite production build succeeds, and the PWA reports **183 precache entries / 5600.71 KiB (5.47 MiB)**. See [test output](latest-tests.txt) and [build output](latest-build.txt). Rollup reports two harmless annotation warnings inside the Zod dependency.

| Test file | Checks | Count |
|---|---|---:|
| core | Existing brand/catalog, layout, collision, pricing, translation parity, homography and sharing behavior | 33 |
| demo-safety | Summary persistence restore, most recent/explicit kind, contact fallback, optional catalog sections/brand separation | 4 |
| offers | Private offer fields excluded from URLs, old furniture link migration, tiers/packages/LED pricing | 3 |
| realism | Hob/hood placement constraints and facade wall openings | 2 |
| exterior | Entrance size/options, window minimum/profile/options, installation/removal/VAT | 4 |
| interior | Pattern waste, whole packs, door-width perimeter deductions, installation/VAT, preset fit, share round-trip | 7 |
| assets | Local asset references and distinct texture identities | 2 |

## Responsive browser checks

Direct tab viewport overrides were applied to the production preview, after making it the selected built-in browser tab. All **32 final checks** have no horizontal page overflow. Every tool that displays a price keeps that price visible, including fixed phone price bars. The material preview and Home do not display a quotation total. A transient Summary overflow during tablet-to-phone resize was fixed by constraining its grid children.

Raw viewport, document width and price rectangles are recorded in [responsive-results.json](responsive-results.json). Classical scrollbars can reduce the available document width by 15 pixels.

| Screen | 1440×900 | 1024×768 | 768×1024 | 390×844 |
|---|---|---|---|---|
| Home, all tools | [image](screenshots/upgraded/home-1440x900.jpg) | [image](screenshots/upgraded/home-1024x768.jpg) | [image](screenshots/upgraded/home-768x1024.jpg) | [image](screenshots/upgraded/home-390x844.jpg) |
| Kitchen | [image](screenshots/upgraded/kitchen-1440x900.jpg) | [image](screenshots/upgraded/kitchen-1024x768.jpg) | [image](screenshots/upgraded/kitchen-768x1024.jpg) | [image](screenshots/upgraded/kitchen-390x844.jpg) |
| Wardrobe | [image](screenshots/upgraded/wardrobe-1440x900.jpg) | [image](screenshots/upgraded/wardrobe-1024x768.jpg) | [image](screenshots/upgraded/wardrobe-768x1024.jpg) | [image](screenshots/upgraded/wardrobe-390x844.jpg) |
| House | [image](screenshots/upgraded/house-1440x900.jpg) | [image](screenshots/upgraded/house-1024x768.jpg) | [image](screenshots/upgraded/house-768x1024.jpg) | [image](screenshots/upgraded/house-390x844.jpg) |
| Photo mode | [image](screenshots/upgraded/photo-1440x900.jpg) | [image](screenshots/upgraded/photo-1024x768.jpg) | [image](screenshots/upgraded/photo-768x1024.jpg) | [image](screenshots/upgraded/photo-390x844.jpg) |
| Interior | [image](screenshots/upgraded/interior-1440x900.jpg) | [image](screenshots/upgraded/interior-1024x768.jpg) | [image](screenshots/upgraded/interior-768x1024.jpg) | [image](screenshots/upgraded/interior-390x844.jpg) |
| Material preview | [image](screenshots/upgraded/materials-1440x900.jpg) | [image](screenshots/upgraded/materials-1024x768.jpg) | [image](screenshots/upgraded/materials-768x1024.jpg) | [image](screenshots/upgraded/materials-390x844.jpg) |
| Summary | [image](screenshots/upgraded/summary-1440x900.jpg) | [image](screenshots/upgraded/summary-1024x768.jpg) | [image](screenshots/upgraded/summary-768x1024.jpg) | [image](screenshots/upgraded/summary-390x844.jpg) |

## Browser behavior verified

- Kitchen Summary reload restores the design. After visiting wardrobe, an unqualified Summary restores wardrobe; `?kind=kitchen` restores kitchen.
- Setup Phone fills WhatsApp and Viber. Editing WhatsApp manually then changing Phone preserves WhatsApp and continues updating Viber. Dummy test values were not saved as a brand.
- Presentation mode hides the fictional-brand footer/offline badge. Turning it off restores the footer. The update prompt still appears with presentation enabled and successfully activates the final build.
- Kitchen displays the five front tiers, four countertop tiers, catalog handle names, package selector, visible hob/hood/fridge/sink and natural module wording.
- House and photo modes switch correctly. The house has physical product geometry; the photo has warped product/frame/glass layers. A marked demo scene loads with one selection. The direct before/after handle responds to keyboard movement.
- Interior room presets, herringbone waste/pack updates, opening a door and walk-through controls work. A copied interior share link survives a full reload with herringbone selected and eight packs. English/German phone layouts fit without overflow; Albanian was restored afterward.
- The final production tab error log is empty. No messages were sent, no real customer contacts were invented, and native messaging clients were not launched for sending.

## Export verification

Offers were downloaded from the app, their text extracted, their pages rendered and visually inspected. Logo, Unicode text, design image, item rows, totals and page footers fit. Long notes wrap and paginate without overlapping the image/table. The 1500-character note test uses an explicitly fictitious test customer, subsequently cleared from the local form.

- [Kitchen](kitchen-offer.pdf): 2 pages, correctly labelled countertop tier, installation and total.
- [Wardrobe](wardrobe-offer.pdf): 1 page, scene, module lines, installation and total.
- [House](house-offer.pdf): 1 page, six product lines with dimensions/options, installation and total.
- [Photo](exterior-photo-offer.pdf): 1 page, composite, test customer/city/salesperson/payment/notes and two placed products.
- [Interior](interior-offer.pdf): 2 pages, waste area → whole packs, underlay, skirting, four doors and separate floor/door installation.
- [Long-note pagination](screenshots/upgraded/long-notes-pages.png): both pages rendered side by side.

PDFs retain the fictional-demo disclosure to make example prices clear; presentation mode hides the application footer. Earlier root-level screenshots and `offer-sq/de` files are baseline evidence; the matrix above is the upgrade evidence.

## Offline proof on the final build

After activating the final service worker, the preview server on port 4175 was stopped. With that origin unavailable, @Browser successfully reloaded the interior shared design, generated [an interior PDF](interior-offline-offer.pdf), navigated to the house, loaded another marked photo scene and restored/rendered kitchen Summary. Presentation mode remained enabled on Drita Home. The error log remained empty. The preview server was restored afterward.

Evidence: [offline house](screenshots/upgraded/house-offline-390x844.jpg), [offline Summary](screenshots/upgraded/summary-offline-390x844.jpg). Code, catalogs, textures, demo scenes and the PDF Unicode font are local. New PBR maps are compressed 1K files; sources and derivations are in [ASSETS.md](../public/shared/ASSETS.md).

## Remaining physical-device checks and deliberate limits

- A physical mid-range Android tablet has not been benchmarked; **30+ fps is a target, not a measured result**. Performance mode disables normal maps, shadows and high DPR. Check touch dragging, the corner loupe, walk-through look, camera capture and native sharing on actual devices.
- WhatsApp/Viber buttons prepare drafts; sending requires the user's action and connectivity. Blank demo contacts fall back to recipientless WhatsApp. Set the authorized demo phone through `VITE_DEMO_CONTACT_PHONE` before a company-directed demo.
- The three photo scenes are original placeholder illustrations, not Kosovo property photographs. Replace them with authorized real photos using the README instructions.
- Materials and products are illustrative licensed/procedural demo assets, not supplier-certified models. The optional interior floor-photo overlay is not implemented.
