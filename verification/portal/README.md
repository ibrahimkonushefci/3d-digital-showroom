# Entrance and Window Studio — verification

Implemented locally on 10 October 2026. No deployment or publication was performed. Existing kitchen, wardrobe and interior changes in the working tree were retained.

## Delivered behavior

| Phase | Result |
| --- | --- |
| Draft compatibility | New studio quotes contain one default door. Existing six-item facades and custom placement IDs restore intact. Studio and photo products, quote settings and offer details persist independently. Shared documents dispatch by their existing view. Legacy photo records are backed up before replacing their facade storage key. |
| Shared model | A compensated left hinge pivot opens the leaf outward while the frame, threshold, sidelights and transom stay stationary. Leaf glazing and hardware move together. Bevels, seals, rebates, rear faces and threshold detail were added. Handle finish is independent of structural metal. Material tiers control physical surface response, while finishes supply colour/normal/roughness maps. Grain remains continuous and vertical across cutouts. |
| Studio | The house, fence, roof, balcony, lawn and repeated plants were replaced by a recessed concrete wall, travertine landing, canopy and warm practical lights. Windows use a matching wall display. Generated reflections and existing local textures remain offline compatible. Bounds/aspect-based cameras cover full product, handle/profile, glass and interior. |
| Configuration | Visual quote/model/configuration cards, material choices and outside/inside swatches replace the product dropdown and collapsed accessories. Handle length, colour and LED are independent; fingerprint remains separate. Door opening uses a labelled button. The same controls and dimension-preserving window application are available in photo mode. Imported hardware conflicts remain visible until replaced. Selected-item estimates and quote totals are distinct. |
| Offers | Numeric rates/formulas remain unchanged. Descriptions include dimensions, material, profile/glazing where relevant, outside/inside finishes and priced accessories. Studio PDFs capture the full closed selected product, label it, list every item and restore the user's view/open state. Photo PDFs use the current composite. Home/development presentation and the showroom thumbnail use the new studio. |

Facade `version:1`, `kind:"facade"` and `view:"house"|"photo"` remain unchanged. `finishInsideId` is optional. Legacy `colorInside` still supplies a plain rear colour; no inside override means matching the outside. Camera/open state does not enter saved/shared quotes or pricing. Selecting wood from a plain non-wood finish chooses golden oak; loading a design or clicking an already selected wood tier does not replace its finish. Explicit painted wood finishes remain valid.

## Automated checks

- **98 tests passed** across 12 files, including the original 86 tests and 12 portal regressions. See [test log](tests.txt).
- **TypeScript and production build passed.** See [build log](build.txt).
- Shipped assets: **9,064,604 bytes**; unique precache: **9,029,480 bytes**, below the enforced 10,000,000-byte ceiling. The build's advisory warning above 9 MB remains; no new remote HDRI or texture package was added.
- Targeted whitespace checks passed for this implementation. The global working tree also contains a pre-existing trailing blank line in `tests/interior-photo.test.ts`, which was left untouched.

Regressions cover default creation, independent share dispatch, legacy photo backup and six-item restoration, inside finish validation, preservation of imported options/colours, explicit wood switching, dimension/corner-preserving window application, numeric pricing stability, hinge invariance and closed alignment, stationary surrounds, rear surfaces and independent metals, arbitrary wall openings, camera fitting, pane/stack/track geometry, continuous UVs and shared texture ownership.

## Browser and export evidence

All interaction used **@Browser**, the built-in browser. No Firefox or alternate browser automation was used.

| Viewport | Client width / scroll width | Visible exterior buttons below 44 px |
| --- | --- | --- |
| 1440 × 900 | 1425 / 1425 | None |
| 1024 × 768 | 1009 / 1009 | None |
| 768 × 1024 | 753 / 753 | None |
| 390 × 844 | 375 / 375 | None |

Measurements exclude the normal browser scrollbar. [Raw measurements](responsive.json) and final production screenshots: [desktop](production-desktop.jpg), [tablet landscape](production-tablet-landscape.jpg), [tablet portrait](production-tablet-portrait.jpg), [phone](production-phone.jpg), [scrolled phone product](production-phone-product.jpg). The phone price is in normal page flow and does not cover the product or controls.

Additional checks and evidence:

- Wood/default/painted finishes, independent rear white finish, open/close and camera controls: [open door](door-open.jpg), [inside finish](inside-finish.jpg), [hardware detail](production-handle-detail.jpg).
- Window model/pane count, triple glazing, sliding, roller shutter visibility and keyboard activation: [window studio](window-studio.jpg). Applying a 95 × 120 cm configuration to the other 140 × 140 cm window retained both sizes, in studio and photo mode.
- Old six-item share restored with all cards and a €2,725–€3,136 quote: [German legacy view](legacy-six-items-de.jpg). Shared photo import retained a custom ID, walnut, legacy inside colour and conflicting 120/160 cm handles; its €1,749–€2,013 quote survived photo upload and mode switching. [Fixtures](fixtures.json) use the real compressed share encoder.
- Four-corner photo fitting, before/after keyboard control, rapid golden-oak → white finish changes and export: [phone photo editor](photo-phone.jpg), [current white photo export](photo-export.png). The photograph/configuration/corners restored after reopening the plain route. Homography mathematics, corner validation and ambient sampling were retained.
- [Representative three-item studio offer](../../output/pdf/portal-studio-offer.pdf): two pages, every page rendered and visually checked. It was generated while the door was open; the PDF image is closed and the original open view returned afterward. [Restored view](pdf-restored-open-view.jpg), [page 1](offer-1.png), [page 2](offer-2.png).
- [Photo offer](photo-offer.pdf): the latest white composite and unchanged hardware/quote descriptions. Both pages rendered and visually checked: [page 1](photo-offer-1.png), [page 2](photo-offer-2.png).

## Production update and offline check

The local production preview was restarted after rebuilding. Before restart, it continued serving an older revision; restarting resolved that condition. “Save and update” then activated the rebuilt assets. The final loaded entry `/assets/index-BCXZkxmB.js` matches `dist/index.html`. [Production console](console.json) contains no warnings or errors. Development-only React context hot-reload errors during parent-module edits disappeared on full reload and were not reproduced in production.

Offline checks stopped the agent-created preview server on port 4174 and confirmed there was no listener with `lsof` ([empty listener output](offline-listener.txt), exit 1). With that server stopped, the cached production page reloaded, restored the photo and studio drafts, and exported both an image and a studio PDF. The photo quote remained €1,501–€1,727 and the two-item studio quote €2,734–€3,146. Door-open state returned after the closed PDF capture.

Evidence: [offline photo](offline-photo.jpg), [offline image export](offline-photo-export.png), [offline studio](offline-studio.jpg), [offline PDF](offline-studio-offer.pdf), [rendered PDF page 1](offline-offer-1.png), [page 2](offline-offer-2.png). These offline checks preceded the final UI-only addition of photo window application/selected estimates; persistence, factory and export code were unchanged afterward. The offline browser navigation call took substantially longer than the online calls; no physical-device offline latency claim is made.

The preview was restored afterward at `http://127.0.0.1:4174/preview?brand=default`. The user's pre-existing port-4173 preview process was left running.

## Remaining hardware acceptance

Physical iPad/Android frame rate, memory pressure, touch/loupe behavior, camera capture, installed-PWA updates and native file/WhatsApp/Viber sharing need checks on the actual showroom devices. Browser viewport emulation does not establish those capabilities. Window-sash animation is intentionally deferred. Products/materials remain illustrative procedural previews, with no supplier certification or manufacturing tolerances claimed.
