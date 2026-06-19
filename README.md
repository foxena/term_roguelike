# NEONFALL

A **fast-paced, neon-styled action roguelite** that runs in the terminal but renders **real graphics** — code-drawn neon-vector art via a true-colour pixel framebuffer, with bloom, particles, and dynamic glow. Inspired by *The Binding of Isaac*.

Built on [OpenTUI](https://opentui.com) + [Bun](https://bun.sh). Fully playable.

## Features

- **7 playable classes**: Warrior, Mage, Archer, Necromancer, Paladin, Rogue, Druid — each with unique attacks, abilities, and per-class VFX (embers, crystal runes, soul wisps, vine tendrils, holy aura, afterimages, bow trails)
- **5 enemy types**: Chaser, Swarmer, Brute, Shooter, Exploder — steered by a BFS flow-field (scales to hordes)
- **3 multi-phase bosses**: The Surge, The Warden, The Rift — with unique attack patterns and phase transitions
- **Procedural floors**: BFS room graph (combat/treasure/shop/boss/secret/start), 5 biome themes
- **20 items** (common → legendary): damage, speed, fire-rate, pierce, crit, regen, and more
- **Meta progression**: 15 meta-tree nodes, Essence currency, persistent across deaths
- **Prestige system**: reset the tree for permanent global multipliers — escalating and repeatable
- **14 achievements**, codex browser, help screen, toast notifications
- **Saved to** `~/.term_roguelike/save.json`

## Run

Requires [Bun](https://bun.sh):

```bash
curl -fsSL https://bun.sh/install | bash
bun install
bun start
```

## Controls

| Key | Action |
|-----|--------|
| `WASD` / `HJKL` | Move |
| Arrow keys | Aim + fire (hold to attack continuously) |
| `Space` | Class ability |
| `E` / Enter | Confirm in menus |
| `Tab` | Toggle minimap / hub tab |
| `Esc` / `P` | Pause |
| `R` | Restart (from death — returns to hub and awards Essence) |
| `H` | Hub (from class select) |
| `C` | Codex / achievements |
| `?` | Help screen |
| `Q` | Quit + save |

## How it works (the rendering)

Instead of terminal glyphs, the game rasterises glowing vector shapes into an RGB pixel buffer and blits it to the terminal using **upper-half-block characters** (`▀`) — each cell = two true-colour pixels. Additive blending + bloom creates the neon glow. All art is code-drawn; there are no asset files.

**Performance**: ~1.4ms/frame for the neon renderer; simulation handles 600+ enemies at ~0.014ms/frame via a Dijkstra flow-field.

## Documentation

| Doc | Contents |
|-----|----------|
| [`docs/STATUS.md`](docs/STATUS.md) | **Resume here** — current state, file map, open work |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Vision, pillars, locked decisions, class roster |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Code layout, rendering pipeline, system designs |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Phase plan (all phases implemented) |
