// Validates the neon pixel-canvas pipeline live in a terminal (needs a pty).
// Animates glowing orbs + a projectile with bloom, measures blit cost, and
// exits after a few seconds. Run: script -q /dev/null bun run scripts/render-proto.ts
import { createCliRenderer, BoxRenderable } from "@opentui/core"
import { PixelCanvas } from "../src/engine/pixelcanvas.ts"

const renderer = await createCliRenderer({ exitOnCtrlC: true, targetFps: 60 })
const W = renderer.width
const cellRows = renderer.height - 1 // leave a HUD row
const canvas = new PixelCanvas(W, cellRows)
const scratch = new Float32Array(canvas.data.length)

let t = 0
let frames = 0
let blitSum = 0
let blitMax = 0
let drawSum = 0

const layer = new BoxRenderable(renderer, {
  position: "absolute",
  left: 0,
  top: 0,
  width: renderer.width,
  height: renderer.height,
  border: false,
  renderAfter: (buffer, dt) => {
    t += dt / 1000
    const H = canvas.height

    const ds = performance.now()
    canvas.clear(4, 6, 14) // deep navy base

    // Neon orbs orbiting the centre.
    const cx = W / 2
    const cy = H / 2
    const orbs: [number, number, number, number, number][] = [
      [cx + Math.cos(t) * W * 0.3, cy + Math.sin(t) * H * 0.3, 255, 60, 160], // pink
      [cx + Math.cos(t * 1.3 + 2) * W * 0.25, cy + Math.sin(t * 1.3 + 2) * H * 0.25, 60, 200, 255], // cyan
      [cx + Math.cos(-t * 0.8 + 4) * W * 0.35, cy + Math.sin(-t * 0.8 + 4) * H * 0.2, 255, 210, 80], // gold
    ]
    for (const [ox, oy, r, g, b] of orbs) {
      canvas.addGlow(ox, oy, 9, r, g, b, 0.9)
      canvas.addDisc(ox, oy, 1.6, 255, 255, 255)
    }
    // A projectile streaking across with a glowing trail.
    const px = (t * 40) % W
    canvas.addLine(px - 8, cy, px, cy, 120, 255, 180)
    canvas.addGlow(px, cy, 3, 160, 255, 200, 1)

    canvas.bloom(0.7, 2, scratch)
    drawSum += performance.now() - ds

    const bs = performance.now()
    canvas.blit(buffer, 0, 0)
    const bms = performance.now() - bs
    blitSum += bms
    if (bms > blitMax) blitMax = bms

    frames++
  },
})
renderer.root.add(layer)

setTimeout(() => {
  process.stderr.write(
    `[proto] frames=${frames} canvas=${W}x${canvas.height}px (${W}x${cellRows} cells)\n` +
      `[proto] draw avg=${(drawSum / frames).toFixed(3)}ms  blit avg=${(blitSum / frames).toFixed(3)}ms  blit max=${blitMax.toFixed(3)}ms\n` +
      `[proto] total per-frame avg=${((drawSum + blitSum) / frames).toFixed(3)}ms (budget 16.6ms @60fps)\n` +
      `[proto] OK\n`,
  )
  process.exit(0)
}, 2500)

renderer.start()
