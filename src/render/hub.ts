import { RGBA, type OptimizedBuffer } from "@opentui/core"
import type { MetaProgress } from "../game/progression/metatree.ts"
import { META_NODES, canUnlock, computeMetaBonus } from "../game/progression/metatree.ts"
import { prestigeCost, PRESTIGE_PERKS } from "../game/progression/prestige.ts"
import type { GameStats } from "../game/progression/save.ts"
import type { PixelCanvas } from "../engine/pixelcanvas.ts"
import { C } from "../engine/colors.ts"

function rgb(r: number, g: number, b: number) { return RGBA.fromInts(r, g, b, 255) }

const R_TEXT   = rgb(200, 215, 255)
const R_DIM    = rgb(80,  100, 150)
const R_GOLD   = rgb(255, 210, 80)
const R_BG     = rgb(6,   8,   18)
const R_CYAN   = rgb(60,  200, 255)
const R_GREEN  = rgb(80,  255, 140)
const R_RED    = rgb(255, 60,  60)
const R_PURPLE = rgb(180, 80,  255)

const CAT_COLORS: Record<string, RGBA> = {
  offense:  rgb(255, 120, 60),
  defense:  rgb(60, 180, 255),
  utility:  rgb(80, 255, 140),
  class:    rgb(200, 80, 255),
  prestige: rgb(255, 210, 40),
}

export type HubTab = "tree" | "prestige" | "stats"

export function drawHub(
  buffer: OptimizedBuffer,
  meta: MetaProgress,
  gameStats: GameStats,
  selected: number,
  tab: HubTab,
  cellW: number,
  cellH: number,
  t: number,
): void {
  // Header
  buffer.fillRect(0, 0, cellW, 3, R_BG)
  const title = "✦ NEONFALL — HUB ✦"
  buffer.drawText(title, ((cellW - title.length) / 2) | 0, 0, R_GOLD)
  buffer.drawText(`Essence: ${meta.essence}`, 2, 1, R_CYAN)
  buffer.drawText(`Prestige: ${meta.totalPrestige}  Points: ${meta.prestigePoints}`, 2, 2, R_PURPLE)

  // Tabs
  const tabs: HubTab[] = ["tree", "prestige", "stats"]
  let tx = cellW - 34
  for (const t of tabs) {
    const active = t === tab
    buffer.drawText(` ${t.toUpperCase()} `, tx, 1, active ? rgb(6,8,18) : R_DIM, active ? R_CYAN : R_BG)
    tx += t.length + 3
  }

  const nodes = META_NODES.filter(n => n.category !== "prestige")
  const startY = 4

  if (tab === "tree") {
    buffer.drawText("↑↓ navigate  ENTER unlock  TAB switch tab  R run  Q quit", 1, cellH-1, R_DIM)
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      const rank = meta.ranks[node.id] ?? 0
      const canBuy = canUnlock(node, meta)
      const maxed = rank >= node.maxRank
      const y = startY + i
      if (y >= cellH - 2) break
      const isSel = i === selected
      const bg = isSel ? rgb(14, 18, 40) : R_BG
      buffer.fillRect(0, y, cellW, 1, bg)
      const prefix = isSel ? "▶ " : "  "
      const catCol = CAT_COLORS[node.category] ?? R_TEXT
      const rankStr = `[${rank}/${node.maxRank}]`
      const statusCol = maxed ? R_DIM : canBuy ? R_GREEN : R_RED
      const costStr = maxed ? "MAXED" : `${node.cost}E`
      buffer.drawText(`${prefix}${node.name}`, 0, y, catCol, bg)
      buffer.drawText(node.desc, 22, y, isSel ? R_TEXT : R_DIM, bg)
      buffer.drawText(rankStr, cellW - 18, y, R_TEXT, bg)
      buffer.drawText(costStr, cellW - 10, y, statusCol, bg)
    }
    // bonus summary
    const bonus = computeMetaBonus(meta)
    const bline = `Dmg×${bonus.dmgMult.toFixed(2)} Spd×${bonus.speedMult.toFixed(2)} HP+${bonus.hpBonus} Ess×${bonus.essenceMult.toFixed(2)}`
    buffer.drawText(bline, 1, cellH - 2, R_GOLD)
  } else if (tab === "prestige") {
    const cost = prestigeCost(meta.totalPrestige)
    buffer.drawText(`Next prestige costs ${cost} Essence (you have ${meta.essence})`, 1, startY, R_TEXT)
    buffer.drawText(meta.essence >= cost ? "PRESTIGE AVAILABLE — press ENTER" : "Not enough Essence yet", 1, startY+1,
                    meta.essence >= cost ? R_GREEN : R_RED)
    buffer.drawText("Resetting meta tree grants permanent global power:", 1, startY+3, R_DIM)
    for (let i = 0; i < PRESTIGE_PERKS.length; i++) {
      const p = PRESTIGE_PERKS[i]
      const unlocked = meta.totalPrestige >= p.pp
      buffer.drawText(`  [${unlocked?"✓":" "}] Prestige ${p.pp}: ${p.desc}`, 1, startY+5+i,
                      unlocked ? R_GREEN : R_DIM)
    }
    buffer.drawText("↑↓ navigate  ENTER prestige (irreversible)  TAB switch  R run  Q quit", 1, cellH-1, R_DIM)
  } else {
    buffer.drawText("LIFETIME STATS", ((cellW-14)/2)|0, startY, R_GOLD)
    const lines = [
      `Total Runs     : ${gameStats.totalRuns}`,
      `Total Kills    : ${gameStats.totalKills}`,
      `Best Floor     : ${gameStats.bestFloor}`,
      `Total Essence  : ${meta.essence}`,
      `Prestige Rank  : ${meta.totalPrestige}`,
      `Classes Unlocked: ${[...meta.unlockedClasses].join(", ")}`,
    ]
    for (let i = 0; i < lines.length; i++) buffer.drawText(lines[i], 4, startY+2+i, R_TEXT)
    buffer.drawText("TAB switch tab  R run  Q quit", 1, cellH-1, R_DIM)
  }
}

export function drawHubBackground(canvas: PixelCanvas, scratch: Float32Array, t: number): void {
  canvas.clear(C.bg.r, C.bg.g, C.bg.b)
  const W = canvas.width, H = canvas.height
  const palette = [C.purple, C.cyan, C.gold, C.pink]
  for (let i = 0; i < palette.length; i++) {
    const a = t * 0.3 + i * 1.6
    canvas.addGlow(W/2 + Math.cos(a)*W*0.4, H/2 + Math.sin(a*0.8)*H*0.35,
                   14, palette[i].r, palette[i].g, palette[i].b, 0.6)
  }
  canvas.bloom(0.5, 2, scratch)
}
