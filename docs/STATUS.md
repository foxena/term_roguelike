# NEONFALL — Status (resume here)

> **Read this first when resuming.** It is the live tracker of where we are and
> what to do next. Update it at the end of every work session. See `DESIGN.md`
> (what/why), `ARCHITECTURE.md` (how), `ROADMAP.md` (phase plan).

_Last updated: 2026-06-19 — end of Phase 0._

## TL;DR for a returning model

We are building **NEONFALL**, a fast-paced neon roguelite (Binding-of-Isaac
inspired) that runs in the terminal via OpenTUI but renders **real graphics**
(code-drawn neon-vector, true-colour pixel framebuffer). Direction and tech are
**locked and validated**. Gameplay is **not built yet** — next up is **Phase 1
(engine core & vertical slice)**.

## Current phase: ✅ Phase 0 complete → ▶ start Phase 1

### Done
- Tech direction locked (see DESIGN §3). All key decisions answered by the user.
- **`src/engine/pixelcanvas.ts`** — working neon pixel renderer (half-block,
  true colour, additive glow, bloom). Validated live + benchmarked (~1.37ms/
  frame at 80×46px, ~12× headroom).
- **`src/main.ts`** — Phase-0 neon title screen (`bun start`).
- **`scripts/render-proto.ts`** — pipeline benchmark/demo (run under a pty).
- Terminal glyph prototype archived to **`legacy/terminal/`** (reference; its
  flow-field / RNG / mapgen are reusable — see ARCHITECTURE §Reusable).
- Docs written: DESIGN, ARCHITECTURE, ROADMAP, STATUS.

### Not started
- Everything gameplay: engine loop, scenes, input, camera, particles, entities,
  combat, classes, rooms, items, bosses, meta tree, prestige, save system.

## ▶ Next actions (Phase 1, in order)

1. `src/engine/rng.ts` — port mulberry32 from `legacy/terminal/core/rng.ts`.
2. `src/engine/colors.ts` — neon palette + helpers (hex→rgb ints).
3. `src/engine/scene.ts` + `src/engine/loop.ts` — scene stack; fixed-timestep
   update (accumulator) + per-frame render. Remember: OpenTUI `deltaTime` is **ms**.
4. `src/engine/input.ts` — map keys to an `InputState` (held move dirs WASD,
   aim dirs arrows). Key-repeat grace pattern is in the legacy world (`requestMove`).
5. `src/engine/camera.ts` — world→canvas transform, follow player, screen shake.
6. `src/engine/particles.ts` — pooled SoA particle system.
7. `src/game/entities.ts` — continuous player (float pos/vel) + wall collision
   against a room tile grid.
8. One enemy type steered by a ported flow-field (`legacy/terminal/world/flowfield.ts`).
9. Basic attack (projectile + melee), hit → death → particle burst.
10. `src/render/world.ts` — draw room + entities + VFX into the PixelCanvas;
    minimal `src/render/hud.ts` (health).
- **Exit criteria**: walk a neon character around one room, fight one enemy
  type, see particles/juice, all runnable via `bun start` and typecheck-clean.

## How to run / verify

```bash
export PATH="$HOME/.bun/bin:$PATH"
cd ~/Documents/apps/term_roguelike
bun install                 # if needed
bun start                   # play/preview (needs a real terminal/TTY)
bun run typecheck           # tsc --noEmit, must stay clean

# Interactive TUI can be smoke-tested headlessly under a pty:
script -q /dev/null bun run scripts/render-proto.ts >/tmp/out 2>&1
# (the legacy headless sim/stress tests live in legacy/terminal/scripts/)
```

## Important facts / gotchas

- **Renderer not glyphs**: draw via `PixelCanvas`, blit with half-blocks. Text/
  HUD goes on top with `buffer.drawText`.
- **deltaTime is milliseconds** (OpenTUI). Convert to seconds in the sim.
- **Per-frame allocations**: keep ~zero in hot paths (reuse RGBA/buffers; SoA
  typed arrays + swap-remove for enemies/projectiles/particles).
- **`drawChar(codepoint:number, x, y, fg, bg)`** is the fast per-cell path;
  `0x2580` is ▀ (upper half block).
- **Git identity**: commits are globally set to `Elan Lunder
  <94677097+foxena@users.noreply.github.com>` (GitHub account foxena). Verify
  before committing. Remote: `foxena/term_roguelike` (public).
- **Working title NEONFALL** is a placeholder; user may rename.

## Open questions for the user (non-blocking)
- Game name (keep NEONFALL or rename?).
- Run length target (floors per run, rooms per floor) — assumed ~5–8 floors,
  ~8–12 rooms/floor until told otherwise.
- Pixel-art vs pure code-drawn was answered (code-drawn); revisit only if the
  look needs more fidelity.
