# Kitchen studio rendering verification — 9 October 2026

Implemented a 35° camera fitted to cabinet bounds for perspective and front views, with a 1.55 m perspective eye height. Authored presentation cameras retain their horizontal viewing direction. Top view retains the whole room and accounts for tall cabinet height. Drag previews do not repeatedly reposition the camera.

The studio uses a slate background (#1e222b), neutral grey default walls (#d4d8df), reduced ambient/hemisphere/environment fill, and one dominant directional sun with a 2048 shadow map. Shadow coverage expands for larger furniture bounds; the 1 mm normal bias retains shadows from small handles. Cutaway walls receive shadows without obstructing the studio light. The crisp shadow filter applies to the furniture scene; other renderers retain their existing filter.

Solid front finishes use MeshPhysicalMaterial with roughness 0.4, metalness 0.02, clearcoat 0.35, clearcoat roughness 0.35 and environment intensity 1. Wood fronts retain their texture and roughness maps. Doors and drawers use 6 mm gaps and a 12 mm forward offset. Graphite handles use metalness 0.9 and roughness 0.28. New kitchen designs and kitchen presentation presets default to black plinths; matching plinths remain selectable. The plinth face is approximately 47 mm behind the closed door faces.

Validation:

- `pnpm test`: 84 tests passed across 11 files, including pricing tests and new framing regression checks for straight, L, U, parallel and island layouts at three aspect ratios and all camera presets.
- `pnpm build`: TypeScript, Vite and asset-budget checks passed. Shipped assets: 8,702,745 bytes; unique precache: 8,667,787 bytes.
- `git diff --check`: passed.
- Visual QA used only Codex @Browser: checked the Cabinet Studio live sample, L and straight kitchen views, dark and light fronts, graphite handles, diagonal cabinet/worktop/handle shadows, and the whole-room top preset.
- Production preview initially served the previous cached PWA. Used the app's “Ruajeni dhe përditësojeni” action, then verified the new entry asset `index-DhtvErWT.js` and the updated slate/shadow rendering. No console warnings or errors were captured on the updated production page.
- Restored the development demo's original L layout, anthracite fronts and handleless choice after visual tests. Restored the production demo's original front finish after its light-front check.

Evidence:

- [Straight front view](front.jpg)
- [Straight perspective view](perspective.jpg)
- [Production L front view](production-front.jpg)

Existing performance mode continues to disable shadows. This verification covers browser rendering, not measured physical-device performance.
