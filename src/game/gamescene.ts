import type { PixelCanvas } from "../engine/pixelcanvas.ts"
import type { OptimizedBuffer } from "@opentui/core"
import type { InputState } from "../engine/input.ts"
import type { Scene } from "../engine/scene.ts"
import { Camera } from "../engine/camera.ts"
import { Particles } from "../engine/particles.ts"
import { FlowField } from "../engine/flowfield.ts"
import { HitStop } from "../engine/hitstop.ts"
import { DamageNumbers } from "../engine/damagenumbers.ts"
import { SpatialHash } from "../engine/spatialhash.ts"
import { StatusEffectPool } from "./statuseffects.ts"
import { RNG } from "../engine/rng.ts"
import { makePlayer, EnemyPool, ProjectilePool, ENEMY_DEFS, type Player } from "./entities.ts"
import { overlaps, meleeArc } from "./combat.ts"
import { buildRoom, ROOM_SCALE, type RoomDef, type DoorDir } from "./room.ts"
import { makeRun, computeEssence, type RunStats } from "./progression/run.ts"
import { generateFloor, buildFloorRoom, getRoomAt, type Floor, type FloorRoom } from "./floor.ts"
import { drawRoom, drawEnemies, drawProjectiles, drawPlayer } from "../render/world.ts"
import { drawHud, drawDeathScreen, drawPauseScreen } from "../render/hud.ts"
import { drawMinimap } from "../render/minimap.ts"
import { spawnClassProjectile, spawnClassAbility } from "./classes/classactions.ts"
import { C } from "../engine/colors.ts"
import { pickItems, applyItem, baseStats, type ItemDef, type PlayerStats } from "./items.ts"
import { drawItemRoom, drawShopRoom } from "../render/screens.ts"
import { BossSystem } from "./bosses/bosssystem.ts"
import { RGBA } from "@opentui/core"

const FIXED_DT = 1 / 60
const FLOW_RETICK = 0.22
const DIR_DELTA: Record<DoorDir, [number, number]> = { N:[0,-1], S:[0,1], E:[1,0], W:[-1,0] }
const DIR_TILE_ENTER: Record<DoorDir, (w:number,h:number)=>[number,number]> = {
  N: (w,h) => [w/2|0, h-2],
  S: (w,h) => [w/2|0, 1],
  E: (_,h) => [1, h/2|0],
  W: (w,h) => [w-2, h/2|0],
}

export class GameScene implements Scene {
  private rng = new RNG()
  private player!: Player
  private enemies = new EnemyPool()
  private projs = new ProjectilePool()
  private particles = new Particles()
  private camera = new Camera()
  private flow!: FlowField
  private currentRoom!: RoomDef
  private currentFloorRoom!: FloorRoom
  private floor!: Floor
  private run: RunStats = makeRun()
  private status = new StatusEffectPool()
  private hitStop = new HitStop()
  private dmgNums = new DamageNumbers()
  private spatialHash = new SpatialHash(20)
  private t = 0
  private flowTick = 0
  private spawnTimer = 2
  private paused = false
  private showMap = false
  private state: "playing" | "dead" | "transition" = "playing"
  private transDir: DoorDir | null = null
  private transTimer = 0
  private acc = 0
  private scratch: Float32Array | null = null
  private fps = 60
  private waveNum = 0
  private roomEnemyCount = 0
  private boss = new BossSystem()
  // Phase 4: items
  private stats: PlayerStats = baseStats()
  private heldItems: ItemDef[] = []
  private uiState: "none" | "treasure" | "shop" = "none"
  private uiItems: ItemDef[] = []
  private uiPrices: number[] = []
  private uiSelected = 0

  constructor(public className: string = "warrior") {}

