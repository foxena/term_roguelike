// NEONFALL — entry point (working title).
//
// Phase 0 bootstrap: proves the neon pixel pipeline as the live `bun start`
// build. It renders an animated neon title screen. Gameplay systems (engine
// loop, classes, rooms, progression) land in later phases — see docs/ROADMAP.md
// and docs/STATUS.md for exactly what's next.
import { createCliRenderer, BoxRenderable, RGBA, type KeyEvent } from "@opentui/core"
import { PixelCanvas } from "./engine/pixelcanvas.ts"

const TITLE = "N E O N F A L L"
const SUBTITLE = "a neon roguelite · working title"

const renderer = await createCliRenderer({ exitOnCtrlC: true, targetFps: 60 })

const canvas = new PixelCanvas(renderer.width, Math.max(1, renderer.height - 2))
const scratch = new Float32Array(canvas.data.length)
let t = 0

const layer = new BoxRenderable(renderer, {
  position: "absolute",
  left: 0,
  top: 0,
  width: renderer.width,
  height: renderer.height,
  border: false,
  renderAfter: (buffer, dt) => {
    t += dt / 1000
    const W = canvas.width
    const H = canvas.height
    canvas.clear(4, 6, 14)

    // Drifting neon orbs as an animated backdrop.
    const palette: [number, number, number][] = [
      [255, 60, 160],
      [60, 200, 255],
      [255, 210, 80],
      [150, 90, 255],
    ]
    for (let i = 0; i < palette.length; i++) {
      const a = t * (0.4 + i * 0.12) + i * 1.7
      const ox = W / 2 + Math.cos(a) * W * (0.18 + i * 0.06)
      const oy = H / 2 + Math.sin(a * 1.1) * H * (0.22 + i * 0.05)
      const [r, g, b] = palette[i]
      canvas.addGlow(ox, oy, 10 + Math.sin(t + i) * 2, r, g, b, 0.8)
      canvas.addDisc(ox, oy, 1.5, 255, 255, 255)
    }
    canvas.bloom(0.7, 2, scratch)
    canvas.blit(buffer, 0, 0)

    // Title + hints (cell-space text on top of the pixel layer).
    const cx = (renderer.width / 2) | 0
    const pulse = 180 + ((Math.sin(t * 3) * 0.5 + 0.5) * 75) | 0
    buffer.drawText(TITLE, cx - ((TITLE.length / 2) | 0), (renderer.height / 2) | 0, RGBA.fromInts(pulse, 255, 240))
    buffer.drawText(
      SUBTITLE,
      cx - ((SUBTITLE.length / 2) | 0),
      ((renderer.height / 2) | 0) + 1,
      RGBA.fromInts(120, 140, 200),
    )
    const hint = "Q to quit · gameplay coming in the next build"
    buffer.drawText(hint, cx - ((hint.length / 2) | 0), renderer.height - 1, RGBA.fromInts(90, 110, 150))
  },
})
renderer.root.add(layer)

renderer.on("resize", (w: number, h: number) => {
  layer.width = w
  layer.height = h
})

renderer.keyInput.on("keypress", (key: KeyEvent) => {
  if (key.name === "q") {
    renderer.stop()
    process.exit(0)
  }
})

renderer.start()
