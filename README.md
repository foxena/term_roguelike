# NEONFALL

> Working title. A **fast-paced, neon-styled action roguelite** that runs in the
> terminal but renders **real graphics** — code-drawn neon-vector art via a
> true-colour pixel framebuffer. Inspired by *The Binding of Isaac*: top-down
> rooms, swarming enemies, build-driven runs, tough bosses — plus a persistent
> meta upgrade tree and a prestige/reset system.

Built on [OpenTUI](https://opentui.com) + [Bun](https://bun.sh).

> **Status: early development.** The rendering engine is built and validated;
> gameplay is being implemented in phases. See **[`docs/STATUS.md`](docs/STATUS.md)**
> for exactly where things stand and what's next.

## Run

Requires [Bun](https://bun.sh) (`curl -fsSL https://bun.sh/install | bash`).

```bash
bun install
bun start          # neon title screen (Phase 0). Needs a real terminal.
bun run typecheck  # tsc --noEmit
```

## The look

Instead of glyphs, NEONFALL rasterises glowing vector shapes into an RGB pixel
buffer and blits it to the terminal using upper-half-block characters (`▀`) —
each cell becomes two true-colour pixels (fg = top, bg = bottom). Additive
blending + bloom give the neon glow; soft shadows give 2.5D depth. All art is
generated in code; there are no asset files. (Renderer: `src/engine/pixelcanvas.ts`.)

## Documentation (start here)

| Doc | What it covers |
|-----|----------------|
| [`docs/STATUS.md`](docs/STATUS.md) | **Resume here** — current state, next actions |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Vision, pillars, locked decisions, classes, loop |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Code layout, rendering pipeline, systems |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Phased build plan |

## Layout

```
src/
  main.ts             entry / neon title screen (Phase 0)
  engine/
    pixelcanvas.ts    neon true-colour pixel framebuffer + bloom + blit
scripts/
  render-proto.ts     pixel-pipeline benchmark/demo (run under a pty)
docs/                 DESIGN · ARCHITECTURE · ROADMAP · STATUS
legacy/terminal/      archived ASCII/glyph prototype (reference only)
```

## Legacy prototype

The original terminal **glyph** roguelike (flow-field hordes, cave generation,
SoA entities — 655 enemies @ 0.014ms/frame) lives in `legacy/terminal/`. It's
kept for reference; its flow-field, RNG and map-gen are being ported into the
new engine.