  onEnter(): void {
    this.rng = new RNG()
    this.floor = generateFloor(this.rng, this.run?.floor ?? 1)
    const startRoom = [...this.floor.rooms.values()].find(r => r.id === this.floor.startId)!
    this._enterRoom(startRoom, null)

    const S = ROOM_SCALE
    const cx = (this.currentRoom.width / 2 | 0) * S
    const cy = (this.currentRoom.height / 2 | 0) * S
    this.player = makePlayer(cx, cy, this.className)
    this.flow = new FlowField(this.currentRoom.width * this.currentRoom.height)
    this._recomputeFlow()
    this.run = makeRun()
    this.t = 0; this.paused = false; this.state = "playing"; this.waveNum = 0
    this.enemies.count = 0; this.projs.count = 0; this.particles.count = 0
    this.spawnTimer = 1.5; this.stats = baseStats(); this.heldItems = []
    this.uiState = "none"; this.uiSelected = 0
    this._spawnWave(6)
    this.camera.snap(this.player.x, this.player.y, 100, 50)
  }

  private _enterRoom(floorRoom: FloorRoom, fromDir: DoorDir | null): void {
    this.currentFloorRoom = floorRoom
    floorRoom.visited = true
    this.currentRoom = buildFloorRoom(floorRoom, this.rng)
    this.flow = new FlowField(this.currentRoom.width * this.currentRoom.height)
    this.enemies.count = 0; this.projs.count = 0
    this.waveNum = 0

    if (fromDir && this.player) {
      const [tx, ty] = DIR_TILE_ENTER[fromDir](this.currentRoom.width, this.currentRoom.height)
      this.player.x = tx * ROOM_SCALE
      this.player.y = ty * ROOM_SCALE
    }
    this._recomputeFlow()

    if (floorRoom.type === "combat" && !floorRoom.cleared) this._spawnWave(6 + this.run.roomsCleared * 2)
    if (floorRoom.type === "boss" && !floorRoom.cleared) {
      const cx = (this.currentRoom.width / 2) * ROOM_SCALE
      const cy = (this.currentRoom.height / 2) * ROOM_SCALE * 0.35
      this.boss.spawn(this.run.floor, cx, cy)
    }
    if (floorRoom.type === "treasure" && !floorRoom.cleared) {
      floorRoom.cleared = true
      this.uiItems = pickItems(3, this.rng)
      this.uiSelected = 0; this.uiState = "treasure"
    }
    if (floorRoom.type === "shop" && !floorRoom.cleared) {
      this.uiItems = pickItems(4, this.rng)
      this.uiPrices = this.uiItems.map(i => {
        const base = { common:4, uncommon:8, rare:16, legendary:30 }[i.rarity]
        return base + this.run.floor * 2
      })
      this.uiSelected = 0; this.uiState = "shop"
    }
  }

  private _applyStatsToPlayer(): void {
    const p = this.player, s = this.stats
    p.speed = 90 * s.speedMult
    const maxHp = Math.max(10, 100 + s.hpBonus)
    if (maxHp > p.maxHp) { p.hp += maxHp - p.maxHp }
    p.maxHp = maxHp
    p.hp = Math.min(p.hp, p.maxHp)
  }

  private _recomputeFlow(): void {
    const S = ROOM_SCALE
    if (!this.player) return
    this.flow.compute(this.currentRoom, Math.floor(this.player.x / S), Math.floor(this.player.y / S))
    this.flowTick = FLOW_RETICK
  }

  private _spawnWave(n: number): void {
    this.waveNum++
    this.roomEnemyCount += n
    const R = this.currentRoom
    const types = this.run.roomsCleared < 2 ? [0,1] : this.run.roomsCleared < 5 ? [0,1,2] : [0,1,2,3,4]
    for (let i = 0; i < n; i++) {
      let tx: number, ty: number, tries = 0
      do {
        tx = this.rng.range(2, R.width - 3)
        ty = this.rng.range(2, R.height - 3)
        tries++
      } while ((!isWalkableTile(R, tx, ty) || tileDistToPlayer(tx, ty, this.player, ROOM_SCALE) < 4) && tries < 40)
      this.enemies.spawn(tx * ROOM_SCALE, ty * ROOM_SCALE, this.rng.pick(types), this.rng)
    }
  }

