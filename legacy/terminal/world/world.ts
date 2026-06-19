import { RNG } from "../core/rng.ts"
import { GameMap, generateCave } from "./map.ts"
import { FlowField, DX, DY } from "./flowfield.ts"

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------
export const MAP_W = 120
export const MAP_H = 60
export const MAX_ENEMIES = 2000

const PLAYER_MAX_HP = 100
const PLAYER_MOVE_DELAY = 0.06 // seconds between player steps while held
const PLAYER_MELEE_DMG = 3
const PLAYER_IHIT = 0.4 // invulnerability window after taking a hit
const REPEAT_GRACE = 0.13 // how long a keypress keeps you moving (matches key-repeat)

const CLEAVE_CD = 0.9
const CLEAVE_DMG = 5

const WAVE_SECONDS = 18
const SPAWN_MIN_DIST = 14 // enemies appear at least this far from the player

/** Enemy archetypes. `step` is seconds between moves (lower = faster). */
export const ENEMY_TYPES = [
  { name: "grunt", glyph: "g", hp: 2, dmg: 6, step: 0.15 },
  { name: "stalker", glyph: "z", hp: 1, dmg: 4, step: 0.09 },
  { name: "brute", glyph: "O", hp: 7, dmg: 14, step: 0.26 },
] as const

export const T_BASIC = 0
export const T_FAST = 1
export const T_TANK = 2

export interface Player {
  x: number
  y: number
  hp: number
  maxHp: number
  alive: boolean
  moveCd: number
  invuln: number
  wantDx: number
  wantDy: number
  wantUntil: number
}

export type GameState = "playing" | "dead"

export class World {
  map!: GameMap
  flow!: FlowField
  rng: RNG
  player!: Player
  state: GameState = "playing"

  // Enemies stored as parallel typed arrays (struct-of-arrays) for cache-
  // friendly iteration over large counts. `count` is the live population.
  readonly ex = new Int32Array(MAX_ENEMIES)
  readonly ey = new Int32Array(MAX_ENEMIES)
  readonly ehp = new Int16Array(MAX_ENEMIES)
  readonly etype = new Uint8Array(MAX_ENEMIES)
  readonly ecd = new Float32Array(MAX_ENEMIES) // seconds until this enemy's next move
  readonly estep = new Float32Array(MAX_ENEMIES) // base seconds per move
  count = 0

  /** enemyIndex+1 occupying each cell, 0 = empty. Rebuilt each frame. */
  occupancy!: Int32Array

  // Stats / pacing
  time = 0
  wave = 1
  kills = 0
  cleaveCd = 0

  // Transient visual cues (seconds remaining)
  cleaveFlash = 0
  hurtFlash = 0

  private lastFlowX = -1
  private lastFlowY = -1
  private spawnAcc = 0

  constructor(seed?: number) {
    this.rng = new RNG(seed)
    this.reset()
  }

  reset(): void {
    const { map, spawn } = generateCave(MAP_W, MAP_H, this.rng)
    this.map = map
    this.flow = new FlowField(MAP_W, MAP_H)
    this.occupancy = new Int32Array(MAP_W * MAP_H)
    this.player = {
      x: spawn.x,
      y: spawn.y,
      hp: PLAYER_MAX_HP,
      maxHp: PLAYER_MAX_HP,
      alive: true,
      moveCd: 0,
      invuln: 0,
      wantDx: 0,
      wantDy: 0,
      wantUntil: 0,
    }
    this.count = 0
    this.time = 0
    this.wave = 1
    this.kills = 0
    this.cleaveCd = 0
    this.cleaveFlash = 0
    this.hurtFlash = 0
    this.lastFlowX = -1
    this.lastFlowY = -1
    this.spawnAcc = 0
    this.state = "playing"

    this.flow.compute(this.map, spawn.x, spawn.y)
    this.lastFlowX = spawn.x
    this.lastFlowY = spawn.y
    // Seed the opening horde.
    this.spawnBatch(25)
  }

  // -- Input intents ---------------------------------------------------------

