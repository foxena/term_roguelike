import { createCliRenderer, BoxRenderable, RGBA } from "@opentui/core"
import type { KeyEvent } from "@opentui/core"
import { PixelCanvas } from "./engine/pixelcanvas.ts"
import { SceneStack } from "./engine/scene.ts"
import { makeInput, clearInputFrame, applyKey, releaseKey } from "./engine/input.ts"
import { GameScene } from "./game/gamescene.ts"
import { C } from "./engine/colors.ts"

const CLASSES = ["warrior","mage","archer","necromancer","paladin","rogue","druid"] as const
const CLASS_DESC: Record<string, string> = {
  warrior:     "Melee cleave + whirlwind. Get in close.",
  mage:        "Aimed bolts + arcane nova. Power at range.",
  archer:      "Rapid pierce arrows + multishot volley.",
  necromancer: "Soul bolts + corpse burst. Eerie power.",
  paladin:     "Melee smite + holy nova. Durable & bright.",
  rogue:       "Dagger spray + dash-strike. Fast & deadly.",
  druid:       "Nature bolts + vine whip. Slow but massive AOE.",
}

const renderer = await createCliRenderer({ exitOnCtrlC: true, targetFps: 60 })
const input = makeInput()
const heldKeys = new Map<string, boolean>()
const scenes = new SceneStack()
let fps = 60
let scratch: Float32Array | null = null
let canvas: PixelCanvas | null = null

function getCanvas(w: number, h: number): PixelCanvas {
  const cellRows = Math.max(1, h - 2)
  if (!canvas || canvas.width !== w || canvas.cellRows !== cellRows) {
    canvas = new PixelCanvas(w, cellRows)
    scratch = new Float32Array(canvas.data.length)
  }
  return canvas
}

// --- class select menu state ---
let inMenu = true
let selectedClass = 0
let menuT = 0

function drawMenu(buffer: typeof renderer.nextRenderBuffer, w: number, h: number, t: number): void {
  const cv = getCanvas(w, h)
  cv.clear(C.bg.r, C.bg.g, C.bg.b)
  // animated background orbs
  const palette = [C.pink, C.cyan, C.gold, C.purple, C.green]
  for (let i = 0; i < palette.length; i++) {
    const a = t * 0.4 + i * 1.3
    const ox = w / 2 + Math.cos(a) * w * 0.35
    const oy = cv.height / 2 + Math.sin(a * 0.9) * cv.height * 0.3
    cv.addGlow(ox, oy, 12, palette[i].r, palette[i].g, palette[i].b, 0.7)
  }
  if (scratch) cv.bloom(0.6, 2, scratch)
  cv.blit(buffer, 0, 0)

  // title
  const title = "N E O N F A L L"
  const sub = "Choose your class"
  const cx = (w / 2) | 0
  const pulse = 190 + ((Math.sin(t * 3) * 0.5 + 0.5) * 65) | 0
  buffer.drawText(title, cx - ((title.length/2)|0), 2, RGBA.fromInts(pulse, 255, 240))
  buffer.drawText(sub, cx - ((sub.length/2)|0), 4, RGBA.fromInts(120, 140, 200))

  const startY = 6
  for (let i = 0; i < CLASSES.length; i++) {
    const cls = CLASSES[i]
    const col = (C as Record<string, {r:number;g:number;b:number}>)[cls] ?? C.white
    const isSelected = i === selectedClass
    const prefix = isSelected ? "▶ " : "  "
    const bg = isSelected ? RGBA.fromInts(10, 14, 32) : RGBA.fromInts(4, 6, 14)
    buffer.drawText(
      `${prefix}${cls.toUpperCase().padEnd(13)} ${CLASS_DESC[cls]}`,
      cx - 28, startY + i, RGBA.fromInts(col.r, col.g, col.b), bg
    )
  }

  const hint = "↑↓ select  ENTER play  Q quit"
  buffer.drawText(hint, cx - ((hint.length/2)|0), h - 1, RGBA.fromInts(90, 110, 150))
}

renderer.setFrameCallback(async (dtMs) => {
  const dt = dtMs / 1000
  fps = Math.round(0.9 * fps + 0.1 / Math.max(dt, 0.001))
  menuT += dt

  if (!inMenu) {
    scenes.update(dt, input)
    clearInputFrame(input)
  }
})

const layer = new BoxRenderable(renderer, {
  position: "absolute", left: 0, top: 0,
  width: renderer.width, height: renderer.height,
  border: false,
  renderAfter: (buffer) => {
    const w = renderer.width, h = renderer.height
    if (inMenu) {
      drawMenu(buffer, w, h, menuT)
    } else {
      const cv = getCanvas(w, h)
      scenes.draw(cv, buffer, w, h)
    }
  }
})
renderer.root.add(layer)
renderer.on("resize", (w: number, h: number) => { layer.width = w; layer.height = h; canvas = null })

renderer.keyInput.on("keypress", (key: KeyEvent) => {
  if (inMenu) {
    switch (key.name) {
      case "up": case "k":    selectedClass = (selectedClass - 1 + CLASSES.length) % CLASSES.length; break
      case "down": case "j":  selectedClass = (selectedClass + 1) % CLASSES.length; break
      case "return": case "space": {
        inMenu = false
        const gs = new GameScene(CLASSES[selectedClass])
        scenes.push(gs)
        break
      }
      case "q": renderer.stop(); process.exit(0)
    }
    return
  }

  if (key.name === "q") { renderer.stop(); process.exit(0) }
  if (key.name === "r" && scenes.current instanceof GameScene) {
    (scenes.current as GameScene).handleKey("r", true)
    return
  }
  if (key.name === "escape" || key.name === "p") {
    // propagate pause to scene via input
  }

  applyKey(input, key.name, heldKeys)
  // aim with arrow keys (separate from movement)
  if (["up","down","left","right"].includes(key.name)) {
    input.aimX = key.name === "left" ? -1 : key.name === "right" ? 1 : 0
    input.aimY = key.name === "up"   ? -1 : key.name === "down"  ? 1 : 0
  }
})

renderer.keyInput.on("keyrelease", (key: KeyEvent) => {
  releaseKey(input, key.name, heldKeys)
  if (["up","down","left","right"].includes(key.name)) {
    if (input.aimX === (key.name === "left" ? -1 : key.name === "right" ? 1 : 0) &&
        input.aimY === (key.name === "up" ? -1 : key.name === "down" ? 1 : 0)) {
      // keep last aim direction — don't zero it on release
    }
  }
})

renderer.start()