  private _checkDoors(): void {
    const p = this.player
    const S = ROOM_SCALE
    const ptx = Math.floor(p.x / S), pty = Math.floor(p.y / S)
    const R = this.currentRoom

    if (!this.currentFloorRoom.cleared && this.currentFloorRoom.type !== "start") return

    for (const dir of this.currentFloorRoom.doors) {
      const [dx, dy] = DIR_DELTA[dir]
      const nextFloorRoom = getRoomAt(this.floor, this.currentFloorRoom.gx + dx, this.currentFloorRoom.gy + dy)
      if (!nextFloorRoom) continue

      let atDoor = false
      const mx = R.width / 2 | 0, my = R.height / 2 | 0
      if (dir === "N" && pty === 0 && Math.abs(ptx - mx) <= 1) atDoor = true
      if (dir === "S" && pty === R.height - 1 && Math.abs(ptx - mx) <= 1) atDoor = true
      if (dir === "E" && ptx === R.width - 1 && Math.abs(pty - my) <= 1) atDoor = true
      if (dir === "W" && ptx === 0 && Math.abs(pty - my) <= 1) atDoor = true

      if (atDoor) {
        this.transDir = dir
        this.state = "transition"
        this.transTimer = 0.3
        return
      }
    }
  }

  update(dt: number, input: InputState): void {
    if (input.map) this.showMap = !this.showMap

    // Handle item / shop UI
    if (this.uiState !== "none") {
      if (input.raw === "up" || input.raw === "k") this.uiSelected = Math.max(0, this.uiSelected - 1)
      if (input.raw === "down" || input.raw === "j") this.uiSelected = Math.min(this.uiItems.length - 1, this.uiSelected + 1)
      if (input.confirm) {
        const item = this.uiItems[this.uiSelected]
        if (this.uiState === "treasure") {
          this.heldItems.push(item); applyItem(this.stats, item)
          this.run.itemIds.push(item.id)
          this._applyStatsToPlayer()
          this.uiState = "none"
        } else if (this.uiState === "shop") {
          const price = this.uiPrices[this.uiSelected]
          if (this.run.gold >= price) {
            this.run.gold -= price; this.heldItems.push(item)
            applyItem(this.stats, item); this.run.itemIds.push(item.id)
            this._applyStatsToPlayer()
            this.uiItems.splice(this.uiSelected, 1); this.uiPrices.splice(this.uiSelected, 1)
            this.uiSelected = Math.min(this.uiSelected, this.uiItems.length - 1)
            if (this.uiItems.length === 0) this.uiState = "none"
          }
        }
      }
      if (input.pause || input.raw === "e") this.uiState = "none"
      return
    }

    if (input.pause && this.state === "playing") this.paused = !this.paused
    if (this.paused || this.state === "dead") return

    if (this.state === "transition") {
      this.transTimer -= dt
      if (this.transTimer <= 0) {
        const dir = this.transDir!
        const [dx, dy] = DIR_DELTA[dir]
        const nextFloorRoom = getRoomAt(this.floor, this.currentFloorRoom.gx + dx, this.currentFloorRoom.gy + dy)!
        const opposite: Record<DoorDir, DoorDir> = { N:"S", S:"N", E:"W", W:"E" }
        this._enterRoom(nextFloorRoom, opposite[dir])
        this.state = "playing"
        this.transDir = null
        if (this.currentFloorRoom.type === "boss") this.run.floor++
      }
      return
    }

    this.fps = Math.round(0.9 * this.fps + 0.1 / Math.max(dt, 0.001))
    this.acc += dt
    while (this.acc >= FIXED_DT) {
      const simDt = this.hitStop.tick(FIXED_DT)
      if (simDt > 0) this._tick(simDt, input)
      this.acc -= FIXED_DT
    }
    this.dmgNums.update(dt)
  }

