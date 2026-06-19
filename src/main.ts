import { createCliRenderer, BoxRenderable, RGBA } from "@opentui/core"
import type { KeyEvent } from "@opentui/core"
import { PixelCanvas } from "./engine/pixelcanvas.ts"
import { SceneStack } from "./engine/scene.ts"
import { makeInput, clearInputFrame, applyKey, releaseKey } from "./engine/input.ts"
import { GameScene } from "./game/gamescene.ts"
import { C } from "./engine/colors.ts"
import { makeMetaProgress, META_NODES, canUnlock, unlockNode, type MetaProgress } from "./game/progression/metatree.ts"
import { doPrestige, prestigeCost } from "./game/progression/prestige.ts"
import { loadGame, saveGame, makeGameStats, type GameStats } from "./game/progression/save.ts"
import { drawHub, drawHubBackground, type HubTab } from "./render/hub.ts"
import { drawCodex, drawHelp } from "./render/codex.ts"
import { checkAchievements, type AchievementStats } from "./game/achievements.ts"

const ALL_CLASSES = ["warrior","mage","archer","necromancer","paladin","rogue","druid"] as const
const CLASS_DESC: Record<string, string> = {
  warrior:"Melee cleave + whirlwind. Get in close.",
  mage:"Aimed bolts + arcane nova. Power at range.",
  archer:"Rapid pierce arrows + multishot volley.",
  necromancer:"Soul bolts + corpse burst. Eerie power.",
  paladin:"Melee smite + holy nova. Durable & bright.",
  rogue:"Dagger spray + dash-strike. Fast & deadly.",
  druid:"Nature bolts + vine whip. Slow but massive AOE.",
}

const renderer = await createCliRenderer({ exitOnCtrlC: true, targetFps: 60 })
const { meta: metaProgress, stats: gameStats } = await loadGame()
const input = makeInput()
const heldKeys = new Map<string, boolean>()
const scenes = new SceneStack()
let fps = 60
let scratch: Float32Array | null = null
let canvas: PixelCanvas | null = null
let t = 0

// Notification queue
const notifications: { text: string; life: number; maxLife: number }[] = []
function notify(text: string): void { notifications.push({ text, life: 3, maxLife: 3 }) }

function getCanvas(w: number, h: number): PixelCanvas {
  const rows = Math.max(1, h - 2)
  if (!canvas || canvas.width !== w || canvas.cellRows !== rows) {
    canvas = new PixelCanvas(w, rows)
    scratch = new Float32Array(canvas.data.length)
  }
  return canvas
}

type Screen = "class_select" | "hub" | "game" | "codex" | "help"
let screen: Screen = "class_select"
let selectedClass = 0
let hubTab: HubTab = "tree"
let hubSelected = 0
let menuT = 0

function availableClasses(meta: MetaProgress): string[] {
  return ALL_CLASSES.filter(c => meta.unlockedClasses.has(c))
}

function achStats(): AchievementStats {
  return {
    totalKills: gameStats.totalKills,
    totalRuns: gameStats.totalRuns,
    bestFloor: gameStats.bestFloor,
    totalPrestige: metaProgress.totalPrestige,
    maxEssence: gameStats.maxEssence,
    classesPlayed: gameStats.classesPlayed,
    bossesKilled: gameStats.bossesKilled,
    itemsCollected: gameStats.itemsCollected,
  }
}

function checkAndNotifyAchievements(): void {
  const newOnes = checkAchievements(achStats(), gameStats.achievements)
  for (const a of newOnes) notify(`🏆 ${a.name}: ${a.desc}`)
}

// ---- Frame callback ----
renderer.setFrameCallback(async (dtMs) => {
  const dt = dtMs / 1000
  t += dt
  fps = Math.round(0.9 * fps + 0.1 / Math.max(dt, 0.001))
  if (screen === "game") {
    scenes.update(dt, input)
    clearInputFrame(input)
  }
  // update notifications
  let ni = 0
  while (ni < notifications.length) {
    notifications[ni].life -= dt
    if (notifications[ni].life <= 0) notifications.splice(ni, 1); else ni++
  }
})

// ---- Render layer ----
const layer = new BoxRenderable(renderer, {
  position: "absolute", left: 0, top: 0,
  width: renderer.width, height: renderer.height, border: false,
  renderAfter: (buffer) => {
    const w = renderer.width, h = renderer.height
    const cv = getCanvas(w, h)

    if (screen === "class_select") _drawClassSelect(buffer, cv, w, h)
    else if (screen === "hub") { drawHubBackground(cv, scratch!, t); cv.blit(buffer, 0, 0); drawHub(buffer, metaProgress, gameStats, hubSelected, hubTab, w, h, t) }
    else if (screen === "codex") drawCodex(buffer, gameStats.achievements, achStats(), w, h)
    else if (screen === "help") drawHelp(buffer, w, h)
    else { scenes.draw(cv, buffer, w, h) }

    // Notifications overlay (top-right)
    for (let i = 0; i < notifications.length; i++) {
      const n = notifications[i]
      const alpha = Math.min(1, n.life / 0.5)
      const col = RGBA.fromInts(80 + (alpha * 175) | 0, 255, 140)
      buffer.drawText(n.text.slice(0, w - 2), w - n.text.length - 1, i, col)
    }
  }
})
renderer.root.add(layer)
renderer.on("resize", (w: number, h: number) => { layer.width = w; layer.height = h; canvas = null })