  /** Called from the keypress handler with a desired step direction. */
  requestMove(dx: number, dy: number): void {
    if (this.state !== "playing") return
    this.player.wantDx = dx
    this.player.wantDy = dy
    this.player.wantUntil = this.time + REPEAT_GRACE
  }

  cleave(): void {
    if (this.state !== "playing" || this.cleaveCd > 0) return
    this.cleaveCd = CLEAVE_CD
    this.cleaveFlash = 0.18
    const { player } = this
    for (let k = 0; k < 8; k++) {
      this.damageEnemyAt(player.x + DX[k], player.y + DY[k], CLEAVE_DMG)
    }
  }

  // -- Main update -----------------------------------------------------------

  update(dtSec: number): void {
    // Clamp to avoid a huge first-frame / hitch advancing the sim too far.
    const dt = Math.min(dtSec, 0.05)
    this.cleaveFlash = Math.max(0, this.cleaveFlash - dt)
    this.hurtFlash = Math.max(0, this.hurtFlash - dt)

    if (this.state !== "playing") return

    this.time += dt
    this.wave = 1 + Math.floor(this.time / WAVE_SECONDS)
    const p = this.player

    p.invuln = Math.max(0, p.invuln - dt)
    this.cleaveCd = Math.max(0, this.cleaveCd - dt)

    // Player movement: keep stepping while a direction key is held (key-repeat
    // keeps `wantUntil` fresh); stop shortly after release.
    p.moveCd -= dt
    if (p.moveCd <= 0 && this.time < p.wantUntil && (p.wantDx !== 0 || p.wantDy !== 0)) {
      this.tryMovePlayer(p.wantDx, p.wantDy)
      p.moveCd = PLAYER_MOVE_DELAY
    }

    // Recompute the flow field only when the player has changed tiles.
    if (p.x !== this.lastFlowX || p.y !== this.lastFlowY) {
      this.flow.compute(this.map, p.x, p.y)
      this.lastFlowX = p.x
      this.lastFlowY = p.y
    }

    this.rebuildOccupancy()

    // Enemies act on their individual cooldowns; difficulty speeds them up.
    const stepScale = Math.max(0.45, 1 - this.wave * 0.05)
    for (let i = 0; i < this.count; i++) {
      this.ecd[i] -= dt
      if (this.ecd[i] <= 0) {
        this.stepEnemy(i)
        this.ecd[i] += this.estep[i] * stepScale
      }
    }

    // Continuous spawning keeps the pressure on.
    this.spawnAcc -= dt
    if (this.spawnAcc <= 0) {
      const target = Math.min(MAX_ENEMIES, 25 + this.wave * 18)
      if (this.count < target) this.spawnBatch(2 + (this.wave >> 1))
      this.spawnAcc = Math.max(0.12, 0.6 - this.wave * 0.03)
    }

    if (p.hp <= 0) {
      p.hp = 0
      p.alive = false
      this.state = "dead"
    }
  }

  // -- Player actions --------------------------------------------------------

  private tryMovePlayer(dx: number, dy: number): void {
    const p = this.player
    const nx = p.x + dx
    const ny = p.y + dy
    if (this.map.isWall(nx, ny)) return
    const occ = this.occupancy[ny * MAP_W + nx]
    if (occ !== 0) {
      // Bump-attack the enemy occupying the destination.
      this.damageEnemy(occ - 1, PLAYER_MELEE_DMG)
      return
    }
    p.x = nx
    p.y = ny
  }

  // -- Enemy AI --------------------------------------------------------------

