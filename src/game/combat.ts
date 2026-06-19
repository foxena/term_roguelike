import type { Player, EnemyPool, ProjectilePool } from "./entities.ts"
import type { Particles } from "../engine/particles.ts"
import type { Camera } from "../engine/camera.ts"
import { ENEMY_DEFS } from "./entities.ts"
import type { RunStats } from "./progression/run.ts"

/** Circle-circle overlap test. */
export function overlaps(ax: number, ay: number, ar: number, bx: number, by: number, br: number): boolean {
  const dx = ax - bx, dy = ay - by
  const rsum = ar + br
  return dx * dx + dy * dy < rsum * rsum
}

/** Projectile vs enemy + enemy vs player hit detection — run once per frame. */
export function resolveCombat(
  player: Player,
  enemies: EnemyPool,
  projs: ProjectilePool,
  particles: Particles,
  camera: Camera,
  run: RunStats,
  dt: number,
): void {
  // --- projectile vs enemies & player ---
  let pi = 0
  while (pi < projs.count) {
    const px = projs.x[pi], py = projs.y[pi]
    const fromPlayer = projs.fromPlayer[pi] === 1

    if (fromPlayer) {
      let hit = false
      for (let ei = 0; ei < enemies.count; ei++) {
        if (!overlaps(px, py, projs.radius[pi], enemies.x[ei], enemies.y[ei], ENEMY_DEFS[enemies.type[ei]].radius)) continue
        enemies.hp[ei] -= projs.dmg[pi]
        particles.burst(px, py, 6, projs.r[pi], projs.g[pi], projs.b[pi], 60, 0.3, 1.5)
        if (projs.pierce[pi] > 0) { projs.pierce[pi]--; } else { hit = true; break }
      }
      if (hit) { projs.remove(pi); continue }
    } else {
      if (player.invuln <= 0 && overlaps(px, py, projs.radius[pi], player.x, player.y, player.radius)) {
        hurtPlayer(player, projs.dmg[pi], particles, camera, run)
        projs.remove(pi); continue
      }
    }
    pi++
  }

  // --- enemy melee vs player ---
  for (let ei = 0; ei < enemies.count; ei++) {
    if (player.invuln > 0) break
    if (overlaps(enemies.x[ei], enemies.y[ei], ENEMY_DEFS[enemies.type[ei]].radius + 1, player.x, player.y, player.radius)) {
      hurtPlayer(player, ENEMY_DEFS[enemies.type[ei]].dmg * dt * 4, particles, camera, run)
    }
  }

  // --- check dead enemies ---
  let ei = 0
  while (ei < enemies.count) {
    if (enemies.hp[ei] <= 0) {
      const def = ENEMY_DEFS[enemies.type[ei]]
      particles.burst(enemies.x[ei], enemies.y[ei], 14, def.r, def.g, def.b, 80, 0.6, 2)
      camera.shake(4, 0.1)
      run.kills++
      run.gold += 1 + (enemies.type[ei] === 2 ? 3 : 0)
      enemies.remove(ei)
    } else {
      ei++
    }
  }

  player.invuln = Math.max(0, player.invuln - dt)
  player.abilityCd = Math.max(0, player.abilityCd - dt)
}

function hurtPlayer(player: Player, dmg: number, particles: Particles, camera: Camera, run: RunStats): void {
  player.hp -= dmg
  player.invuln = 0.5
  run.damageTaken += dmg
  particles.burst(player.x, player.y, 8, 255, 50, 50, 70, 0.4, 2)
  camera.shake(6, 0.18)
  if (player.hp <= 0) { player.hp = 0; player.alive = false }
}

/** Warrior-style melee arc: damage all enemies within `range` pixels & `halfArc` radians of `aimAngle`. */
export function meleeArc(
  player: Player, enemies: EnemyPool, projs: ProjectilePool,
  dmg: number, range: number, aimAngle: number, halfArc: number,
  pR: number, pG: number, pB: number,
  particles: Particles, camera: Camera, run: RunStats,
): void {
  for (let ei = 0; ei < enemies.count; ei++) {
    const dx = enemies.x[ei] - player.x
    const dy = enemies.y[ei] - player.y
    const dist = Math.sqrt(dx*dx+dy*dy)
    if (dist > range) continue
    const angle = Math.atan2(dy, dx)
    let diff = angle - aimAngle
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    if (Math.abs(diff) > halfArc) continue
    enemies.hp[ei] -= dmg
    particles.burst(enemies.x[ei], enemies.y[ei], 5, pR, pG, pB, 50, 0.25, 1.5)
    camera.shake(3, 0.08)
  }
}
