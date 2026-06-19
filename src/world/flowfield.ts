import { GameMap, TILE_WALL } from "./map.ts"

/** 8-directional neighbour offsets (4 cardinal + 4 diagonal). */
export const DX = [0, 0, -1, 1, -1, 1, -1, 1]
export const DY = [-1, 1, 0, 0, -1, -1, 1, 1]

/**
 * A Dijkstra distance field ("flow field") computed once per tick from the
 * player's tile via breadth-first search over floor cells.
 *
 * This is the core trick that lets the game support hordes: every enemy just
 * reads `dist` and steps to the neighbour with the lowest value. Cost is
 * O(cells) per recompute, completely independent of the enemy count — whether
 * there are 10 enemies or 10,000, the routing work is the same.
 */
export class FlowField {
  readonly width: number
  readonly height: number
  /** Distance from the target in steps; -1 means unreachable. */
  readonly dist: Int32Array
  private readonly queue: Int32Array

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.dist = new Int32Array(width * height)
    this.queue = new Int32Array(width * height)
  }

  compute(map: GameMap, targetX: number, targetY: number): void {
    const { width, height, dist, queue } = this
    dist.fill(-1)
    if (map.isWall(targetX, targetY)) return

    let head = 0
    let tail = 0
    const start = targetY * width + targetX
    dist[start] = 0
    queue[tail++] = start

    while (head < tail) {
      const cur = queue[head++]
      const cx = cur % width
      const cy = (cur / width) | 0
      const nd = dist[cur] + 1
      for (let k = 0; k < 8; k++) {
        const nx = cx + DX[k]
        const ny = cy + DY[k]
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const ni = ny * width + nx
        if (dist[ni] !== -1 || map.tiles[ni] === TILE_WALL) continue
        dist[ni] = nd
        queue[tail++] = ni
      }
    }
  }
}
