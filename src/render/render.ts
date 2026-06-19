import type { OptimizedBuffer } from "@opentui/core"
import { Palette } from "../core/colors.ts"
import { World, ENEMY_TYPES, MAP_W, MAP_H } from "../world/world.ts"
import { DX, DY } from "../world/flowfield.ts"

const TOP_HUD = 1
const BOTTOM_HUD = 2
const LIGHT = 11 // soft light radius around the player (in tiles)

const ENEMY_COLORS = [Palette.enemy, Palette.enemyFast, Palette.enemyTank]

function fmtTime(t: number): string {
  const s = Math.floor(t)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

function drawRight(buf: OptimizedBuffer, text: string, rightX: number, y: number, fg = Palette.text): void {
  buf.drawText(text, rightX - text.length + 1, y, fg, Palette.hudBg)
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/** Renders the whole game (world + HUD + overlays) into the frame buffer. */
export function drawGame(buf: OptimizedBuffer, world: World, w: number, h: number, fps: number): void {
  if (w < 20 || h < 8) return

  const viewW = w
  const viewH = h - TOP_HUD - BOTTOM_HUD
  const p = world.player

  // Camera follows the player, clamped to the map bounds.
  const camX = clamp(p.x - (viewW >> 1), 0, Math.max(0, MAP_W - viewW))
  const camY = clamp(p.y - (viewH >> 1), 0, Math.max(0, MAP_H - viewH))
  const light2 = LIGHT * LIGHT

  // --- Map tiles ----------------------------------------------------------
  for (let sy = 0; sy < viewH; sy++) {
    const my = camY + sy
    const screenY = sy + TOP_HUD
    for (let sx = 0; sx < viewW; sx++) {
      const mx = camX + sx
      if (mx < 0 || my < 0 || mx >= MAP_W || my >= MAP_H) {
        buf.setCell(sx, screenY, " ", Palette.bg, Palette.bg)
        continue
      }
      const dxp = mx - p.x
      const dyp = my - p.y
      const lit = dxp * dxp + dyp * dyp <= light2
      if (world.map.tiles[my * MAP_W + mx] === 0) {
        buf.setCell(sx, screenY, "#", lit ? Palette.wallLit : Palette.wallDim, Palette.bg)
      } else {
        buf.setCell(sx, screenY, " ", Palette.textDim, lit ? Palette.floorLit : Palette.bg)
      }
    }
  }

  // --- Enemies ------------------------------------------------------------
  for (let i = 0; i < world.count; i++) {
    const sx = world.ex[i] - camX
    const sy = world.ey[i] - camY
    if (sx < 0 || sy < 0 || sx >= viewW || sy >= viewH) continue
    const type = world.etype[i]
    buf.setCell(sx, sy + TOP_HUD, ENEMY_TYPES[type].glyph, ENEMY_COLORS[type], Palette.bg)
  }

  // --- Cleave flash ring --------------------------------------------------
  if (world.cleaveFlash > 0) {
    for (let k = 0; k < 8; k++) {
      const sx = p.x + DX[k] - camX
      const sy = p.y + DY[k] - camY
      if (sx < 0 || sy < 0 || sx >= viewW || sy >= viewH) continue
      buf.setCell(sx, sy + TOP_HUD, "*", Palette.cleave, Palette.bg)
    }
  }

  // --- Player -------------------------------------------------------------
  {
    const sx = p.x - camX
    const sy = p.y - camY
    if (sx >= 0 && sy >= 0 && sx < viewW && sy < viewH) {
      const col = world.hurtFlash > 0 ? Palette.playerHurt : Palette.player
      buf.setCell(sx, sy + TOP_HUD, "@", col, Palette.bg)
    }
  }

  drawTopHud(buf, world, w)
  drawBottomHud(buf, world, w, h, fps)
  if (world.state === "dead") drawGameOver(buf, world, w, h)
}

function drawTopHud(buf: OptimizedBuffer, world: World, w: number): void {
  buf.fillRect(0, 0, w, 1, Palette.hudBg)
  buf.drawText("☠ TERM ROGUELIKE", 1, 0, Palette.accent, Palette.hudBg)
  drawRight(buf, `Wave ${world.wave}   ${fmtTime(world.time)}`, w - 1, 0, Palette.text)
}

function drawBottomHud(buf: OptimizedBuffer, world: World, w: number, h: number, fps: number): void {
  const r1 = h - 2
  const r2 = h - 1
  buf.fillRect(0, r1, w, 2, Palette.hudBg)

  // HP bar
  const p = world.player
  const barW = 20
  const ratio = p.maxHp > 0 ? p.hp / p.maxHp : 0
  const filled = Math.round(clamp(ratio, 0, 1) * barW)
  const hpCol = ratio > 0.5 ? Palette.hpGood : ratio > 0.25 ? Palette.hpMid : Palette.hpBad
  buf.drawText("HP", 1, r1, Palette.text, Palette.hudBg)
  for (let i = 0; i < barW; i++) {
    buf.setCell(4 + i, r1, i < filled ? "█" : "░", i < filled ? hpCol : Palette.textDim, Palette.hudBg)
  }
  buf.drawText(`${p.hp}/${p.maxHp}`, 5 + barW, r1, Palette.text, Palette.hudBg)
  buf.drawText(`Kills ${world.kills}`, 34 + barW, r1, Palette.hpGood, Palette.hudBg)
  drawRight(buf, `Enemies ${world.count}`, w - 1, r1, Palette.enemy)

  // Controls + status
  buf.drawText(
    "Move WASD/Arrows/HJKL+YUBN   Space Cleave   R Restart   Q Quit",
    1,
    r2,
    Palette.textDim,
    Palette.hudBg,
  )
  const cleave = world.cleaveCd > 0 ? `Cleave ${world.cleaveCd.toFixed(1)}s` : "Cleave READY"
  drawRight(buf, `${cleave}   ${fps} FPS`, w - 1, r2, world.cleaveCd > 0 ? Palette.textDim : Palette.cleave)
}

function drawGameOver(buf: OptimizedBuffer, world: World, w: number, h: number): void {
  const bw = Math.min(44, w - 2)
  const bh = 9
  const bx = ((w - bw) / 2) | 0
  const by = ((h - bh) / 2) | 0
  buf.drawBox({
    x: bx,
    y: by,
    width: bw,
    height: bh,
    border: true,
    borderStyle: "double",
    borderColor: Palette.hpBad,
    backgroundColor: Palette.hudBg,
    title: " YOU DIED ",
    titleAlignment: "center",
    shouldFill: true,
  })
  const cx = bx + ((bw / 2) | 0)
  const line = (text: string, dy: number, col = Palette.text) =>
    buf.drawText(text, cx - ((text.length / 2) | 0), by + dy, col, Palette.hudBg)
  line(`You slew ${world.kills} enemies`, 2, Palette.hpGood)
  line(`Reached Wave ${world.wave}  ·  Survived ${fmtTime(world.time)}`, 3)
  line("Press R to play again   ·   Q to quit", 6, Palette.accent)
}
