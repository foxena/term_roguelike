# Legacy: terminal glyph prototype

This is the **original** version of the project: a fast-paced ASCII/glyph
roguelike rendered with terminal characters. It has been **superseded** by the
neon 2.5D pixel-rendered game in the repo root (see `../../docs/`), but is kept
for reference and because several systems are being ported into the new engine.

## What's here

```
main.ts            entry: renderer, input, real-time loop
core/{colors,rng}  palette + mulberry32 PRNG
world/map.ts       cellular-automata cave generation (largest-region connected)
world/flowfield.ts BFS distance field for enemy steering (count-independent)
world/world.ts     simulation: SoA enemies, AI, combat, waves, spawning
render/render.ts   glyph rendering: camera, lighting, HUD, game-over
scripts/           smoke (gameplay), stress (655 enemies @ 0.014ms/frame), boot-check
```

## Run it (from repo root)

```bash
bun run legacy/terminal/main.ts                 # play the glyph version
bun run legacy/terminal/scripts/smoke.ts        # headless gameplay test
bun run legacy/terminal/scripts/stress.ts       # horde performance benchmark
```

## Reused by the new engine

`world/flowfield.ts` (steering), `world/map.ts` (generation), `core/rng.ts`
(PRNG), and the SoA-entity / occupancy-grid patterns from `world/world.ts`.
See `../../docs/ARCHITECTURE.md` → "Reusable from the archived prototype".
