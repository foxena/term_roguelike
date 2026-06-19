# NEONFALL — Status (resume here)

> **Read this first when resuming.** The live tracker of where things stand.
> See `DESIGN.md` (what/why), `ARCHITECTURE.md` (how), `ROADMAP.md` (phase plan).

_Last updated: 2026-06-19 — all phases 0–10 complete._

## TL;DR for a returning model

**All 10 phases are implemented and committed.** The game is fully playable:
class-select → run → collect items → die/beat boss → return to hub →
spend Essence on meta tree → optionally prestige → play again.

`bun start` launches the game. `bun run typecheck` is clean.

## ✅ All phases complete

| Phase | Status | Key deliverables |
|-------|--------|-----------------|
| 0 | ✅ | PixelCanvas neon renderer, docs, archive |
| 1 | ✅ | Engine (loop/input/camera/particles/flow-field), 7 classes, class-select |
| 2 | ✅ | Spatial hash, hit-stop, damage numbers, status effects, combat juice |
| 3 | ✅ | BFS floor graph, 6 room types, room transitions, minimap |
| 4 | ✅ | 20 items (common→legendary), treasure rooms, shops, HP regen |
| 5 | ✅ | 3 bosses (Surge/Warden/Rift), multi-phase, attacks, orbiting VFX |
| 6+7 | ✅ | 15 meta-tree nodes, prestige, ~/.term_roguelike/save.json, hub UI |
| 8 | ✅ | Per-class ambient VFX (ember ring, crystal runes, soul wisps, etc.) |
| 9 | ✅ | 5 biomes (colour palettes per floor), floor progression |
| 10 | ✅ | 14 achievements, codex screen, help screen, toast notifications |

## What exists

```
src/
  main.ts                   entry: screen-state machine (class_select/hub/game/codex/help)
  engine/
    pixelcanvas.ts          neon pixel renderer (glow/disc/line/bloom/blit/fillRect)
    rng.ts colors.ts        utilities
    input.ts camera.ts      input state + camera
    particles.ts            SoA pooled particles
    flowfield.ts            BFS distance field
    scene.ts                scene stack
    spatialhash.ts          broad-phase collision
    hitstop.ts              frame-freeze juice
    damagenumbers.ts        floating damage text
  game/
    room.ts                 tile-grid rooms
    floor.ts                procedural BFS floor graph
    biomes.ts               5 floor themes
    entities.ts             Player, EnemyPool SoA (5 types), ProjectilePool SoA
    combat.ts               circle hits, melee arc, hurt helpers
    statuseffects.ts        burn/poison/slow/stun/freeze
    items.ts                20 items, PlayerStats, applyItem
    achievements.ts         14 achievements with check functions
    gamescene.ts            main game loop (ties everything together)
    classes/
      classactions.ts       7 class primaries + abilities
      classvfx.ts           7 class ambient VFX (unique per class)
    bosses/
      bossdefs.ts           3 boss defs (attacks, phases, rewards)
      bosssystem.ts         boss update/draw/hurt loop
    progression/
      run.ts                RunStats
      metatree.ts           15 meta nodes, MetaProgress, computeMetaBonus
      prestige.ts           prestige reset + escalating cost
      save.ts               async load/save ~/.term_roguelike/save.json
  render/
    world.ts                room/enemy/projectile/player draw (biome-aware)
    hud.ts                  HP bar, ability CD, death/pause overlays
    minimap.ts              top-right room-type minimap
    hub.ts                  3-tab hub (tree/prestige/stats)
    codex.ts                achievements browser + help screen
    screens.ts              treasure/shop/run-summary overlays
```

## How to run

```bash
export PATH="$HOME/.bun/bin:$PATH"
cd ~/Documents/apps/term_roguelike
bun install       # if needed
bun start         # play (needs a real TTY)
bun run typecheck # must stay clean
```

## Controls (quick ref)

```
WASD / HJKL       Move
Arrow keys         Aim + fire (hold to attack; melee classes swing in dir)
Space              Class ability (cooldown varies)
E / Enter          Confirm in UI (item/shop selection)
Tab                Minimap toggle / hub tab switch
Esc / P            Pause
R                  Restart from death → return to hub (awards essence)
H                  Hub (from class select)
C                  Codex/achievements
?                  Help screen
Q                  Quit + save
```

## Open questions / nice-to-haves

- Sound: OpenTUI has an audio module (`@opentui/core` audio exports) — adding
  SFX/music would complete the experience. Not implemented yet.
- More bosses/items: the data-driven architecture makes this straightforward.
- Minion system for Necromancer: currently ability fires bolts; true minions
  (allied entities that persist) would make Necro more distinct.
- Daily seed / challenge modes: seeded RNG is already wired (RNG class), just
  needs a UI to enter a seed.
- Mouse support: OpenTUI supports mouse events — not wired yet.
- Performance at very large terminals: current half-block blit is O(cells).
  For terminals wider than ~200 cols, consider `drawSuperSampleBuffer`.

## Important facts / gotchas

- **deltaTime from OpenTUI is in milliseconds**. Divide by 1000 before simulation.
- **Per-frame allocations**: keep ~zero in hot paths — SoA + swap-remove.
- **`drawChar(0x2580, x, y, fg, bg)`** is the half-block blit primitive.
- **Git identity**: globally set to `Elan Lunder <94677097+foxena@users.noreply.github.com>`.
  Remote: `foxena/term_roguelike` (public). Verify `git config user.email` before committing.
- **Working title NEONFALL** — user may rename.
- Save file: `~/.term_roguelike/save.json` (created on first quit).