  private _tick(dt: number, input: InputState): void {
    const p = this.player
    this.t += dt
    const S = ROOM_SCALE

    const anyMove = input.moveX !== 0 || input.moveY !== 0
    const mvLen = anyMove ? Math.sqrt(input.moveX**2 + input.moveY**2) : 1
    p.vx = anyMove ? (input.moveX / mvLen) * p.speed : 0
    p.vy = anyMove ? (input.moveY / mvLen) * p.speed : 0

    const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt
    const otx = Math.floor(p.x / S), oty = Math.floor(p.y / S)
    if (isWalkableTile(this.currentRoom, Math.floor(nx / S), oty)) p.x = nx
    if (isWalkableTile(this.currentRoom, otx, Math.floor(ny / S))) p.y = ny

    if (input.aimX !== 0 || input.aimY !== 0) {
      const al = Math.sqrt(input.aimX**2 + input.aimY**2)
      p.aimX = input.aimX / al; p.aimY = input.aimY / al
    }

    // HP regen
    if (this.stats.hpRegenRate > 0) {
      p.hp = Math.min(p.maxHp, p.hp + this.stats.hpRegenRate * dt)
    }

    if ((input.aimX !== 0 || input.aimY !== 0) && p.class !== "warrior" && p.class !== "paladin") {
      spawnClassProjectile(p, this.projs, this.particles, this.t)
    }
    if ((input.aimX !== 0 || input.aimY !== 0) && (p.class === "warrior" || p.class === "paladin")) {
      if (p.abilityCd <= (p.abilityMaxCd - 0.35)) {
        const angle = Math.atan2(p.aimY, p.aimX)
        const col = p.class === "warrior" ? C.warrior : C.paladin
        meleeArc(p, this.enemies, this.projs, 14, 34, angle, Math.PI * 0.65,
                 col.r, col.g, col.b, this.particles, this.camera, this.run)
        this.hitStop.trigger(0.03)
        const vfxAngle = angle + (Math.random() - 0.5) * 0.4
        for (let k = 0; k < 3; k++) {
          const r = 10 + k * 6
          this.particles.emit(p.x + Math.cos(vfxAngle)*r, p.y + Math.sin(vfxAngle)*r,
            Math.cos(vfxAngle+Math.PI/2)*30, Math.sin(vfxAngle+Math.PI/2)*30,
            col.r, col.g, col.b, 0.15, 2)
        }
        p.abilityCd = p.abilityMaxCd
      }
    }

    if (input.ability && p.abilityCd <= 0) {
      spawnClassAbility(p, this.enemies, this.projs, this.particles, this.camera, this.t, this.run)
      this.hitStop.trigger(0.06)
      p.abilityCd = p.abilityMaxCd
    }

    p.abilityCd = Math.max(0, p.abilityCd - dt)
    p.invuln   = Math.max(0, p.invuln - dt)

    this.flowTick -= dt
    if (this.flowTick <= 0) { this._recomputeFlow() }

    for (let i = 0; i < this.enemies.count; i++) {
      const { dmg, speedMult, stunned } = this.status.tick(i, dt)
      if (dmg > 0) {
        this.enemies.hp[i] -= dmg
        this.dmgNums.spawn(this.enemies.x[i], this.enemies.y[i], dmg, 255, 180, 60)
      }
      if (stunned) this.enemies.stunT[i] = Math.max(this.enemies.stunT[i], 0.05)
      if (speedMult < 1) { this.enemies.vx[i] *= speedMult; this.enemies.vy[i] *= speedMult }
    }

    this.enemies.update(dt, this.flow, this.currentRoom, p, this.projs, this.rng)
    this.boss.update(dt, p, this.projs, this.particles, this.camera, this.rng)
    this.projs.update(dt, this.currentRoom)
    this.particles.update(dt)
    this._resolveCombat(dt)

    // Room clear check
    if (!this.currentFloorRoom.cleared && this.enemies.count === 0 &&
        (this.currentFloorRoom.type === "combat" || this.currentFloorRoom.type === "boss")) {
      this.currentFloorRoom.cleared = true
      this.run.roomsCleared++
      this.particles.burst(p.x, p.y, 20, 80, 255, 140, 60, 0.8, 2.5)
    }

    // Reinforcement waves for uncleared combat rooms
    if (!this.currentFloorRoom.cleared && this.currentFloorRoom.type === "combat") {
      this.spawnTimer -= dt
      if (this.spawnTimer <= 0 && this.enemies.count < 8) {
        this._spawnWave(Math.min(4 + this.run.roomsCleared, 15))
        this.spawnTimer = Math.max(4, 8 - this.run.roomsCleared * 0.4)
      }
    }

    this._checkDoors()
    this.camera.update(dt)
    if (!p.alive) { this.run.essence = computeEssence(this.run); this.state = "dead" }
  }

