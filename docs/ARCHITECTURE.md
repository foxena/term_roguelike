# NEONFALL — Architecture

> How the code is organised and how the systems fit together. Pairs with
> `DESIGN.md` (what/why) and `STATUS.md` (current state). Update this when the
> structure changes.

## Stack

- **Runtime**: Bun (installed at `~/.bun`). TypeScript, ESM, `.ts` imports.
- **UI/terminal**: `@opentui/core` (v0.4.x). We use its renderer + input + a
  fullscreen `BoxRenderable` whose `renderAfter` hook draws each frame.
- **No build step**: run sources directly with `bun run src/main.ts`.

## Rendering pipeline (the core technical bet — validated, Phase 0)

We do **not** draw the game with glyphs. We rasterise neon-vector graphics into
a true-colour **pixel framebuffer** and blit it to the terminal.

```
game state ──▶ WorldRenderer draws shapes/glow/particles into PixelCanvas
                         │  (additive RGB float buffer, HDR-ish)
                         ▼
                  PixelCanvas.bloom()  (separable blur + add)
                         ▼
        PixelCanvas.blit(buffer)  ── upper-half-block ▀ per cell:
                         │            fg = top pixel, bg = bottom pixel
                         ▼
                OpenTUI OptimizedBuffer ──▶ terminal (true colour)
```

- **`src/engine/pixelcanvas.ts`** (`PixelCanvas`) — DONE. Resolution is
  `width` px across = terminal columns, `height` px = rows × 2 (half-block
  doubles vertical; cell aspect makes pixels ~square). Primitives: `clear`,
  `addPixel`, `addGlow`, `addDisc`, `addLine`, `bloom`, `blit`. Colours
  accumulate additively; tone-mapped (clamped) only at blit. Blit reuses two
  `RGBA` instances and writes colour bytes directly (no per-cell allocation),
  using `buffer.drawChar(0x2580, …)` (numeric codepoint = fast path).
- **Perf** (validated, 80×46px / ~57fps): ~0.84ms draw incl. bloom + ~0.53ms
  blit = ~1.37ms/frame, ~12× under the 16.6ms budget. Scales ~linearly with
  pixel count; revisit native `drawSuperSampleBuffer` only if large terminals
  need it.
- HUD/text is drawn as normal cells **on top** of the pixel layer with
  `buffer.drawText`.

## Target module layout (built out across phases)

```
src/
  main.ts                  entry; boots renderer + scene stack       [Phase 0 ✓ placeholder]
  engine/
    pixelcanvas.ts         neon pixel framebuffer + blit             [DONE]
    loop.ts                fixed-timestep update / variable render   [Phase 1]
    input.ts               keypress → InputState (held dirs, aim)    [Phase 1]
    camera.ts              world↔pixel transform, follow, shake      [Phase 1]
    scene.ts               scene stack (Menu/Hub/Run/GameOver)       [Phase 1]
    particles.ts           pooled particle system (SoA)              [Phase 1]
    rng.ts                 seedable PRNG (port from legacy)          [Phase 1]
    colors.ts              palette + color helpers                   [Phase 1]
    spatialhash.ts         broad-phase for hit detection             [Phase 2]
  game/
    entities.ts            player/enemy/projectile/minion/pickup     [Phase 1–2]
    combat.ts              damage, hit detection, status effects     [Phase 2]
    ai.ts                  flow-field steering + behaviours          [Phase 2]
    classes/               one module per class (stats+attack+VFX)   [Phase 2,8]
    floor.ts               procedural floor (room graph)             [Phase 3]
    room.ts                room layout, walls, doors, spawn sets     [Phase 3]
    items.ts               item defs + effect hooks                  [Phase 4]
    shop.ts                shop rooms / economy                      [Phase 4]
    bosses/                boss defs + attack patterns               [Phase 5]
    progression/
      run.ts               per-run state (items, gold, stats)        [Phase 4]
      meta.ts              meta tree + essence                       [Phase 6]
      prestige.ts          prestige resets + permanent buffs         [Phase 7]
      save.ts              load/save ~/.term_roguelike/save.json     [Phase 6]
  render/
    world.ts               draw floor/entities/VFX into PixelCanvas  [Phase 1–2]
    hud.ts                 health, ability, currencies, minimap      [Phase 2–3]
    screens.ts             menu/hub/tree/gameover screens            [Phase 6]
  data/
    enemies.ts items.ts metatree.ts ...   data-driven content        [later]
docs/                      DESIGN / ARCHITECTURE / ROADMAP / STATUS
scripts/render-proto.ts    neon pipeline benchmark/demo (pty)        [DONE]
legacy/terminal/           archived glyph prototype (reference only)
```

## Key system designs

- **Game loop** (`engine/loop.ts`): accumulator-based fixed timestep for the
  simulation (deterministic combat) with rendering every frame. OpenTUI gives
  `deltaTime` in **milliseconds** via `setFrameCallback` / `renderAfter`.
- **Coordinates**: world space in floats (1 unit = 1 pixel of the canvas, or a
  chosen scale). Camera maps world→canvas pixels. Movement is continuous;
  walls/obstacles use a coarse tile grid per room for collision + flow-field.
- **Entities**: hot collections (enemies, projectiles, particles) as
  struct-of-arrays typed arrays with swap-remove — the pattern proven in the
  prototype (655 enemies @ 0.014ms/frame). Player/bosses can be richer objects.
- **AI**: reuse the **flow-field** concept from `legacy/terminal/world/` — one
  BFS from the player per tick over the room's tile grid steers all enemies in
  O(cells), independent of count. Add steering/separation for smooth movement.
- **Hit detection**: circle-vs-circle via a spatial hash (`spatialhash.ts`) for
  projectiles vs enemies and melee arcs vs enemies.
- **Classes**: each class is a module implementing a small interface
  (`describe()` stats/palette, `primary(world, dir)`, `ability(world)`,
  `drawPlayerVFX(canvas, …)`). The combat/render systems call these hooks so
  class identity lives in one place.
- **Content as data**: enemies, items, meta-tree nodes defined in `data/` so
  balancing/adding content doesn't touch systems.

## Conventions

- 2-space indent, no semicolons (match existing files), descriptive names,
  comments explain *why* not *what*.
- Keep per-frame allocations near zero in hot paths (reuse buffers/objects).
- Every phase stays runnable (`bun start`) and typechecks (`bun run typecheck`).

## Reusable from the archived prototype (`legacy/terminal/`)

- `world/flowfield.ts` — BFS distance field (port directly).
- `world/map.ts` — cellular-automata generation (adapt for cave-style rooms).
- `core/rng.ts` — mulberry32 PRNG (port to `engine/rng.ts`).
- Enemy archetype/spawn/occupancy ideas from `world/world.ts`.
