import { RGBA, type OptimizedBuffer } from "@opentui/core"
import type { Player } from "../game/entities.ts"
import type { RunStats } from "../game/progression/run.ts"
import { C } from "../engine/colors.ts"

function rgb(r: number, g: number, b: number): RGBA { return RGBA.fromInts(r, g, b, 255) }

const R_TEXT   = rgb(200, 215, 255)
const R_DIM    = rgb(80, 100, 150)
const R_HP_HI  = rgb(80, 255, 120)
const R_HP_MID = rgb(255, 210, 80)
const R_HP_LO  = rgb(255, 60, 60)
const R_GOLD   = rgb(255, 210, 80)
const R_BG     = rgb(6, 8, 18)
const R_CYAN   = rgb(60, 200, 255)
const R_ACCENT = rgb(150, 90, 255)

function cls2rgb(cls: string): RGBA {
  const c = (C as Record<string, {r:number;g:number;b:number}>)[cls] ?? C.white
  return rgb(c.r, c.g, c.b)
}

export function drawHud(
  buffer: OptimizedBuffer, player: Player, run: RunStats, fps: number, cellW: number, cellH: number
): void {
  const botY = cellH - 2
  const hudY = cellH - 1

  // bottom bar bg
  buffer.fillRect(0, botY, cellW, 2, R_BG)

  // class name
  buffer.drawText(`[${player.class.toUpperCase()}]`, 1, botY, cls2rgb(player.class), R_BG)

  // HP bar
  const barW = 20
  const hpR = Math.max(0, player.hp / player.maxHp)
  const filled = Math.round(hpR * barW)
  const hpCol = hpR > 0.5 ? R_HP_HI : hpR > 0.25 ? R_HP_MID : R_HP_LO
  buffer.drawText("HP", 14, botY, R_DIM, R_BG)
  for (let i = 0; i < barW; i++) {
    const ch = i < filled ? "█" : "░"
    const fg = i < filled ? hpCol : R_DIM
    buffer.drawText(ch, 17 + i, botY, fg, R_BG)
  }
  buffer.drawText(`${Math.ceil(player.hp)}/${player.maxHp}`, 38, botY, R_TEXT, R_BG)

  // ability cooldown
  const cdPct = 1 - (player.abilityCd / player.abilityMaxCd)
  const cdStr = player.abilityCd <= 0 ? "ABILITY READY" : `ABILITY ${player.abilityCd.toFixed(1)}s`
  buffer.drawText(cdStr, 50, botY, player.abilityCd <= 0 ? R_CYAN : R_DIM, R_BG)

  // bottom line: controls + stats
  buffer.drawText("WASD move  ARROWS aim  SPACE ability  R restart  Q quit", 1, hudY, R_DIM, R_BG)
  const statsStr = `Floor ${run.floor}  Kills ${run.kills}  Gold ${run.gold}  ${fps}fps`
  buffer.drawText(statsStr, cellW - statsStr.length - 1, hudY, R_GOLD, R_BG)
}

export function drawDeathScreen(buffer: OptimizedBuffer, run: RunStats, kills: number, cellW: number, cellH: number): void {
  const bw = Math.min(46, cellW - 2), bh = 9
  const bx = ((cellW - bw) / 2) | 0, by = ((cellH - bh) / 2) | 0
  buffer.drawBox({ x: bx, y: by, width: bw, height: bh, border: true, borderStyle: "double",
    borderColor: rgb(255,60,60), backgroundColor: rgb(6,8,18), shouldFill: true,
    title: " YOU DIED ", titleAlignment: "center", titleColor: rgb(255,60,60) })
  const cx = bx + ((bw / 2) | 0)
  const line = (t: string, dy: number, col: RGBA = R_TEXT) =>
    buffer.drawText(t, cx - ((t.length / 2) | 0), by + dy, col, rgb(6,8,18))
  line(`Floor ${run.floor}  ·  ${kills} kills  ·  ${run.gold} gold`, 2, R_GOLD)
  line("Press R to try again  ·  Q to quit", 5, R_ACCENT)
}

export function drawPauseScreen(buffer: OptimizedBuffer, cellW: number, cellH: number): void {
  const bw = 34, bh = 7
  const bx = ((cellW - bw) / 2) | 0, by = ((cellH - bh) / 2) | 0
  buffer.drawBox({ x: bx, y: by, width: bw, height: bh, border: true, borderStyle: "double",
    borderColor: rgb(60,200,255), backgroundColor: rgb(6,8,18), shouldFill: true,
    title: " PAUSED ", titleAlignment: "center", titleColor: rgb(60,200,255) })
  buffer.drawText("ESC / P to resume", bx + ((bw-17)/2|0), by + 3, R_TEXT, rgb(6,8,18))
}