  private _resolveCombat(dt: number): void {
    const { enemies, projs, particles, camera, run, player: p } = this
    const hash = this.spatialHash
    hash.clear()
    for (let i = 0; i < enemies.count; i++) {
      hash.insert(i, enemies.x[i], enemies.y[i], ENEMY_DEFS[enemies.type[i]].radius)
    }
    const candidates: number[] = []

    // boss hit detection
    if (this.boss.alive && this.boss.state && this.boss.def) {
      let pi2 = 0
      while (pi2 < projs.count) {
        if (projs.fromPlayer[pi2] === 1 &&
            overlaps(projs.x[pi2], projs.y[pi2], projs.radius[pi2], this.boss.state.x, this.boss.state.y, this.boss.def.radius)) {
          const died = this.boss.hurt(projs.dmg[pi2], particles, camera, run)
          this.dmgNums.spawn(this.boss.state.x, this.boss.state.y - 10, projs.dmg[pi2], 255, 240, 80)
          this.hitStop.trigger(0.04)
          projs.remove(pi2)
          if (died) {
            this.currentFloorRoom.cleared = true; run.roomsCleared++
            this.uiItems = pickItems(3, this.rng); this.uiSelected = 0; this.uiState = "treasure"
          }
          continue
        }
        pi2++
      }
    }

    let pi = 0
    while (pi < projs.count) {
      const px = projs.x[pi], py = projs.y[pi], pr = projs.radius[pi]
      if (projs.fromPlayer[pi] === 1) {
        hash.query(px, py, pr + 8, candidates)
        const seen = new Set<number>()
        let hit = false
        for (const ei of candidates) {
          if (seen.has(ei) || ei >= enemies.count) continue
          seen.add(ei)
          if (!overlaps(px, py, pr, enemies.x[ei], enemies.y[ei], ENEMY_DEFS[enemies.type[ei]].radius)) continue
          const dmg = projs.dmg[pi]
          enemies.hp[ei] -= dmg
          this.dmgNums.spawn(enemies.x[ei], enemies.y[ei], dmg)
          particles.burst(px, py, 5, projs.r[pi], projs.g[pi], projs.b[pi], 55, 0.25, 1.5)
          this.hitStop.trigger(0.025)
          if (projs.pierce[pi] > 0) { projs.pierce[pi]--; } else { hit = true; break }
        }
        if (hit) { projs.remove(pi); continue }
      } else {
        if (p.invuln <= 0 && overlaps(px, py, pr, p.x, p.y, p.radius)) {
          p.hp -= projs.dmg[pi]; p.invuln = 0.5; run.damageTaken += projs.dmg[pi]
          particles.burst(p.x, p.y, 8, 255, 50, 50, 70, 0.4, 2)
          camera.shake(6, 0.18); this.hitStop.trigger(0.05)
          projs.remove(pi); continue
        }
      }
      pi++
    }

    if (p.invuln <= 0) {
      for (let ei = 0; ei < enemies.count; ei++) {
        const def = ENEMY_DEFS[enemies.type[ei]]
        if (overlaps(enemies.x[ei], enemies.y[ei], def.radius+2, p.x, p.y, p.radius)) {
          p.hp -= def.dmg * dt * 3.5; p.invuln = 0.4; run.damageTaken += def.dmg*dt*3.5
          particles.burst(p.x, p.y, 5, 255, 60, 60, 60, 0.3, 1.5); camera.shake(4, 0.1)
        }
      }
    }
    if (p.hp <= 0) { p.hp = 0; p.alive = false }

    let ei = 0
    while (ei < enemies.count) {
      if (enemies.hp[ei] <= 0) {
        const def = ENEMY_DEFS[enemies.type[ei]]
        particles.burst(enemies.x[ei], enemies.y[ei], 16, def.r, def.g, def.b, 90, 0.65, 2.5)
        camera.shake(3, 0.08); run.kills++; run.gold += 1 + (enemies.type[ei]===2?3:0)
        this.status.clear(ei); enemies.remove(ei)
      } else ei++
    }
  }

