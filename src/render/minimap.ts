import { RGBA, type OptimizedBuffer } from "@opentui/core"
import type { Floor, FloorRoom } from "../game/floor.ts"
import { ROOM_TYPE_COLOR } from "../game/floor.ts"

const CELL_W = 4, CELL_H = 2, GAP = 1

export function drawMinimap(buffer: OptimizedBuffer, floor: Floor, currentRoomId: number, cellW: number, _cellH: number): void {
  const rooms = [...floor.rooms.values()]
  if (rooms.length === 0) return

  const minGx = Math.min(...rooms.map(r => r.gx))
  const minGy = Math.min(...rooms.map(r => r.gy))
  const maxGx = Math.max(...rooms.map(r => r.gx))
  const maxGy = Math.max(...rooms.map(r => r.gy))

  const mapW = (maxGx - minGx + 1) * (CELL_W + GAP) - GAP
  const mapH = (maxGy - minGy + 1) * (CELL_H + GAP) - GAP
  const ox = cellW - mapW - 2
  const oy = 1

  // background
  buffer.fillRect(ox - 1, oy - 1, mapW + 2, mapH + 2, RGBA.fromInts(6, 8, 18, 200))

  for (const room of rooms) {
    if (!room.visited && room.type !== "boss") continue
    const rx = ox + (room.gx - minGx) * (CELL_W + GAP)
    const ry = oy + (room.gy - minGy) * (CELL_H + GAP)
    const [r, g, b] = ROOM_TYPE_COLOR[room.type]
    const isCurrent = room.id === currentRoomId
    const dim = room.cleared && !isCurrent ? 0.45 : 1
    const fg = RGBA.fromInts(r * dim | 0, g * dim | 0, b * dim | 0)
    const bgR = isCurrent ? RGBA.fromInts(20, 24, 50) : RGBA.fromInts(10, 12, 28)
    for (let dy = 0; dy < CELL_H; dy++) {
      buffer.fillRect(rx, ry + dy, CELL_W, 1, bgR)
      buffer.drawText("▪".repeat(CELL_W), rx, ry + dy, fg, bgR)
    }
    if (isCurrent) {
      buffer.drawText("@", rx + (CELL_W >> 1), ry, RGBA.fromInts(255, 255, 200))
    }
  }

  buffer.drawText(`F${floor.floorNum}`, ox, oy + mapH + 1, RGBA.fromInts(100, 120, 180))
}
