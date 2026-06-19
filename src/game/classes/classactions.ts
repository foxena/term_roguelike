import type { Player, EnemyPool, ProjectilePool } from "../entities.ts"
import type { Particles } from "../../engine/particles.ts"
import type { Camera } from "../../engine/camera.ts"
import { meleeArc } from "../combat.ts"
import type { RunStats } from "../progression/run.ts"
import { C } from "../../engine/colors.ts"

// Per-class fire rate trackers (seconds between shots)
const fireCd: Record<string, number> = {}
const FIRE_CD: Record<string, number> = {
  warrior: 0,      // melee — no fire cd
  mage: 0.22,
  archer: 0.1,
  necromancer: 0.3,
  paladin: 0,
  rogue: 0.06,
  druid: 0.28,
}

let _lastT = 0

/** Called every tick when the player is holding an aim direction. */
export function spawnClassProjectile(
  p: Player,
  projs: ProjectilePool,
  particles: Particles,
  t: number,
): void {
  const dt = t - _lastT
  _lastT = t
  const cls = p.class
  const cd = fireCd[cls] ?? 0
  if (cd > 0) { fireCd[cls] = Math.max(0, cd - dt); return }
  fireCd[cls] = FIRE_CD[cls] ?? 0.2

  const spd = 160
  const vx = p.aimX * spd, vy = p.aimY * spd

  switch (cls) {
    case "mage": {
      const col = C.mage
      projs.spawn(p.x, p.y, vx, vy, 8, 1.2, col.r, col.g, col.b, 3, 1)
      particles.stream(p.x, p.y, Math.atan2(p.aimY, p.aimX), 0.3, 3, col.r, col.g, col.b, 40, 0.2)
      break
    }
    case "archer": {
      const col = C.archer
      projs.spawn(p.x, p.y, vx * 1.3, vy * 1.3, 5, 1.5, col.r, col.g, col.b, 1.5, 2)
      particles.stream(p.x, p.y, Math.atan2(p.aimY, p.aimX), 0.1, 2, col.r, col.g, col.b, 60, 0.15)
      break
    }
    case "necromancer": {
      const col = C.necromancer
      projs.spawn(p.x, p.y, vx * 0.7, vy * 0.7, 10, 2, col.r, col.g, col.b, 4, 0)
      particles.stream(p.x, p.y, Math.atan2(p.aimY, p.aimX), 0.4, 4, col.r, col.g, col.b, 30, 0.35)
      break
    }
    case "rogue": {
      const col = C.rogue
      for (let i = -1; i <= 1; i++) {
        const spread = i * 0.15
        const angle = Math.atan2(p.aimY, p.aimX) + spread
        projs.spawn(p.x, p.y, Math.cos(angle)*spd*1.2, Math.sin(angle)*spd*1.2, 4, 0.7, col.r, col.g, col.b, 1.5, 0)
      }
      break
    }
    case "druid": {
      const col = C.druid
      projs.spawn(p.x, p.y, vx * 0.8, vy * 0.8, 7, 1.8, col.r, col.g, col.b, 3.5, 0)
      particles.stream(p.x, p.y, Math.atan2(p.aimY, p.aimX), 0.5, 4, col.r, col.g, col.b, 25, 0.4)
      break
    }
  }
}

/** Called when the player presses Space. */
export function spawnClassAbility(
  p: Player,
  enemies: EnemyPool,
  projs: ProjectilePool,
  particles: Particles,
  camera: Camera,
  t: number,
  run?: RunStats,
): void {
  const angle = Math.atan2(p.aimY, p.aimX)
  switch (p.class) {
    case "warrior": {
      // Whirlwind cleave — full 360 melee
      meleeArc(p, enemies, projs, 18, 40, angle, Math.PI, C.warrior.r, C.warrior.g, C.warrior.b, particles, camera, run ?? { kills:0,gold:0,damageTaken:0,roomsCleared:0,floor:1,essence:0,itemIds:[] })
      particles.burst(p.x, p.y, 16, C.warrior.r, C.warrior.g, C.warrior.b, 80, 0.4, 2)
      camera.shake(5, 0.15)
      p.abilityMaxCd = 1.2
      break
    }
    case "paladin": {
      // Holy nova — burst of radiant projectiles in all directions
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2
        projs.spawn(p.x, p.y, Math.cos(a)*100, Math.sin(a)*100, 12, 1.2, C.paladin.r, C.paladin.g, C.paladin.b, 4, 1)
      }
      particles.burst(p.x, p.y, 20, C.paladin.r, C.paladin.g, C.paladin.b, 90, 0.5, 2.5)
      camera.shake(4, 0.12)
      p.abilityMaxCd = 2.5
      break
    }
    case "mage": {
      // Arcane nova
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        projs.spawn(p.x, p.y, Math.cos(a)*120, Math.sin(a)*120, 14, 1.5, C.mage.r, C.mage.g, C.mage.b, 4, 0)
      }
      particles.burst(p.x, p.y, 18, C.mage.r, C.mage.g, C.mage.b, 80, 0.5, 2)
      p.abilityMaxCd = 2
      break
    }
    case "archer": {
      // Volley — wide spread of 7 arrows
      for (let i = -3; i <= 3; i++) {
        const a = angle + i * 0.22
        projs.spawn(p.x, p.y, Math.cos(a)*190, Math.sin(a)*190, 7, 1.3, C.archer.r, C.archer.g, C.archer.b, 2, 2)
      }
      p.abilityMaxCd = 1.5
      break
    }
    case "necromancer": {
      // Corpse burst — chain rapid bolts
      for (let i = 0; i < 6; i++) {
        const a = angle + (Math.random()-0.5) * 1.2
        projs.spawn(p.x, p.y, Math.cos(a)*110, Math.sin(a)*110, 12, 1.8, C.necromancer.r, C.necromancer.g, C.necromancer.b, 3, 0)
      }
      particles.burst(p.x, p.y, 14, C.necromancer.r, C.necromancer.g, C.necromancer.b, 70, 0.45, 2)
      p.abilityMaxCd = 2
      break
    }
    case "rogue": {
      // Dash + afterimage trail in aim direction, deal burst melee damage
      const dashDist = 48
      const nx = p.x + p.aimX * dashDist, ny = p.y + p.aimY * dashDist
      for (let s = 0; s < 5; s++) {
        const frac = s / 5
        particles.emit(p.x + p.aimX * dashDist * frac, p.y + p.aimY * dashDist * frac,
                       0, 0, C.rogue.r, C.rogue.g, C.rogue.b, 0.3, 3)
      }
      p.x = nx; p.y = ny
      meleeArc(p, enemies, projs, 15, 28, angle, Math.PI * 0.7, C.rogue.r, C.rogue.g, C.rogue.b, particles, camera, run ?? { kills:0,gold:0,damageTaken:0,roomsCleared:0,floor:1,essence:0,itemIds:[] })
      p.invuln = 0.15
      p.abilityMaxCd = 1.0
      break
    }
    case "druid": {
      // Vine whip — slow but AOE
      for (let i = -2; i <= 2; i++) {
        const a = angle + i * 0.3
        projs.spawn(p.x, p.y, Math.cos(a)*90, Math.sin(a)*90, 16, 2, C.druid.r, C.druid.g, C.druid.b, 5, 1)
      }
      particles.burst(p.x, p.y, 12, C.druid.r, C.druid.g, C.druid.b, 60, 0.5, 2.5)
      p.abilityMaxCd = 2.2
      break
    }
  }
}