function _drawClassSelect(buffer: typeof renderer.nextRenderBuffer, cv: PixelCanvas, w: number, h: number): void {
  cv.clear(C.bg.r, C.bg.g, C.bg.b)
  const palette = [C.pink, C.cyan, C.gold, C.purple, C.green]
  for (let i = 0; i < palette.length; i++) {
    const a = t * 0.4 + i * 1.3
    cv.addGlow(w/2 + Math.cos(a)*w*0.35, cv.height/2 + Math.sin(a*0.9)*cv.height*0.3, 12, palette[i].r, palette[i].g, palette[i].b, 0.7)
  }
  if (scratch) cv.bloom(0.6, 2, scratch)
  cv.blit(buffer, 0, 0)

  const title = "N E O N F A L L"
  const cx = (w / 2) | 0
  const pulse = 190 + ((Math.sin(t * 3) * 0.5 + 0.5) * 65) | 0
  buffer.drawText(title, cx - ((title.length/2)|0), 1, RGBA.fromInts(pulse, 255, 240))
  buffer.drawText("Choose your class", cx - 8, 3, RGBA.fromInts(120,140,200))

  const classes = availableClasses(metaProgress)
  for (let i = 0; i < classes.length; i++) {
    const cls = classes[i]
    const col = (C as Record<string, {r:number;g:number;b:number}>)[cls] ?? C.white
    const isSel = i === selectedClass
    const bg = isSel ? RGBA.fromInts(12,16,36) : RGBA.fromInts(4,6,14)
    buffer.drawText(`${isSel?"▶ ":"  "}${cls.toUpperCase().padEnd(13)} ${CLASS_DESC[cls]}`, cx - 28, 5+i, RGBA.fromInts(col.r,col.g,col.b), bg)
  }
  buffer.drawText(`Essence: ${metaProgress.essence}  Prestige: ${metaProgress.totalPrestige}  Achievements: ${gameStats.achievements.size}/${14}`, 2, h-3, RGBA.fromInts(180,80,255))
  buffer.drawText("↑↓ select  ENTER play  H hub  C codex  ? help  Q quit", cx - 27, h-1, RGBA.fromInts(90,110,150))
}

// ---- Key handler ----
renderer.keyInput.on("keypress", async (key: KeyEvent) => {
  const k = key.name

  if (k === "q") { await saveGame(metaProgress, gameStats); renderer.stop(); process.exit(0) }
  if (["codex","help"].includes(screen)) { if (k === "escape" || k === "c" || k === "?" || k === "return") screen = "class_select"; return }

  if (screen === "class_select") {
    const classes = availableClasses(metaProgress)
    switch (k) {
      case "up": case "k":   selectedClass = (selectedClass - 1 + classes.length) % classes.length; break
      case "down": case "j": selectedClass = (selectedClass + 1) % classes.length; break
      case "h":              screen = "hub"; hubSelected = 0; break
      case "c":              screen = "codex"; break
      case "?":              screen = "help"; break
      case "return": case "space": {
        const cls = classes[selectedClass]
        gameStats.classesPlayed.add(cls)
        const gs = new GameScene(cls)
        scenes.push(gs)
        screen = "game"
        break
      }
    }
    return
  }

  if (screen === "hub") {
    const nodes = META_NODES.filter(n => n.category !== "prestige")
    switch (k) {
      case "up": case "k":   hubSelected = Math.max(0, hubSelected - 1); break
      case "down": case "j": hubSelected = Math.min(nodes.length - 1, hubSelected + 1); break
      case "tab":            hubTab = hubTab === "tree" ? "prestige" : hubTab === "prestige" ? "stats" : "tree"; break
      case "return": {
        if (hubTab === "tree") {
          const node = nodes[hubSelected]
          if (node && unlockNode(node, metaProgress)) { notify(`Unlocked: ${node.name}`) }
          await saveGame(metaProgress, gameStats)
        } else if (hubTab === "prestige") {
          const result = doPrestige(metaProgress)
          if (result) { notify(`Prestige! +${result.pointsGained} Prestige Point(s)`); await saveGame(metaProgress, gameStats) }
        }
        break
      }
      case "r": case "escape": screen = "class_select"; break
    }
    return
  }

  if (screen === "game") {
    if (k === "r") {
      const gs = scenes.current as GameScene | undefined
      // collect run stats before resetting
      const runData = (gs as any)?.["run"]
      if (runData) {
        metaProgress.essence += runData.essence ?? 0
        gameStats.maxEssence = Math.max(gameStats.maxEssence, metaProgress.essence)
        gameStats.totalRuns++
        gameStats.totalKills += runData.kills ?? 0
        gameStats.bestFloor = Math.max(gameStats.bestFloor, runData.floor ?? 1)
        gameStats.itemsCollected += runData.itemIds?.length ?? 0
        checkAndNotifyAchievements()
        await saveGame(metaProgress, gameStats)
      }
      if (gs?.handleKey("r", true)) return
      screen = "class_select"
      return
    }
    if (k === "c") { screen = "codex"; return }
    if (k === "?" ) { screen = "help"; return }
    if (k === "escape" || k === "p") { applyKey(input, "escape", heldKeys); return }
    applyKey(input, k, heldKeys)
    if (["up","down","left","right"].includes(k)) {
      input.aimX = k === "left" ? -1 : k === "right" ? 1 : 0
      input.aimY = k === "up"  ? -1 : k === "down"  ? 1 : 0
    }
  }
})

renderer.keyInput.on("keyrelease", (key: KeyEvent) => { releaseKey(input, key.name, heldKeys) })
renderer.start()
