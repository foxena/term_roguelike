import type { RoomDef } from "../game/room.ts"
import { isWalkable } from "../game/room.ts"

export const DX8 = [0, 0, -1, 1, -1, 1, -1, 1]
export const DY8 = [-1, 1, 0, 0, -1, -1, 1, 1]

/** BFS distance field from a target tile, steers all enemies in O(tiles). */
export class FlowField {
  dist: Int32Array
  private queue: Int32Array

  constructor(private maxTiles: number) {
    this.dist  = new Int32Array(maxTiles)
    this.queue = new Int32Array(maxTiles)
  }

  compute(room: RoomDef, targetTX: number, targetTY: number): void {
    const W = room.width, H = room.height
    this.dist.fill(-1)
    if (!isWalkable(room, targetTX, targetTY)) return
    let head = 0, tail = 0
    const start = targetTY * W + targetTX
    this.dist[start] = 0
    this.queue[tail++] = start
    while (head < tail) {
      const cur = this.queue[head++]
      const cx = cur % W, cy = (cur / W) | 0
      const nd = this.dist[cur] + 1
      for (let k = 0; k < 8; k++) {
        const nx = cx + DX8[k], ny = cy + DY8[k]
        const ni = ny * W + nx
        if (!isWalkable(room, nx, ny) || this.dist[ni] !== -1) continue
        this.dist[ni] = nd
        this.queue[tail++] = ni
      }
    }
  }
}
