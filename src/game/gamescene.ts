import type { PixelCanvas } from "../engine/pixelcanvas.ts"
import type { OptimizedBuffer } from "@opentui/core"
import type { InputState } from "../engine/input.ts"
import type { Scene } from "../engine/scene.ts"
import { Camera } from "../engine/camera.ts"
import { Particles } from "../engine/particles.ts"
import { FlowField } from "../engine/flowfield.ts"
import { RNG } from "../engine/rng.ts"
import { makePlayer, EnemyPool, ProjectilePool, type Player } from "./entities.ts"
import { resolveCombat, meleeArc } from "./combat.ts"
import { buildRoom, ROOM_SCALE, type RoomDef } from "./room.ts"
import { makeRun, computeEssence, type RunStats } from "./progression/run.ts"
import { drawRoom, drawEnemies, drawProjectiles, drawPlayer } from "../render/world.ts"
import { drawHud, drawDeathScreen, drawPauseScreen } from "../render/hud.ts"
import { spawnClassProjectile, spawnClassAbility } from "./classes/classactions.ts"
import { C } from "../engine/colors.ts"

const FLOW_RETICK = 0.25  // seconds between flow-field recomputes
const FIXED_DT = 1 / 60

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
  private t = 0
  private flowTick = 0
  private paused = false
  private state: "playing" | "dead" = "playing"
  private acc = 0
  private scratch: Float32Array | null = null
  private fps = 60

  constructor(private className: string = "warrior") {}

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
    // initial enemy wave
    this._spawnWave(8)
  }

  private _spawnWave(n: number): void {
    const R = this.room
    for (let i = 0; i < n; i++) {
      let tx: number, ty: number, tries = 0
      do {
        tx = this.rng.range(2, R.width - 3)
        ty = this.rng.range(2, R.height - 3)
        tries++
      } while ((!isWalkable(R, tx, ty) || distToPlayer(tx, ty, this.player, ROOM_SCALE) < 5) && tries < 40)
      const type = this.rng.int(3) // chaser / swarmer / brute
      this.enemies.spawn(tx * ROOM_SCALE, ty * ROOM_SCALE, type, this.rng)
    }
  }

  update(dt: number, input: InputState): void {
    if (input.pause && this.state === "playing") this.paused = !this.paused
    if (this.paused) return
    if (this.state === "dead") return

    this.acc += dt
    while (this.acc >= FIXED_DT) {
      this._tick(FIXED_DT, input)
      this.acc -= FIXED_DT
    }
    this.fps = Math.round(1 / Math.max(dt, 0.001))
  }

  private _tick(dt: number, input: InputState): void {
    const p = this.player
    this.t += dt

    // player movement (continuous velocity, wall collision)
    const spd = p.speed
    const mvLen = Math.sqrt(input.moveX**2 + input.moveY**2) || 1
    p.vx = (input.moveX / mvLen) * spd * (input.moveX !== 0 || input.moveY !== 0 ? 1 : 0)
    p.vy = (input.moveY / mvLen) * spd * (input.moveX !== 0 || input.moveY !== 0 ? 1 : 0)

    const S = ROOM_SCALE
    const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt
    const tx = Math.floor(nx / S), ty = Math.floor(ny / S)
    const otx = Math.floor(p.x / S), oty = Math.floor(p.y / S)
    if (isWalkable(this.room, tx, oty)) p.x = nx
    if (isWalkable(this.room, otx, ty)) p.y = ny

    // aim from arrow keys (if held), else use last aim
    if (input.aimX !== 0 || input.aimY !== 0) {
      const al = Math.sqrt(input.aimX**2 + input.aimY**2)
      p.aimX = input.aimX / al; p.aimY = input.aimY / al
    }

    // primary attack from aim keys
    if ((input.aimX !== 0 || input.aimY !== 0) && p.class !== "warrior") {
      spawnClassProjectile(p, this.projs, this.particles, this.t)
    }

    // ability (Space)
    if (input.ability && p.abilityCd <= 0) {
      spawnClassAbility(p, this.enemies, this.projs, this.particles, this.camera, this.t)
      p.abilityCd = p.abilityMaxCd
    }

    // flow field recompute (throttled)
    this.flowTick -= dt
    if (this.flowTick <= 0) {
      this.flow.compute(this.room, Math.floor(p.x / S), Math.floor(p.y / S))
      this.flowTick = FLOW_RETICK
    }

    this.enemies.update(dt, this.flow, this.room, p, this.projs, this.rng)
    this.projs.update(dt, this.room)
    this.particles.update(dt)
    resolveCombat(p, this.enemies, this.projs, this.particles, this.camera, this.run, dt)

    // respawn wave if room empty
    if (this.enemies.count === 0) {
      this.run.roomsCleared++
      this._spawnWave(Math.min(8 + this.run.roomsCleared * 3, 40))
    }

    this.camera.update(dt)
    this.camera.follow(p.x, p.y, 0, 0) // canvas size set in draw

    if (!p.alive) { this.run.essence = computeEssence(this.run); this.state = "dead" }
  }

  draw(canvas: PixelCanvas, buffer: OptimizedBuffer, cW: number, cH: number): void {
    if (!this.scratch || this.scratch.length < canvas.data.length)
      this.scratch = new Float32Array(canvas.data.length)

    const cellH = cH
    const pixH = canvas.height

    this.camera.follow(this.player.x, this.player.y, canvas.width, pixH)

    canvas.clear(C.bg.r, C.bg.g, C.bg.b)
    drawRoom(canvas, this.room, this.camera)
    this.particles.draw(canvas, this.camera.x + this.camera.shakeX, this.camera.y + this.camera.shakeY)
    drawEnemies(canvas, this.enemies, this.camera)
    drawProjectiles(canvas, this.projs, this.camera)
    drawPlayer(canvas, this.player, this.camera, this.t)
    canvas.bloom(0.55, 2, this.scratch)
    canvas.blit(buffer, 0, 0)

    drawHud(buffer, this.player, this.run, this.fps, cW, cellH)
    if (this.state === "dead") drawDeathScreen(buffer, this.run, this.run.kills, cW, cellH)
    if (this.paused) drawPauseScreen(buffer, cW, cellH)
  }

  handleKey(name: string, isRestart: boolean): boolean {
    if (this.state === "dead" && isRestart) { this.onEnter(); return true }
    return false
  }
}

function isWalkable(room: RoomDef, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= room.width || ty >= room.height) return false
  return room.tiles[ty * room.width + tx] !== 2
}

function distToPlayer(tx: number, ty: number, player: Player, scale: number): number {
  const dx = tx * scale - player.x, dy = ty * scale - player.y
  return Math.sqrt(dx*dx + dy*dy) / scale
}
