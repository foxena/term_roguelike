# NEONFALL — Design Document

> Working title: **NEONFALL** (rename freely). Repo: `foxena/term_roguelike`.
> This is the source of truth for *what* we're building and *why*. For *how the
> code is laid out* see `ARCHITECTURE.md`; for *what's done / next* see
> `STATUS.md`; for the phased plan see `ROADMAP.md`.

## 1. Vision

A **fast-paced, neon-styled action roguelite** that runs in the terminal but
**does not look like a terminal app**. Inspired by *The Binding of Isaac*:
top-down rooms, relentless enemy pressure, run-based progression with build
variety, and tough bosses that gate rewards. On top of Isaac's per-run item
builds we layer a **persistent meta upgrade tree** and a **prestige/reset
system** for long-term power growth.

It is rendered with a custom **code-drawn neon-vector art style** — glowing
shapes, bloom, particles, dynamic light — using a true-colour pixel framebuffer
blitted into the terminal (see ARCHITECTURE §Rendering). No external art assets.

## 2. Design pillars

1. **Fast & swarming** — many enemies on screen, real-time, readable chaos.
2. **Distinct class fantasies** — each class plays and *looks* unmistakably
   different, with its own palette, attack mechanic, and code-drawn VFX.
3. **Three layers of progression** — in-run item builds, a persistent meta tree,
   and prestige resets for escalating permanent power.
4. **Bosses as milestones** — every floor ends in a real fight with a unique
   reward.
5. **It looks alive** — neon glow, particles, screen shake, juice. The terminal
   is the display, not the aesthetic.

## 3. Locked decisions (with rationale)

| Decision | Choice | Why |
|----------|--------|-----|
| Platform / renderer | **OpenTUI** (terminal), custom **half-block true-colour pixel canvas** | User chose to stay on OpenTUI; validated it can render a real 2.5D neon look (see STATUS Phase 0). |
| Visual style | **Top-down 2.5D, neon-vector**, soft shadows for depth | User selection. Chunky low-res *flatters* neon. |
| Art source | **Programmatic / code-drawn** (no asset files) | User selection; keeps repo self-contained and style cohesive. |
| Combat / control | **Hybrid per class** (melee swing in facing dir; casters/ranged aim with arrows; summoners summon) | User selection. Maximises class identity. |
| Movement | **Continuous** (float positions/velocity), not tile-stepped | Needed for Isaac-style action feel; differs from the archived terminal prototype. |
| Progression | **Per-run items + persistent meta tree + prestige** | User selection (option A). No separate per-class trees; "buildable" classes come from item builds + meta investment. |
| Run loop | **Floors of procedurally-generated rooms; boss each floor; permadeath** | Genre standard, matches Isaac + prestige. |
| Persistence | **Save file at `~/.term_roguelike/save.json`** | Meta tree, unlocks, prestige, stats, settings. |
| Controls scheme | WASD move · Arrow keys aim/attack · Space = class ability · E interact · Tab map · Esc pause | Twin-stick-friendly; works on any terminal via key-repeat (release-events optional via kitty protocol). |

## 4. Core loop

```
Menu/Hub ──pick class──▶ RUN ──▶ Floor 1 (rooms…→ boss) ──▶ Floor 2 …
   ▲                                   │                         │
   │                              collect items,           death OR victory
   │                              gold, clear rooms              │
   └──spend Essence on Meta Tree / Prestige◀── earn Essence ─────┘
```

- **Run**: descend floors. Each floor is a grid of connected rooms (combat,
  treasure, shop, secret, boss). Clear a room (kill all enemies) to open its
  doors. Boss room ends the floor and drops a unique reward.
- **Death**: lose the run (items, gold). Keep **Essence** earned from depth +
  kills. Return to hub.
- **Meta tree**: spend Essence on permanent nodes (stats, crit, new starting
  items, class unlocks, utility).
- **Prestige**: reset the meta tree (and optionally unlocks) for **Prestige
  Points**, granting permanent global multipliers and unlocking new content
  (classes, tree branches, harder+richer modes). Repeatable and escalating.

## 5. Currencies

- **Gold** — in-run only, spent at shops. Lost on death.
- **Essence** — meta currency from runs (scales with depth/kills/bosses).
  Persists. Spent on the meta tree.
- **Prestige Points** — from prestige resets. Permanent multipliers/unlocks.

## 6. Classes

Hybrid combat: each class defines a movement profile, a primary attack, and a
Space ability, plus a unique palette + VFX signature. **Core roster (7)** ships
first across phases; **stretch roster** follows.

### Core roster
| Class | Palette | Primary attack | Ability (Space) | VFX signature |
|-------|---------|----------------|-----------------|---------------|
| **Warrior** | orange/red | Melee cleave arc in facing dir | Lunge/shockwave | sweeping slash arcs, sparks |
| **Mage** | blue/cyan | Aimed elemental bolts | AoE nova | crystalline bolts, orbiting runes |
| **Archer** | cyan/green | Rapid aimed piercing arrows | Multishot/volley | thin bright arrow streaks, trails |
| **Necromancer** | green/violet | Aimed bolt + raises minions | Summon swarm / corpse burst | soul wisps, tether lines to minions |
| **Paladin** | gold/white | Melee smite | Holy aura / shield ring | radiant rings, shield bubble |
| **Rogue** | violet/magenta | Fast short-range daggers | Dash + crit (afterimage) | motion afterimages, blade flurry |
| **Druid** | green/amber | Nature bolt / claw | Shapeshift (beast) / vines | organic growth, leaf particles |

### Stretch roster (post-core)
Berserker (rage/lifesteal spin), Warlock (curses/DoT + demon pet), Monk
(chi melee combos + dash strikes), Elementalist (swap fire/ice/lightning),
Bard (party auras + sonic waves). Add more if they earn their keep.

Classes are **unlocked** via the meta tree / prestige; the starting class is
always available.

## 7. Enemies & bosses

- **Enemies**: archetypes mirroring the prototype (chasers, fast swarmers,
  tanky brutes) plus ranged shooters, exploders, splitters. Steered by a
  flow-field toward the player (scales to hordes — proven in the prototype).
- **Bosses**: one per floor, multi-phase, telegraphed attack patterns, large
  neon set-piece visuals. Each drops a **unique reward** (a powerful item, a
  class unlock token, or bonus Essence) and may unlock meta-tree content.

## 8. Items (in-run builds)

Isaac-style passive/active pickups that stack and synergise: stat mods (damage,
fire rate, move speed, range, crit), projectile modifiers (pierce, split,
homing, bounce, multishot), on-hit/on-kill effects, and actives on a cooldown.
Builds are emergent and lost on death — the meta tree is the persistent layer.

## 9. Visual & audio direction

- **Neon-vector**: dark navy base; saturated glowing primaries; additive blend
  → white-hot cores with coloured halos; bloom; soft drop-shadows for 2.5D
  depth; particles for everything (hits, deaths, trails, ambient dust);
  screen shake + hit-stop for impact.
- **Per-class identity** through palette + brush shapes + particle behaviour.
- **Audio** (later): OpenTUI ships an audio module; optional retro SFX/music.

## 10. Out of scope (for now)

External image/sound assets; networked play; mouse-first controls (keyboard is
primary, mouse optional later). The archived terminal-glyph prototype in
`legacy/terminal/` is kept for reference only.
