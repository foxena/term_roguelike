import { RNG } from "../engine/rng.ts"
import { FlowField, DX8, DY8 } from "../engine/flowfield.ts"
import type { RoomDef } from "./room.ts"
import { worldToTile } from "./room.ts"

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------
export interface Player {
  x: number; y: number       // world pixel position (centre)
  vx: number; vy: number     // velocity px/sec
  hp: number; maxHp: number
  speed: number              // px/sec
  radius: number             // collision/hitbox
  invuln: number             // invulnerability seconds remaining
  class: string
  aimX: number; aimY: number // normalised aim dir
  abilityCd: number
  abilityMaxCd: number
  alive: boolean
}

export function makePlayer(x: number, y: number, cls: string): Player {
  return { x, y, vx: 0, vy: 0, hp: 100, maxHp: 100, speed: 90, radius: 4,
           invuln: 0, class: cls, aimX: 0, aimY: 1, abilityCd: 0, abilityMaxCd: 2, alive: true }
}

// ---------------------------------------------------------------------------
// Projectiles
// ---------------------------------------------------------------------------
const PROJ_MAX = 500
export class ProjectilePool {
  x   = new Float32Array(PROJ_MAX)
  y   = new Float32Array(PROJ_MAX)
  vx  = new Float32Array(PROJ_MAX)
  vy  = new Float32Array(PROJ_MAX)
  dmg = new Float32Array(PROJ_MAX)
  life= new Float32Array(PROJ_MAX)
  r   = new Uint8Array(PROJ_MAX)
  g   = new Uint8Array(PROJ_MAX)
  b   = new Uint8Array(PROJ_MAX)
  radius= new Float32Array(PROJ_MAX)
  pierce= new Uint8Array(PROJ_MAX)    // remaining pierces
  fromPlayer= new Uint8Array(PROJ_MAX)// 1 = player shot, 0 = enemy shot
  count = 0

  spawn(x: number, y: number, vx: number, vy: number, dmg: number, life: number,
        r: number, g: number, b: number, radius = 2, pierce = 0, fromPlayer = true): void {
    if (this.count >= PROJ_MAX) return
    const i = this.count++
    this.x[i]=x; this.y[i]=y; this.vx[i]=vx; this.vy[i]=vy
    this.dmg[i]=dmg; this.life[i]=life
    this.r[i]=r; this.g[i]=g; this.b[i]=b
    this.radius[i]=radius; this.pierce[i]=pierce; this.fromPlayer[i]=fromPlayer?1:0
  }

  remove(i: number): void {
    const last = --this.count
    if (i === last) return
    this.x[i]=this.x[last]; this.y[i]=this.y[last]
    this.vx[i]=this.vx[last]; this.vy[i]=this.vy[last]
    this.dmg[i]=this.dmg[last]; this.life[i]=this.life[last]
    this.r[i]=this.r[last]; this.g[i]=this.g[last]; this.b[i]=this.b[last]
    this.radius[i]=this.radius[last]; this.pierce[i]=this.pierce[last]
    this.fromPlayer[i]=this.fromPlayer[last]
  }

  update(dt: number, room: RoomDef): void {
    let i = 0
    while (i < this.count) {
      this.x[i] += this.vx[i] * dt
      this.y[i] += this.vy[i] * dt
      this.life[i] -= dt
      const tx = worldToTile(this.x[i], room.scale)
      const ty = worldToTile(this.y[i], room.scale)
      const hitWall = !isWalkable(room, tx, ty)
      if (this.life[i] <= 0 || hitWall) { this.remove(i) } else { i++ }
    }
  }
}

function isWalkable(room: RoomDef, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= room.width || ty >= room.height) return false
  const t = room.tiles[ty * room.width + tx]
  return t !== 2 // not wall
}

// ---------------------------------------------------------------------------
// Enemies — SoA for cache-friendly horde iteration
// ---------------------------------------------------------------------------
const ENEMY_MAX = 600

export const ETYPE = {
  CHASER:  0,
  SWARMER: 1,
  BRUTE:   2,
  SHOOTER: 3,
  EXPLODER:4,
} as const