  private stepEnemy(i: number): void {
    const p = this.player
    const ex = this.ex[i]
    const ey = this.ey[i]

    // Adjacent to the player → attack instead of moving.
    if (Math.abs(ex - p.x) <= 1 && Math.abs(ey - p.y) <= 1) {
      if (p.invuln <= 0) {
        p.hp -= ENEMY_TYPES[this.etype[i]].dmg
        p.invuln = PLAYER_IHIT
        this.hurtFlash = 0.15
      }
      return
    }

    const here = this.flow.dist[ey * MAP_W + ex]
    if (here < 0) return // unreachable pocket — idle

    // Descend the flow field toward the player, picking the lowest-distance,
    // unoccupied neighbour. A random start offset breaks directional lockstep.
    let bestD = here
    let bestK = -1
    const start = this.rng.int(8)
    for (let j = 0; j < 8; j++) {
      const k = (start + j) & 7
      const nx = ex + DX[k]
      const ny = ey + DY[k]
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue
      const ni = ny * MAP_W + nx
      const d = this.flow.dist[ni]
      if (d < 0 || d >= bestD) continue
      if (this.occupancy[ni] !== 0) continue
      if (nx === p.x && ny === p.y) continue
      bestD = d
      bestK = k
    }

    if (bestK >= 0) {
      this.occupancy[ey * MAP_W + ex] = 0
      const nx = ex + DX[bestK]
      const ny = ey + DY[bestK]
      this.ex[i] = nx
      this.ey[i] = ny
      this.occupancy[ny * MAP_W + nx] = i + 1
    }
  }

  // -- Combat helpers --------------------------------------------------------

  private damageEnemyAt(x: number, y: number, dmg: number): void {
    if (!this.map.inBounds(x, y)) return
    const occ = this.occupancy[y * MAP_W + x]
    if (occ !== 0) this.damageEnemy(occ - 1, dmg)
  }

  private damageEnemy(i: number, dmg: number): void {
    this.ehp[i] -= dmg
    if (this.ehp[i] <= 0) {
      this.occupancy[this.ey[i] * MAP_W + this.ex[i]] = 0
      this.removeEnemy(i)
      this.kills++
    }
  }

  // -- Population management --------------------------------------------------

  private rebuildOccupancy(): void {
    this.occupancy.fill(0)
    for (let i = 0; i < this.count; i++) {
      this.occupancy[this.ey[i] * MAP_W + this.ex[i]] = i + 1
    }
  }

  /** Swap-remove: O(1) deletion that keeps the arrays densely packed. */
  private removeEnemy(i: number): void {
    const last = this.count - 1
    if (i !== last) {
      this.ex[i] = this.ex[last]
      this.ey[i] = this.ey[last]
      this.ehp[i] = this.ehp[last]
      this.etype[i] = this.etype[last]
      this.ecd[i] = this.ecd[last]
      this.estep[i] = this.estep[last]
      // The moved enemy now lives at index i; fix its occupancy pointer.
      this.occupancy[this.ey[i] * MAP_W + this.ex[i]] = i + 1
    }
    this.count = last
  }

  private addEnemy(x: number, y: number, type: number): void {
    if (this.count >= MAX_ENEMIES) return
    const i = this.count++
    this.ex[i] = x
    this.ey[i] = y
    this.etype[i] = type
    this.ehp[i] = ENEMY_TYPES[type].hp
    this.estep[i] = ENEMY_TYPES[type].step
    this.ecd[i] = this.rng.next() * ENEMY_TYPES[type].step // desync first moves
    this.occupancy[y * MAP_W + x] = i + 1
  }

  private pickType(): number {
    const r = this.rng.next()
    const tankChance = Math.min(0.25, this.wave * 0.015)
    const fastChance = Math.min(0.4, 0.05 + this.wave * 0.02)
    if (r < tankChance) return T_TANK
    if (r < tankChance + fastChance) return T_FAST
    return T_BASIC
  }

  private spawnBatch(n: number): void {
    const p = this.player
    let placed = 0
    let attempts = n * 30
    while (placed < n && attempts-- > 0 && this.count < MAX_ENEMIES) {
      const x = this.rng.range(1, MAP_W - 2)
      const y = this.rng.range(1, MAP_H - 2)
      const idx = y * MAP_W + x
      if (this.map.tiles[idx] === 0) continue // wall
      if (this.flow.dist[idx] < 0) continue // unreachable
      if (this.occupancy[idx] !== 0) continue // taken
      if (Math.max(Math.abs(x - p.x), Math.abs(y - p.y)) < SPAWN_MIN_DIST) continue
      this.addEnemy(x, y, this.pickType())
      placed++
    }
  }
}
