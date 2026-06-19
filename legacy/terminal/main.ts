import { createCliRenderer, BoxRenderable, type KeyEvent } from "@opentui/core"
import { Palette } from "./core/colors.ts"
import { World } from "./world/world.ts"
import { drawGame } from "./render/render.ts"

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  targetFps: 60,
  backgroundColor: Palette.bg,
})

const world = new World()
let fps = 0

// Simulation runs in the frame callback (before the render pass)...
renderer.setFrameCallback(async (dt) => {
  world.update(dt / 1000)
  const inst = 1000 / Math.max(dt, 1)
  fps = fps === 0 ? inst : fps * 0.9 + inst * 0.1
})

// ...and a fullscreen layer draws the world on top in its renderAfter hook.
const layer = new BoxRenderable(renderer, {
  position: "absolute",
  left: 0,
  top: 0,
  width: renderer.width,
  height: renderer.height,
  backgroundColor: Palette.bg,
  border: false,
  renderAfter: (buffer) => drawGame(buffer, world, renderer.width, renderer.height, Math.round(fps)),
})
renderer.root.add(layer)

renderer.on("resize", (w: number, h: number) => {
  layer.width = w
  layer.height = h
})

renderer.keyInput.on("keypress", (key: KeyEvent) => {
  switch (key.name) {
    case "w":
    case "up":
    case "k":
      world.requestMove(0, -1)
      break
    case "s":
    case "down":
    case "j":
      world.requestMove(0, 1)
      break
    case "a":
    case "left":
    case "h":
      world.requestMove(-1, 0)
      break
    case "d":
    case "right":
    case "l":
      world.requestMove(1, 0)
      break
    case "y":
      world.requestMove(-1, -1)
      break
    case "u":
      world.requestMove(1, -1)
      break
    case "b":
      world.requestMove(-1, 1)
      break
    case "n":
      world.requestMove(1, 1)
      break
    case "space":
      world.cleave()
      break
    case "r":
      if (world.state === "dead") world.reset()
      break
    case "q":
      renderer.stop()
      process.exit(0)
  }
})

renderer.start()