export const ENEMY_DEFS = [
  { hp: 3,  dmg: 8,  speed: 55, radius: 4, r: 255, g: 60,  b: 160, size: 3.5, shootRange: 0,   shootCd: 0   }, // chaser
  { hp: 1,  dmg: 4,  speed: 80, radius: 3, r: 255, g: 140, b: 30,  size: 2.5, shootRange: 0,   shootCd: 0   }, // swarmer
  { hp: 12, dmg: 18, speed: 35, radius: 7, r: 160, g: 30,  b: 255, size: 6,   shootRange: 0,   shootCd: 0   }, // brute
  { hp: 4,  dmg: 6,  speed: 40, radius: 4, r: 60,  g: 220, b: 255, size: 4,   shootRange: 160, shootCd: 1.8 }, // shooter
  { hp: 5,  dmg: 20, speed: 45, radius: 5, r: 255, g: 80,  b: 50,  size: 5,   shootRange: 0,   shootCd: 0   }, // exploder
] as const

export class EnemyPool {
  x     = new Float32Array(ENEMY_MAX)
  y     = new Float32Array(ENEMY_MAX)
  vx    = new Float32Array(ENEMY_MAX)
  vy    = new Float32Array(ENEMY_MAX)
  hp    = new Float32Array(ENEMY_MAX)
  maxHp = new Float32Array(ENEMY_MAX)
  type  = new Uint8Array(ENEMY_MAX)
  mvCd  = new Float32Array(ENEMY_MAX)  // move cooldown (swarmer/brute step time)
  shCd  = new Float32Array(ENEMY_MAX)  // shoot cooldown
  stunT = new Float32Array(ENEMY_MAX)  // stun seconds
  count = 0

  spawn(x: number, y: number, type: number, rng: RNG): void {
    if (this.count >= ENEMY_MAX) return
    const i = this.count++
    const d = ENEMY_DEFS[type]
    this.x[i]=x; this.y[i]=y; this.vx[i]=0; this.vy[i]=0
    this.hp[i]=d.hp; this.maxHp[i]=d.hp
    this.type[i]=type
    this.mvCd[i]=rng.next()*0.3
    this.shCd[i]=rng.next()*d.shootCd
    this.stunT[i]=0
  }

  remove(i: number): void {
    const last = --this.count
    if (i === last) return
    this.x[i]=this.x[last]; this.y[i]=this.y[last]
    this.vx[i]=this.vx[last]; this.vy[i]=this.vy[last]
    this.hp[i]=this.hp[last]; this.maxHp[i]=this.maxHp[last]
    this.type[i]=this.type[last]; this.mvCd[i]=this.mvCd[last]
    this.shCd[i]=this.shCd[last]; this.stunT[i]=this.stunT[last]
  }

  update(dt: number, flow: FlowField, room: RoomDef, player: Player, projs: ProjectilePool, rng: RNG): void {
    const S = room.scale
    for (let i = 0; i < this.count; i++) {
      if (this.stunT[i] > 0) { this.stunT[i] -= dt; continue }
      const def = ENEMY_DEFS[this.type[i]]
      const dx = player.x - this.x[i]
      const dy = player.y - this.y[i]
      const dist = Math.sqrt(dx*dx + dy*dy)

      // shooting enemies
      if (def.shootRange > 0 && dist < def.shootRange) {
        this.shCd[i] -= dt
        if (this.shCd[i] <= 0) {
          this.shCd[i] = def.shootCd
          const spd = 80
          const nx = dist > 0 ? dx/dist : 0, ny = dist > 0 ? dy/dist : 0
          projs.spawn(this.x[i], this.y[i], nx*spd, ny*spd, def.dmg, 3,
                      def.r, def.g, def.b, 2, 0, false)
        }
      }

      // flow-field steering (steer toward player via BFS gradient)
      const tx = worldToTile(this.x[i], S), ty = worldToTile(this.y[i], S)
      const here = flow.dist[ty * room.width + tx]
      if (here > 0) {
        let bestD = here, bestK = -1
        for (let k = 0; k < 8; k++) {
          const nx = tx + DX8[k], ny = ty + DY8[k]
          if (nx < 0 || ny < 0 || nx >= room.width || ny >= room.height) continue
          const nd = flow.dist[ny * room.width + nx]
          if (nd >= 0 && nd < bestD) { bestD = nd; bestK = k }
        }
        if (bestK >= 0) {
          this.vx[i] = DX8[bestK] * def.speed
          this.vy[i] = DY8[bestK] * def.speed
        }
      } else if (here === 0) {
        // arrived at player tile — zero velocity
        this.vx[i] = 0; this.vy[i] = 0
      }

      // move with simple wall slide
      const nx = this.x[i] + this.vx[i] * dt
      const ny = this.y[i] + this.vy[i] * dt
      const ntx = worldToTile(nx, S), nty = worldToTile(ny, S)
      this.x[i] = isWalkable(room, ntx, ty) ? nx : this.x[i]
      this.y[i] = isWalkable(room, tx, nty) ? ny : this.y[i]
    }
  }
}
