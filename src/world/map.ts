import { RNG } from "../core/rng.ts"

export const TILE_WALL = 0
export const TILE_FLOOR = 1

/** A dense tile grid. Tiles are stored row-major in a flat Uint8Array. */
export class GameMap {
  readonly width: number
  readonly height: number
  tiles: Uint8Array

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.tiles = new Uint8Array(width * height)
  }

  idx(x: number, y: number): number {
    return y * this.width + x
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height
  }

  isWall(x: number, y: number): boolean {
    return !this.inBounds(x, y) || this.tiles[this.idx(x, y)] === TILE_WALL
  }

  isFloor(x: number, y: number): boolean {
    return this.inBounds(x, y) && this.tiles[this.idx(x, y)] === TILE_FLOOR
  }
}

export interface GeneratedMap {
  map: GameMap
  /** A guaranteed-open floor tile near the centre of the largest cavern. */
  spawn: { x: number; y: number }
}

/**
 * Cellular-automata cave generation. Open caverns make for good horde
 * gameplay — enemies pour in from all sides instead of single-file corridors.
 */
export function generateCave(
  width: number,
  height: number,
  rng: RNG,
  fillProb = 0.45,
  steps = 5,
): GeneratedMap {
  const map = new GameMap(width, height)
  let cur = map.tiles

  // 1. Random fill (borders always solid).
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const border = x === 0 || y === 0 || x === width - 1 || y === height - 1
      cur[y * width + x] = border || rng.next() < fillProb ? TILE_WALL : TILE_FLOOR
    }
  }

  // 2. Smoothing passes: a cell becomes wall if it has >=5 wall neighbours.
  for (let s = 0; s < steps; s++) {
    const next = new Uint8Array(cur.length)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let walls = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || ny < 0 || nx >= width || ny >= height || cur[ny * width + nx] === TILE_WALL) {
              walls++
            }
          }
        }
        next[y * width + x] = walls >= 5 ? TILE_WALL : TILE_FLOOR
      }
    }
    cur = next
  }

  // Re-seal the border after smoothing.
  for (let x = 0; x < width; x++) {
    cur[x] = TILE_WALL
    cur[(height - 1) * width + x] = TILE_WALL
  }
  for (let y = 0; y < height; y++) {
    cur[y * width] = TILE_WALL
    cur[y * width + (width - 1)] = TILE_WALL
  }

  map.tiles = cur

  // 3. Keep only the largest connected cavern so everything is reachable
  //    (a precondition for the flow field to be able to route every enemy).
  const spawn = keepLargestRegion(map)
  return { map, spawn }
}

/**
 * Flood-fills floor regions, keeps the biggest, and walls off the rest.
 * Returns a floor tile inside the surviving region to use as a spawn point.
 */
function keepLargestRegion(map: GameMap): { x: number; y: number } {
  const { width, height, tiles } = map
  const region = new Int32Array(width * height).fill(-1)
  const queue = new Int32Array(width * height)
  let bestRegion = -1
  let bestSize = 0
  let regionId = 0

  for (let start = 0; start < tiles.length; start++) {
    if (tiles[start] === TILE_WALL || region[start] !== -1) continue
    let head = 0
    let tail = 0
    queue[tail++] = start
    region[start] = regionId
    let size = 0
    while (head < tail) {
      const cur = queue[head++]
      size++
      const cx = cur % width
      const cy = (cur / width) | 0
      const neighbours = [cur - 1, cur + 1, cur - width, cur + width]
      const okX = [cx > 0, cx < width - 1, true, true]
      for (let n = 0; n < 4; n++) {
        const ni = neighbours[n]
        if (!okX[n] || ni < 0 || ni >= tiles.length) continue
        if (tiles[ni] === TILE_WALL || region[ni] !== -1) continue
        region[ni] = regionId
        queue[tail++] = ni
      }
    }
    if (size > bestSize) {
      bestSize = size
      bestRegion = regionId
    }
    regionId++
  }

  // Wall off every cell that isn't part of the largest region.
  let spawn = { x: (width / 2) | 0, y: (height / 2) | 0 }
  let spawnDist = Infinity
  const cx = width / 2
  const cy = height / 2
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === TILE_FLOOR && region[i] !== bestRegion) {
      tiles[i] = TILE_WALL
    } else if (region[i] === bestRegion) {
      const x = i % width
      const y = (i / width) | 0
      const d = (x - cx) ** 2 + (y - cy) ** 2
      if (d < spawnDist) {
        spawnDist = d
        spawn = { x, y }
      }
    }
  }
  return spawn
}
