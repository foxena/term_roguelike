import { RNG } from "../engine/rng.ts"
import { buildRoom, type RoomDef, type DoorDir } from "./room.ts"

export type RoomType = "combat" | "treasure" | "shop" | "boss" | "secret" | "start"

export interface FloorRoom {
  id: number
  gx: number   // grid position
  gy: number
  type: RoomType
  doors: Set<DoorDir>
  def?: RoomDef
  cleared: boolean
  visited: boolean
}

export interface Floor {
  rooms: Map<string, FloorRoom>
  startId: number
  bossId: number
  floorNum: number
}

const OPPOSITE: Record<DoorDir, DoorDir> = { N: "S", S: "N", E: "W", W: "E" }
const DIR_DELTA: Record<DoorDir, [number,number]> = { N:[0,-1], S:[0,1], E:[1,0], W:[-1,0] }

export function generateFloor(rng: RNG, floorNum: number): Floor {
  const rooms = new Map<string, FloorRoom>()
  const key = (x: number, y: number) => `${x},${y}`

  let id = 0
  const totalRooms = rng.range(8, 13)
  const queue: [number, number][] = [[0, 0]]
  const placed = new Set<string>()

  // BFS room placement
  const startRoom: FloorRoom = { id: id++, gx: 0, gy: 0, type: "start", doors: new Set(), cleared: false, visited: false }
  rooms.set(key(0, 0), startRoom)
  placed.add(key(0, 0))

  while (queue.length > 0 && rooms.size < totalRooms) {
    const [cx, cy] = queue.splice(rng.int(queue.length), 1)[0]
    const dirs: DoorDir[] = ["N", "S", "E", "W"]
    rng.pick(dirs)  // shuffle via random access
    for (const dir of dirs.sort(() => rng.next() - 0.5)) {
      if (rooms.size >= totalRooms) break
      const [dx, dy] = DIR_DELTA[dir]
      const nx = cx + dx, ny = cy + dy
      const nk = key(nx, ny)
      if (placed.has(nk)) continue
      if (rng.next() < 0.3 && rooms.size > 2) continue  // sparse branching

      const room: FloorRoom = { id: id++, gx: nx, gy: ny, type: "combat", doors: new Set([OPPOSITE[dir]]), cleared: false, visited: false }
      rooms.get(key(cx, cy))!.doors.add(dir)
      rooms.set(nk, room)
      placed.add(nk)
      queue.push([nx, ny])
    }
  }

  // Assign special room types: farthest = boss, second-farthest = treasure, random = shop/secret
  const allRooms = [...rooms.values()]
  const distances = allRooms.map(r => Math.abs(r.gx) + Math.abs(r.gy))
  const sorted = allRooms.map((r, i) => ({ r, d: distances[i] })).sort((a, b) => b.d - a.d)

  let bossId = sorted[0].r.id
  sorted[0].r.type = "boss"
  if (sorted[1]) sorted[1].r.type = "treasure"

  // Scatter shop/secret
  for (let i = 2; i < sorted.length; i++) {
    const p = rng.next()
    if (p < 0.15 && sorted[i].d > 1) { sorted[i].r.type = "shop"; break }
  }
  for (let i = 2; i < sorted.length; i++) {
    if (sorted[i].r.type === "combat" && rng.next() < 0.12) {
      sorted[i].r.type = "secret"; break
    }
  }

  return { rooms, startId: startRoom.id, bossId, floorNum }
}

export function buildFloorRoom(room: FloorRoom, rng: RNG): RoomDef {
  if (room.def) return room.def
  const def = buildRoom(rng, room.doors)
  room.def = def
  return def
}

export function getRoomAt(floor: Floor, gx: number, gy: number): FloorRoom | undefined {
  return floor.rooms.get(`${gx},${gy}`)
}

export const ROOM_TYPE_COLOR: Record<RoomType, [number, number, number]> = {
  start:    [100, 180, 100],
  combat:   [150, 150, 180],
  treasure: [255, 210, 80],
  shop:     [80, 200, 255],
  boss:     [255, 60, 60],
  secret:   [180, 80, 255],
}