  draw(canvas: PixelCanvas, buffer: OptimizedBuffer, cW: number, cH: number): void {
    if (!this.scratch || this.scratch.length < canvas.data.length)
      this.scratch = new Float32Array(canvas.data.length)

    this.camera.follow(this.player.x, this.player.y, canvas.width, canvas.height)
    canvas.clear(C.bg.r, C.bg.g, C.bg.b)

    // Transition flash
    if (this.state === "transition") {
      const flashAlpha = 1 - this.transTimer / 0.3
      canvas.fillRect(0, 0, canvas.width - 1, canvas.height - 1,
                      (flashAlpha * 30) | 0, (flashAlpha * 40) | 0, (flashAlpha * 80) | 0)
      canvas.blit(buffer, 0, 0)
      return
    }

    drawRoom(canvas, this.currentRoom, this.camera)
    this.particles.draw(canvas, this.camera.x + this.camera.shakeX, this.camera.y + this.camera.shakeY)
    drawEnemies(canvas, this.enemies, this.camera)
    drawProjectiles(canvas, this.projs, this.camera)
    drawPlayer(canvas, this.player, this.camera, this.t)
    this.boss.draw(canvas, this.camera.x + this.camera.shakeX, this.camera.y + this.camera.shakeY, this.t)
    canvas.bloom(0.55, 2, this.scratch)
    canvas.blit(buffer, 0, 0)

    const camX = this.camera.x + this.camera.shakeX, camY = this.camera.y + this.camera.shakeY
    this.dmgNums.draw(buffer, camX, camY, ROOM_SCALE)
    drawMinimap(buffer, this.floor, this.currentFloorRoom.id, cW, cH)
    // Boss name + HP bar
    if (this.boss.alive) {
      const bname = this.boss.currentName
      const bx = ((cW - bname.length) / 2) | 0
      buffer.drawText(bname, bx, 0, RGBA.fromInts(255, 80, 80))
      const bbarW = Math.min(40, cW - 4)
      const bfilled = Math.round(this.boss.hpRatio * bbarW)
      for (let bi = 0; bi < bbarW; bi++) {
        buffer.drawText(bi < bfilled ? "█" : "░", ((cW - bbarW) / 2 | 0) + bi, 1,
                        bi < bfilled ? RGBA.fromInts(255,60,60) : RGBA.fromInts(60,30,30))
      }
    }
    drawHud(buffer, this.player, this.run, this.fps, cW, cH)
    if (this.uiState === "treasure") drawItemRoom(buffer, this.uiItems, this.uiSelected, cW, cH, this.run.gold)
    if (this.uiState === "shop") drawShopRoom(buffer, this.uiItems, this.uiPrices, this.uiSelected, cW, cH, this.run.gold)
    if (this.state === "dead") drawDeathScreen(buffer, this.run, this.run.kills, cW, cH)
    if (this.paused) drawPauseScreen(buffer, cW, cH)
  }

  handleKey(name: string, isRestart: boolean): boolean {
    if (this.state === "dead" && isRestart) { this.onEnter(); return true }
    return false
  }
}

function isWalkableTile(room: RoomDef, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= room.width || ty >= room.height) return false
  return room.tiles[ty * room.width + tx] !== 2
}

function tileDistToPlayer(tx: number, ty: number, player: Player, scale: number): number {
  const dx = tx * scale - player.x, dy = ty * scale - player.y
  return Math.sqrt(dx * dx + dy * dy) / scale
}
