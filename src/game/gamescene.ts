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
import { buildRoom, ROOM_SCALE, type RoomDef } from "./room.ts"
import { makeRun, computeEssence, type RunStats } from "./progression/run.ts"
import { drawRoom, drawEnemies, drawProjectiles, drawPlayer } from "../render/world.ts"
import { drawHud, drawDeathScreen, drawPauseScreen } from "../render/hud.ts"
import { spawnClassProjectile, spawnClassAbility } from "./classes/classactions.ts"
import { C } from "../engine/colors.ts"

const FIXED_DT = 1 / 60
const FLOW_RETICK = 0.22
const SPAWN_INTERVAL = 4.0  // seconds between wave reinforcements

export class GameScene implements Scene {
  private rng = new RNG()
  private player!: Player
  private enemies = new EnemyPool()
  private projs = new ProjectilePool()
  private particles = new Particles()
  private camera = new Camera()
  private flow!: FlowField
  private room!: RoomDef
  private run: RunStats = makeRun()
  private status = new StatusEffectPool()
  private hitStop = new HitStop()
  private dmgNums = new DamageNumbers()
  private spatialHash = new SpatialHash(20)
  private t = 0
  private flowTick = 0
  private spawnTimer = SPAWN_INTERVAL
  private paused = false
  private state: "playing" | "dead" = "playing"
  private acc = 0
  private scratch: Float32Array | null = null
  private fps = 60
  private waveNum = 0

  constructor(public className: string = "warrior") {}

  onEnter(): void {
    this.rng = new RNG()
    this.room = buildRoom(this.rng, new Set(["N", "S", "E", "W"]))
    const cx = (this.room.width / 2 | 0) * ROOM_SCALE
    const cy = (this.room.height / 2 | 0) * ROOM_SCALE
    this.player = makePlayer(cx, cy, this.className)
    this.flow = new FlowField(this.room.width * this.room.height)
    this.flow.compute(this.room, cx / ROOM_SCALE | 0, cy / ROOM_SCALE | 0)
    this.run = makeRun()
    this.t = 0; this.flowTick = 0; this.paused = false; this.state = "playing"
    this.enemies.count = 0; this.projs.count = 0; this.particles.count = 0
    this.waveNum = 0; this.spawnTimer = 2
    this._spawnWave(8)
  }

  private _spawnWave(n: number): void {
    this.waveNum++
    const R = this.room
    const types = this.waveNum <= 1 ? [0, 1] : this.waveNum <= 3 ? [0, 1, 2] : [0, 1, 2, 3, 4]
    for (let i = 0; i < n; i++) {
      let tx: number, ty: number, tries = 0
      do {
        tx = this.rng.range(2, R.width - 3)
        ty = this.rng.range(2, R.height - 3)
        tries++
      } while ((!isWalkableTile(R, tx, ty) || tileDistToPlayer(tx, ty, this.player, ROOM_SCALE) < 4) && tries < 40)
      const type = this.rng.pick(types)
      this.enemies.spawn(tx * ROOM_SCALE, ty * ROOM_SCALE, type, this.rng)
    }
  }

