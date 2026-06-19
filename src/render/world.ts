import type { PixelCanvas } from "../engine/pixelcanvas.ts"
import type { Camera } from "../engine/camera.ts"
import type { RoomDef } from "../game/room.ts"
import { TILE, ROOM_SCALE } from "../game/room.ts"
import type { Player, EnemyPool, ProjectilePool } from "../game/entities.ts"
import { ENEMY_DEFS } from "../game/entities.ts"
import type { Particles } from "../engine/particles.ts"
import { C } from "../engine/colors.ts"
import { drawClassAmbientVFX } from "../game/classes/classvfx.ts"

const S = ROOM_SCALE

function drawFloorTile(canvas: PixelCanvas, px: number, py: number, lite: boolean): void {
  const b = lite ? C.navyMid : C.bg
  canvas.addGlow(px + S/2, py + S/2, S/2 - 1, b.r, b.g, b.b, 1, 1)
}

/** Draw the room floor tiles and walls into the pixel canvas. */
export function drawRoom(canvas: PixelCanvas, room: RoomDef, cam: Camera): void {
  const { width, height, tiles } = room
  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      const t = tiles[ty * width + tx]
      const wx = tx * S, wy = ty * S
      const px = cam.toPixX(wx), py = cam.toPixY(wy)
      if (px + S < 0 || py + S < 0 || px >= canvas.width || py >= canvas.height) continue

      if (t === TILE.WALL) {
        // wall: glowing neon border
        canvas.fillRect(px, py, px + S - 1, py + S - 1, 12, 16, 36)
        canvas.addGlow(px + S/2, py + S/2, S/2, 40, 60, 120, 0.5)
      } else if (t === TILE.FLOOR) {
        canvas.fillRect(px, py, px + S - 1, py + S - 1, 6, 8, 18)
        // subtle grid lines
        if (tx % 3 === 0) canvas.addLine(px, py, px, py + S - 1, 10, 14, 28)
        if (ty % 3 === 0) canvas.addLine(px, py, px + S - 1, py, 10, 14, 28)
      } else {
        // door — glowing aperture
        canvas.fillRect(px, py, px + S - 1, py + S - 1, 6, 8, 18)
        canvas.addGlow(px + S/2, py + S/2, S/2, C.cyan.r, C.cyan.g, C.cyan.b, 0.4)
      }
    }
  }
}

/** Draw all enemies. */
export function drawEnemies(canvas: PixelCanvas, enemies: EnemyPool, cam: Camera): void {
  for (let i = 0; i < enemies.count; i++) {
    const def = ENEMY_DEFS[enemies.type[i]]
    const px = cam.toPixX(enemies.x[i])
    const py = cam.toPixY(enemies.y[i])
    const hpRatio = enemies.hp[i] / enemies.maxHp[i]
    canvas.addGlow(px, py, def.size * 1.5, def.r, def.g, def.b, 0.6)
    canvas.addDisc(px, py, def.size * 0.6, def.r * hpRatio, def.g * hpRatio, def.b * hpRatio)
    canvas.addDisc(px, py, def.size * 0.3, 255, 255, 255)
    // hp bar above
    const bw = def.size * 2
    const filled = (bw * hpRatio) | 0
    canvas.addLine(px - (bw|0), py - (def.size|0) - 2, px + (bw|0), py - (def.size|0) - 2, 40, 40, 40)
    if (filled > 0) canvas.addLine(px - (bw|0), py - (def.size|0) - 2, px - (bw|0) + filled, py - (def.size|0) - 2, 80, 255, 100)
  }
}

/** Draw all active projectiles. */
export function drawProjectiles(canvas: PixelCanvas, projs: ProjectilePool, cam: Camera): void {
  for (let i = 0; i < projs.count; i++) {
    const px = cam.toPixX(projs.x[i]), py = cam.toPixY(projs.y[i])
    canvas.addGlow(px, py, projs.radius[i] * 1.8, projs.r[i], projs.g[i], projs.b[i], 1)
    canvas.addDisc(px, py, projs.radius[i] * 0.5, 255, 255, 255)
  }
}

/** Draw the player with class-themed VFX (core + ambient). */
export function drawPlayer(canvas: PixelCanvas, player: Player, cam: Camera, t: number, particles?: Particles): void {
  if (particles) drawClassAmbientVFX(canvas, particles, player, cam, t)
  const px = cam.toPixX(player.x), py = cam.toPixY(player.y)
  const flash = player.invuln > 0 && Math.floor(player.invuln * 10) % 2 === 0

  // class palette
  const col = classColor(player.class)
  if (!flash) {
    canvas.addGlow(px, py, 10, col.r, col.g, col.b, 0.7)
    canvas.addDisc(px, py, 4, col.r, col.g, col.b)
    canvas.addDisc(px, py, 2, 255, 255, 255)
    // pulsing orbiting ring
    const orbitR = 7 + Math.sin(t * 4) * 1.5
    const numOrb = player.class === "necromancer" ? 5 : 3
    for (let o = 0; o < numOrb; o++) {
      const a = t * 2.5 + (o / numOrb) * Math.PI * 2
      const ox = px + Math.cos(a) * orbitR
      const oy = py + Math.sin(a) * orbitR
      canvas.addDisc(ox, oy, 1.2, col.r, col.g, col.b)
    }
    // aim indicator line
    const aLen = 12
    canvas.addLine(px, py, (px + player.aimX * aLen) | 0, (py + player.aimY * aLen) | 0,
                   col.r * 0.6 | 0, col.g * 0.6 | 0, col.b * 0.6 | 0)
  } else {
    // hurt flash — white core
    canvas.addGlow(px, py, 8, 255, 100, 100, 0.8)
    canvas.addDisc(px, py, 4, 255, 200, 200)
  }
}

function classColor(cls: string): { r: number; g: number; b: number } {
  switch (cls) {
    case "warrior":     return C.warrior
    case "mage":        return C.mage
    case "archer":      return C.archer
    case "necromancer": return C.necromancer
    case "paladin":     return C.paladin
    case "rogue":       return C.rogue
    case "druid":       return C.druid
    default:            return C.white
  }
}

