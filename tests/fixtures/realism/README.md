# Frozen Phase 0 compatibility inputs

Frozen on 13 October 2026 from clean commit `5860343e94efcb6ee94e774144e63748cdc3fb74`, before Phase 0 source edits. No browser/user drafts were read, reset or rewritten.

Each brand JSON contains its parsed brand/catalog, all five presentation presets with fixed document/cabinet IDs and preset cameras, complete SQ/EN/DE price lines/totals, a stripped legacy v1 document and v2 document, old compressed share envelopes (v1 and v2 nested documents; deployed/local brand variants), and kitchen/wardrobe A/B records.

A/B fixture images reuse the already bundled preset thumbnails. They are valid image payloads for record compatibility, **not screenshots of these frozen documents**. The new baseline screenshots live in `verification/showroom-realism/`. No new furniture model/texture was acquired or generated.

Normal tests only read these files. Do not regenerate fixtures to make a regression pass. A deliberate future catalog/schema change must explain any changed expected price or incompatibility. V1 migration must retain IDs and geometry; unknown future versions remain rejected. Phase 0 does not introduce v3, finish zones or editable interior entities.
