# NEONFALL — Roadmap

> Phased plan. Each phase is a coherent, committable, runnable increment. Check
> items off in `STATUS.md` (the live tracker) — keep this file as the plan,
> STATUS as the current position. Commit progressively (one or more commits per
> phase) to `foxena/term_roguelike`.

Legend: ☐ todo · ◐ in progress · ☑ done

## Phase 0 — Tech validation & foundation ☑
- ☑ Decide direction (OpenTUI, neon 2.5D, code-drawn, hybrid combat, meta+prestige)
- ☑ Build `PixelCanvas` half-block true-colour renderer with glow + bloom
- ☑ Validate live in a pty; benchmark (~1.37ms/frame)
- ☑ Archive terminal glyph prototype to `legacy/terminal/`
- ☑ Write design/architecture/roadmap/status docs
- ☑ Neon title-screen bootstrap as `bun start`

## Phase 1 — Engine core & vertical slice ☐
Goal: walk a neon character around one room, dodge one enemy type, fire a basic
attack, with particles. Proves the real-time engine end-to-end.
- ☐ `engine/rng.ts`, `engine/colors.ts` (port from legacy)
- ☐ `engine/loop.ts` fixed-timestep loop + scene stack (`engine/scene.ts`)
- ☐ `engine/input.ts` (held movement dirs + aim dirs)
- ☐ `engine/camera.ts` (world→canvas, follow, screen shake)
- ☐ `engine/particles.ts` (pooled SoA particles)
- ☐ Continuous player entity + wall collision on a room tile grid
- ☐ One enemy type using ported flow-field steering
- ☐ Basic projectile + melee hit, death, particle bursts
- ☐ `render/world.ts` draws floor/entities/VFX; minimal `render/hud.ts`

## Phase 2 — Combat depth & first classes ☐
Goal: 3 fully distinct classes; varied enemies; satisfying combat juice.
- ☐ `engine/spatialhash.ts` + `game/combat.ts` (circle hits, status effects)
- ☐ Class interface + **Warrior**, **Mage**, **Archer** (unique attacks + VFX)
- ☐ Enemy archetypes (chaser, swarmer, brute, ranged shooter, exploder)
- ☐ Hit-stop, screen shake, damage numbers, death FX
- ☐ HUD: health, ability cooldown, simple class indicator

## Phase 3 — Procedural floors & rooms ☐
- ☐ `game/room.ts` (layouts, walls/obstacles, doors, spawn sets)
- ☐ `game/floor.ts` (room graph: combat/treasure/shop/secret/boss)
- ☐ Room clear → doors open; room transitions; camera per room
- ☐ Minimap / floor map (Tab)

## Phase 4 — Run economy & item builds ☐
- ☐ `game/progression/run.ts` (run stats, gold, held items)
- ☐ `game/items.ts` (passives/actives, stacking, synergies) + pickups
- ☐ `game/shop.ts` shop rooms; treasure/item rooms
- ☐ Stat pipeline (base × meta × items) feeding combat

## Phase 5 — Bosses ☐
- ☐ `game/bosses/` framework (phases, telegraphed patterns, big neon visuals)
- ☐ 1–2 bosses with unique rewards (item / class token / essence)
- ☐ Boss room + victory/reward flow

## Phase 6 — Meta progression & persistence ☐
- ☐ `game/progression/meta.ts` meta tree (nodes, costs, effects)
- ☐ Essence earning (depth/kills/bosses) + run-summary screen
- ☐ `game/progression/save.ts` → `~/.term_roguelike/save.json`
- ☐ Hub/menu + meta-tree screen (`render/screens.ts`)

## Phase 7 — Prestige ☐
- ☐ `game/progression/prestige.ts` reset for Prestige Points
- ☐ Permanent escalating multipliers + content unlocks (classes, branches, modes)
- ☐ Prestige screen + confirmation flow

## Phase 8 — Full class roster ☐
- ☐ **Necromancer** (minions + tethers), **Paladin** (auras/shield),
  **Rogue** (dash/afterimages), **Druid** (shapeshift/vines)
- ☐ Frameworks they introduce: allied entities, auras, dash i-frames, stances
- ☐ Stretch classes (Berserker, Warlock, Monk, Elementalist, Bard) as warranted

## Phase 9 — Content, biomes & polish ☐
- ☐ More enemies/items/bosses; floor themes/biomes (palette + hazards)
- ☐ Audio (OpenTUI audio module): SFX + music, toggle
- ☐ Balance pass; options/settings; pause menu
- ☐ Performance pass for large terminals (consider native pixel blit)

## Phase 10 — Meta features ☐
- ☐ Achievements, stats/codex, daily seed runs, challenge modes
- ☐ Onboarding/tutorial room; controls remap

## Cross-cutting (every phase)
- Commit progressively with the foxena identity (already global).
- Keep `bun start` runnable and `bun run typecheck` clean.
- Update `STATUS.md` at the end of each work session.
