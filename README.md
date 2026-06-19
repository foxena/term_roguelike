# term_roguelike

A **fast-paced terminal roguelike** with hordes of enemies, built on
[OpenTUI](https://opentui.com) (Zig render core + Bun).

You are `@`. Caverns fill with monsters that swarm you from every direction in
real time. Move to survive, bump into enemies to strike them, and unleash a
`Space` cleave to clear the crowd. Each wave gets faster and denser.

```
☠ TERM ROGUELIKE                                            Wave 3   1:12
        ##########                          z
   #####            g   g                 g    @  g
   #     g    g  g     g   g     O      g       g  g
   #        g      g       g  g       g      g
HP ████████████░░░░░░░░ 62/100   Kills 184          Enemies 213
Move WASD/Arrows/HJKL+YUBN   Space Cleave   R Restart   Q Quit   42 FPS
```

## Run

Requires [Bun](https://bun.sh) (`curl -fsSL https://bun.sh/install | bash`).

```bash
bun install
bun start        # or: bun run dev   (auto-reload)
```

## Controls

| Keys | Action |
|------|--------|
| `W A S D` / arrows / `H J K L` | Move (4-directional) |
| `Y U B N` | Move diagonally |
| `Space` | Cleave — damage all adjacent enemies (short cooldown) |
| `R` | Restart (after death) |
| `Q` / `Ctrl-C` | Quit |

## Why it scales to hordes

The design choices that keep it smooth with hundreds of enemies on screen:

- **Dijkstra flow field** (`src/world/flowfield.ts`) — one breadth-first search
  from the player per tick gives *every* enemy its next step. Routing cost is
  O(map cells), independent of enemy count. This is the key technique.
- **Struct-of-arrays entities** (`src/world/world.ts`) — enemies live in flat
  typed arrays (`Int32Array`/`Int16Array`) for cache-friendly iteration, with
  O(1) swap-remove on death.
- **Occupancy grid** — an `Int32Array` of the map gives O(1) collision and
  bump-attack lookups instead of scanning the enemy list.
- **Throttled flow recompute** — the field is only rebuilt when the player
  changes tiles.

Measured headless (`bun run scripts/stress.ts`): **655 enemies at ~0.014ms per
simulation frame** (worst 0.15ms) — roughly 100× under a 60fps budget. The Zig
core handles rendering; only the visible viewport is drawn each frame.

## Layout

```
src/
  main.ts            entry: renderer, input, game loop wiring
  core/
    colors.ts        central palette
    rng.ts           seedable PRNG (mulberry32)
  world/
    map.ts           cellular-automata cave generation
    flowfield.ts     BFS distance field (enemy steering)
    world.ts         simulation: entities, AI, combat, waves, spawning
  render/
    render.ts        camera, lighting, HUD, game-over overlay
scripts/
  smoke.ts           headless gameplay sanity test
  stress.ts          horde performance benchmark
  boot-check.ts      boots the real TUI to verify the render path
```

## Tweaking

Gameplay constants live at the top of `src/world/world.ts` (player speed,
damage, enemy archetypes, wave pacing, spawn caps). Colors are in
`src/core/colors.ts`. Map size is `MAP_W`/`MAP_H` in `world.ts`.
