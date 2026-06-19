import { RGBA, type OptimizedBuffer } from "@opentui/core"
import type { ItemDef } from "../game/items.ts"
import type { RunStats } from "../game/progression/run.ts"

function rgb(r: number, g: number, b: number): RGBA { return RGBA.fromInts(r, g, b, 255) }

const RARITY_COLOR: Record<string, RGBA> = {
  common:    rgb(180, 200, 220),
  uncommon:  rgb(80,  200, 100),
  rare:      rgb(80,  140, 255),
  legendary: rgb(255, 180, 40),
}

export function drawItemRoom(
  buffer: OptimizedBuffer, items: ItemDef[], selected: number,
  cellW: number, cellH: number, gold: number
): void {
  const bw = Math.min(56, cellW - 2), bh = items.length + 6
  const bx = ((cellW - bw) / 2) | 0, by = ((cellH - bh) / 2) | 0
  buffer.drawBox({ x: bx, y: by, width: bw, height: bh, border: true, borderStyle: "double",
    borderColor: rgb(255,210,80), backgroundColor: rgb(6,8,18), shouldFill: true,
    title: " TREASURE ROOM ", titleAlignment: "center", titleColor: rgb(255,210,80) })
  buffer.drawText("↑↓ select  ENTER take  ESC skip", bx + 2, by + bh - 2, rgb(100,120,160), rgb(6,8,18))

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const isSelected = i === selected
    const y = by + 2 + i
    const bg = isSelected ? rgb(14, 18, 40) : rgb(6, 8, 18)
    const prefix = isSelected ? "▶ " : "  "
    buffer.fillRect(bx + 1, y, bw - 2, 1, bg)
    buffer.drawText(`${prefix}${item.name}`, bx + 2, y, RARITY_COLOR[item.rarity], bg)
    const desc = item.desc.length > bw - 26 ? item.desc.slice(0, bw - 29) + "…" : item.desc
    buffer.drawText(desc, bx + 22, y, rgb(160, 180, 210), bg)
  }
}

export function drawShopRoom(
  buffer: OptimizedBuffer, items: ItemDef[], prices: number[], selected: number,
  cellW: number, cellH: number, gold: number
): void {
  const bw = Math.min(58, cellW - 2), bh = items.length + 6
  const bx = ((cellW - bw) / 2) | 0, by = ((cellH - bh) / 2) | 0
  buffer.drawBox({ x: bx, y: by, width: bw, height: bh, border: true, borderStyle: "double",
    borderColor: rgb(60,200,255), backgroundColor: rgb(6,8,18), shouldFill: true,
    title: " SHOP ", titleAlignment: "center", titleColor: rgb(60,200,255) })
  buffer.drawText(`Gold: ${gold}`, bx + 2, by + 1, rgb(255,210,80), rgb(6,8,18))
  buffer.drawText("↑↓ select  ENTER buy  ESC leave", bx + 2, by + bh - 2, rgb(100,120,160), rgb(6,8,18))

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const price = prices[i]
    const isSelected = i === selected
    const canAfford = gold >= price
    const y = by + 2 + i
    const bg = isSelected ? rgb(14,18,40) : rgb(6,8,18)
    const fg = canAfford ? RARITY_COLOR[item.rarity] : rgb(90,90,90)
    buffer.fillRect(bx + 1, y, bw - 2, 1, bg)
    buffer.drawText(`${isSelected?"▶ ":"  "}${item.name}`, bx + 2, y, fg, bg)
    buffer.drawText(item.desc.slice(0,bw-32), bx + 22, y, rgb(140,160,190), bg)
    buffer.drawText(`${price}g`, bx + bw - 6, y, canAfford ? rgb(255,210,80) : rgb(100,80,50), bg)
  }
}

export function drawRunSummary(
  buffer: OptimizedBuffer, run: RunStats, kills: number, items: string[],
  cellW: number, cellH: number
): void {
  const bw = Math.min(50, cellW - 2), bh = 12
  const bx = ((cellW - bw) / 2) | 0, by = ((cellH - bh) / 2) | 0
  buffer.drawBox({ x: bx, y: by, width: bw, height: bh, border: true, borderStyle: "double",
    borderColor: rgb(150,90,255), backgroundColor: rgb(6,8,18), shouldFill: true,
    title: " RUN COMPLETE ", titleAlignment: "center", titleColor: rgb(150,90,255) })
  const c = (t: string, dy: number, col = rgb(200,215,255)) =>
    buffer.drawText(t, bx + ((bw - t.length) >> 1), by + dy, col, rgb(6,8,18))
  c(`Floor ${run.floor}  ·  ${kills} kills  ·  ${run.gold} gold`, 2, rgb(255,210,80))
  c(`Damage taken: ${run.damageTaken | 0}`, 3)
  c(`Essence earned: +${run.essence}`, 4, rgb(150,90,255))
  if (items.length > 0) {
    c(`Items: ${items.slice(0,4).join(", ")}`, 6, rgb(80,200,255))
  }
  c("ENTER to return to hub  ·  Q to quit", 9, rgb(100,120,160))
}