  update(dt: number, input: InputState): void {
    if (input.pause && this.state === "playing") this.paused = !this.paused
    if (this.paused || this.state === "dead") return
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

    // player movement
    const anyMove = input.moveX !== 0 || input.moveY !== 0
    const mvLen = anyMove ? Math.sqrt(input.moveX ** 2 + input.moveY ** 2) : 1
    const spd = p.speed
    p.vx = anyMove ? (input.moveX / mvLen) * spd : 0
    p.vy = anyMove ? (input.moveY / mvLen) * spd : 0

    const S = ROOM_SCALE
    const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt
    const otx = Math.floor(p.x / S), oty = Math.floor(p.y / S)
    if (isWalkableTile(this.room, Math.floor(nx / S), oty)) p.x = nx
    if (isWalkableTile(this.room, otx, Math.floor(ny / S))) p.y = ny

    // aim
    if (input.aimX !== 0 || input.aimY !== 0) {
      const al = Math.sqrt(input.aimX ** 2 + input.aimY ** 2)
      p.aimX = input.aimX / al; p.aimY = input.aimY / al
    }

    // primary attack
    if ((input.aimX !== 0 || input.aimY !== 0) && p.class !== "warrior" && p.class !== "paladin") {
      spawnClassProjectile(p, this.projs, this.particles, this.t)
    }
    // warrior/paladin: melee auto-attack when aim held
    if ((input.aimX !== 0 || input.aimY !== 0) && (p.class === "warrior" || p.class === "paladin")) {
      if (p.abilityCd <= (p.abilityMaxCd - 0.35)) {
        const angle = Math.atan2(p.aimY, p.aimX)
        const col = p.class === "warrior" ? C.warrior : C.paladin
        meleeArc(p, this.enemies, this.projs, 14, 34, angle, Math.PI * 0.65,
                 col.r, col.g, col.b, this.particles, this.camera, this.run)
        this.hitStop.trigger(0.04)
        // spawn slash VFX
        const vfxAngle = angle + (Math.random() - 0.5) * 0.4
        for (let k = 0; k < 3; k++) {
          const r = 10 + k * 6
          this.particles.emit(
            p.x + Math.cos(vfxAngle) * r, p.y + Math.sin(vfxAngle) * r,
            Math.cos(vfxAngle + Math.PI / 2) * 30, Math.sin(vfxAngle + Math.PI / 2) * 30,
            col.r, col.g, col.b, 0.15, 2
          )
        }
        p.abilityCd = p.abilityMaxCd  // reuse cd as auto-attack rate
      }
    }

    // ability
    if (input.ability && p.abilityCd <= 0) {
      spawnClassAbility(p, this.enemies, this.projs, this.particles, this.camera, this.t, this.run)
      this.hitStop.trigger(0.06)
      p.abilityCd = p.abilityMaxCd
    }

    p.abilityCd = Math.max(0, p.abilityCd - dt)
    p.invuln = Math.max(0, p.invuln - dt)

    // flow field
    this.flowTick -= dt
    if (this.flowTick <= 0) {
      this.flow.compute(this.room, Math.floor(p.x / S), Math.floor(p.y / S))
      this.flowTick = FLOW_RETICK
    }

    // status effects on enemies + enemy update
    for (let i = 0; i < this.enemies.count; i++) {
      const { dmg, speedMult, stunned } = this.status.tick(i, dt)
      if (dmg > 0) {
        this.enemies.hp[i] -= dmg
        this.dmgNums.spawn(this.enemies.x[i], this.enemies.y[i], dmg,
                           this.enemies.type[i] === 0 ? 255 : 200, 120, 50)
      }
      if (stunned) this.enemies.stunT[i] = Math.max(this.enemies.stunT[i], dt + 0.02)
      if (speedMult < 1) {
        this.enemies.vx[i] *= speedMult
        this.enemies.vy[i] *= speedMult
      }
    }

    this.enemies.update(dt, this.flow, this.room, p, this.projs, this.rng)
    this.projs.update(dt, this.room)
    this.particles.update(dt)

    // --- combat resolution (with spatial hash) ---
    this._resolveCombat(dt)

    // wave reinforcements
    this.spawnTimer -= dt
    if (this.spawnTimer <= 0) {
      const n = Math.min(6 + this.waveNum * 2, 30)
      this._spawnWave(n)
      this.spawnTimer = Math.max(3, SPAWN_INTERVAL - this.waveNum * 0.3)
    }

    this.camera.update(dt)
    this.camera.follow(p.x, p.y, 0, 0)

    if (!p.alive) { this.run.essence = computeEssence(this.run); this.state = "dead" }
  }

