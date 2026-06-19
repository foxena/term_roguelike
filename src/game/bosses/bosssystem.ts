import type { Player, ProjectilePool } from "../entities.ts"
import type { Particles } from "../../engine/particles.ts"
import type { Camera } from "../../engine/camera.ts"
import type { RNG } from "../../engine/rng.ts"
import { BOSS_DEFS, makeBossState, type BossDef, type BossState } from "./bossdefs.ts"
import type { PixelCanvas } from "../../engine/pixelcanvas.ts"
import { overlaps } from "../combat.ts"
import type { RunStats } from "../progression/run.ts"
import { DX8, DY8 } from "../../engine/flowfield.ts"

export class BossSystem {
  def: BossDef | null = null
  state: BossState | null = null

  spawn(floorNum: number, x: number, y: number): void {
    const defIdx = Math.min(floorNum - 1, BOSS_DEFS.length - 1)
    this.def = BOSS_DEFS[defIdx]
    this.state = makeBossState(this.def, x, y)
  }

  get alive(): boolean { return this.state?.alive ?? false }

  update(dt: number, player: Player, projs: ProjectilePool, particles: Particles, camera: Camera, rng: RNG): void {
    if (!this.state || !this.def || !this.state.alive) return
    const b = this.state, d = this.def
    b.t += dt
    b.stunT = Math.max(0, b.stunT - dt)
    b.flashT = Math.max(0, b.flashT - dt)

    // Phase check
    if (b.phase === 1 && b.hp / b.maxHp <= d.phase2Threshold) {
      b.phase = 2
      particles.burst(b.x, b.y, 30, d.r, d.g, d.b, 100, 0.8, 3)
      camera.shake(8, 0.3)
      b.attackTimers = d.phase2Attacks.map(a => a.cooldown * 0.2)
    }

    // Chase player
    if (b.stunT <= 0) {
      const dx = player.x - b.x, dy = player.y - b.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > 20) {
        const spd = d.speed * (b.phase === 2 ? 1.5 : 1)
        b.vx = (dx / dist) * spd; b.vy = (dy / dist) * spd
      } else {
        b.vx *= 0.8; b.vy *= 0.8
      }
      b.x += b.vx * dt; b.y += b.vy * dt
    }

    // Execute attacks
    const attacks = b.phase === 2 ? d.phase2Attacks : d.attacks
    for (let i = 0; i < attacks.length; i++) {
      b.attackTimers[i] = (b.attackTimers[i] ?? attacks[i].cooldown) - dt
      if (b.attackTimers[i] <= 0) {
        attacks[i].execute(b, player, projs, particles, camera, rng)
        b.attackTimers[i] = attacks[i].cooldown * (b.phase === 2 ? 0.75 : 1)
      }
    }

    // Ambient glow particles
    if (Math.random() < 0.4) {
      const a = Math.random() * Math.PI * 2
      const r = d.radius * (0.8 + Math.random() * 0.4)
      particles.emit(b.x + Math.cos(a)*r, b.y + Math.sin(a)*r, 0, 0, d.r, d.g, d.b, 0.2, 1.5)
    }

    // Melee player contact
    if (player.invuln <= 0 && overlaps(b.x, b.y, d.radius + 2, player.x, player.y, player.radius)) {
      player.hp -= 15 * dt * 3
      player.invuln = 0.4
      camera.shake(5, 0.15)
    }
    if (player.hp <= 0) { player.hp = 0; player.alive = false }
  }

  hurt(dmg: number, particles: Particles, camera: Camera, run: RunStats): boolean {
    if (!this.state || !this.def) return false
    this.state.hp -= dmg
    this.state.flashT = 0.1
    particles.burst(this.state.x, this.state.y, 6, 255, 255, 255, 60, 0.2, 1.5)
    if (this.state.hp <= 0) {
      this.state.alive = false
      this.state.hp = 0
      particles.burst(this.state.x, this.state.y, 50, this.def.r, this.def.g, this.def.b, 120, 1.0, 3.5)
      camera.shake(10, 0.4)
      run.gold += this.def.reward.gold
      run.essence += this.def.reward.essence
      run.kills += 5
      return true // boss died
    }
    return false
  }

  draw(canvas: PixelCanvas, camX: number, camY: number, t: number): void {
    if (!this.state || !this.def || !this.state.alive) return
    const b = this.state, d = this.def
    const px = (b.x - camX) | 0, py = (b.y - camY) | 0
    const hpRatio = b.hp / b.maxHp
    const phase2 = b.phase === 2
    const flash = b.flashT > 0

    // Outer glow — pulsing in phase 2
    const glowR = d.radius * (phase2 ? 2.5 + Math.sin(t * 8) * 0.5 : 2)
    const intensity = flash ? 2 : phase2 ? 1.2 : 0.8
    canvas.addGlow(px, py, glowR, d.r, d.g, d.b, intensity)

    // Orbiting runes
    const numRunes = phase2 ? 8 : 4
    for (let i = 0; i < numRunes; i++) {
      const a = t * (phase2 ? 3 : 2) + (i / numRunes) * Math.PI * 2
      const or = d.radius * 1.4
      canvas.addGlow(px + Math.cos(a)*or, py + Math.sin(a)*or, 3, d.r, d.g, d.b, 1.2)
      canvas.addDisc(px + Math.cos(a)*or, py + Math.sin(a)*or, 1, 255, 255, 255)
    }

    // Body
    const bodyColor = flash ? 255 : hpRatio * d.r | 0
    canvas.addDisc(px, py, d.radius, flash ? 255 : d.r, flash ? 255 : d.g, flash ? 255 : d.b)
    canvas.addDisc(px, py, d.radius * 0.5, 255, 255, 255)

    // HP bar
    const bw = d.radius * 3
    const filled = (bw * 2 * hpRatio) | 0
    canvas.addLine(px - (bw|0), py - d.radius - 4, px + (bw|0), py - d.radius - 4, 40, 30, 30)
    if (filled > 0) {
      const hc = hpRatio > 0.5 ? [80,255,100] : hpRatio > 0.25 ? [255,200,80] : [255,60,60]
      canvas.addLine(px - (bw|0), py - d.radius - 4, px - (bw|0) + filled, py - d.radius - 4, hc[0], hc[1], hc[2])
    }
  }

  get currentName(): string {
    if (!this.def || !this.state?.alive) return ""
    const phase = this.state.phase === 2 ? " [ENRAGED]" : ""
    return `⚡ ${this.def.name}${phase} ⚡`
  }
  get hpRatio(): number { return this.state ? this.state.hp / this.state.maxHp : 0 }
}
