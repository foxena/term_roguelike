import { RNG } from "../engine/rng.ts"

export const TILE = { EMPTY: 0, FLOOR: 1, WALL: 2, DOOR_N: 3, DOOR_S: 4, DOOR_E: 5, DOOR_W: 6 } as const
export type TileType = typeof TILE[keyof typeof TILE]

export type DoorDir = "N" | "S" | "E" | "W"

export interface RoomDef {
  width: number
  height: number
  tiles: Uint8Array
  doors: Set<DoorDir>
  /** pixel scale — 1 tile = SCALE pixels */
  scale: number
}

export const ROOM_SCALE = 8  // pixels per tile
export const ROOM_COLS  = 18 // tiles across
export const ROOM_ROWS  = 13 // tiles tall

export function buildRoom(rng: RNG, doors: Set<DoorDir>): RoomDef {
  const W = ROOM_COLS, H = ROOM_ROWS
  const tiles = new Uint8Array(W * H)

  // fill floor
  for (let i = 0; i < tiles.length; i++) tiles[i] = TILE.FLOOR

  // solid border walls
  for (let x = 0; x < W; x++) {
    tiles[x] = TILE.WALL
    tiles[(H - 1) * W + x] = TILE.WALL
  }
  for (let y = 0; y < H; y++) {
    tiles[y * W] = TILE.WALL
    tiles[y * W + W - 1] = TILE.WALL
  }

  // random interior obstacles (small pillar clusters)
  const pillars = rng.range(2, 6)
  for (let p = 0; p < pillars; p++) {
    const px = rng.range(3, W - 4)
    const py = rng.range(3, H - 4)
    const sz = rng.range(1, 2)
    for (let dy = -sz; dy <= sz; dy++) {
      for (let dx = -sz; dx <= sz; dx++) {
        const x = px + dx, y = py + dy
        if (x > 0 && y > 0 && x < W - 1 && y < H - 1) tiles[y * W + x] = TILE.WALL
      }
    }
  }

  // carve door openings
  const mx = (W / 2) | 0, my = (H / 2) | 0
  if (doors.has("N")) { tiles[0 * W + mx - 1] = TILE.DOOR_N; tiles[0 * W + mx] = TILE.DOOR_N; tiles[0 * W + mx + 1] = TILE.DOOR_N }
  if (doors.has("S")) { tiles[(H-1)*W+mx-1]=TILE.DOOR_S; tiles[(H-1)*W+mx]=TILE.DOOR_S; tiles[(H-1)*W+mx+1]=TILE.DOOR_S }
  if (doors.has("E")) { tiles[(my-1)*W+W-1]=TILE.DOOR_E; tiles[my*W+W-1]=TILE.DOOR_E; tiles[(my+1)*W+W-1]=TILE.DOOR_E }
  if (doors.has("W")) { tiles[(my-1)*W]=TILE.DOOR_W; tiles[my*W]=TILE.DOOR_W; tiles[(my+1)*W]=TILE.DOOR_W }

  return { width: W, height: H, tiles, doors, scale: ROOM_SCALE }
}

export function isWalkable(room: RoomDef, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= room.width || ty >= room.height) return false
  const t = room.tiles[ty * room.width + tx]
  return t === TILE.FLOOR || t >= TILE.DOOR_N
}

/** World pixel → tile index */
export function worldToTile(px: number, scale: number): number {
  return Math.floor(px / scale)
}