  private _resolveCombat(dt: number): void {
    const { enemies, projs, particles, camera, run, player: p, status } = this
    const hash = this.spatialHash
    hash.clear()
    for (let i = 0; i < enemies.count; i++) {
      const def = ENEMY_DEFS[enemies.type[i]]
      hash.insert(i, enemies.x[i], enemies.y[i], def.radius)
    }
    const candidates: number[] = []

    // projectiles vs enemies + player
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
          const def = ENEMY_DEFS[enemies.type[ei]]
          if (!overlaps(px, py, pr, enemies.x[ei], enemies.y[ei], def.radius)) continue
          const dmg = projs.dmg[pi]
          enemies.hp[ei] -= dmg
          this.dmgNums.spawn(enemies.x[ei], enemies.y[ei], dmg, 255, 200, 80)
          particles.burst(px, py, 5, projs.r[pi], projs.g[pi], projs.b[pi], 55, 0.25, 1.5)
          this.hitStop.trigger(0.03)
          if (projs.pierce[pi] > 0) { projs.pierce[pi]--; } else { hit = true; break }
        }
        if (hit) { projs.remove(pi); continue }
      } else {
        if (p.invuln <= 0 && overlaps(px, py, pr, p.x, p.y, p.radius)) {
          p.hp -= projs.dmg[pi]
          p.invuln = 0.5
          run.damageTaken += projs.dmg[pi]
          particles.burst(p.x, p.y, 8, 255, 50, 50, 70, 0.4, 2)
          camera.shake(6, 0.18)
          this.hitStop.trigger(0.05)
          projs.remove(pi); continue
        }
      }
      pi++
    }

    // enemy melee vs player
    if (p.invuln <= 0) {
      for (let ei = 0; ei < enemies.count; ei++) {
        const def = ENEMY_DEFS[enemies.type[ei]]
        if (overlaps(enemies.x[ei], enemies.y[ei], def.radius + 2, p.x, p.y, p.radius)) {
          p.hp -= def.dmg * dt * 3.5
          p.invuln = 0.4
          run.damageTaken += def.dmg * dt * 3.5
          particles.burst(p.x, p.y, 5, 255, 60, 60, 60, 0.3, 1.5)
          camera.shake(4, 0.1)
        }
      }
    }
    if (p.hp <= 0) { p.hp = 0; p.alive = false }

    // dead enemies
    let ei = 0
    while (ei < enemies.count) {
      if (enemies.hp[ei] <= 0) {
        const def = ENEMY_DEFS[enemies.type[ei]]
        particles.burst(enemies.x[ei], enemies.y[ei], 16, def.r, def.g, def.b, 90, 0.65, 2.5)
        camera.shake(3, 0.08)
        run.kills++
        run.gold += 1 + (enemies.type[ei] === 2 ? 3 : 0)
        status.clear(ei)
        enemies.remove(ei)
      } else { ei++ }
    }
  }

  draw(canvas: PixelCanvas, buffer: OptimizedBuffer, cW: number, cH: number): void {
    if (!this.scratch || this.scratch.length < canvas.data.length)
      this.scratch = new Float32Array(canvas.data.length)

    this.camera.follow(this.player.x, this.player.y, canvas.width, canvas.height)
    canvas.clear(C.bg.r, C.bg.g, C.bg.b)

    drawRoom(canvas, this.room, this.camera)
    this.particles.draw(canvas, this.camera.x + this.camera.shakeX, this.camera.y + this.camera.shakeY)
    drawEnemies(canvas, this.enemies, this.camera)
    drawProjectiles(canvas, this.projs, this.camera)
    drawPlayer(canvas, this.player, this.camera, this.t)
    canvas.bloom(0.55, 2, this.scratch)
    canvas.blit(buffer, 0, 0)

    // cell-space overlays
    const camX = this.camera.x + this.camera.shakeX
    const camY = this.camera.y + this.camera.shakeY
    this.dmgNums.draw(buffer, camX, camY, ROOM_SCALE)
    drawHud(buffer, this.player, this.run, this.fps, cW, cH)
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
