/**
 * Per-class ambient VFX drawn every frame — orbital particles, rune rings,
 * energy wisps, soul tethers. Each class has a distinct visual personality.
 */
import type { PixelCanvas } from "../../engine/pixelcanvas.ts"
import type { Particles } from "../../engine/particles.ts"
import type { Player } from "../entities.ts"
import { C } from "../../engine/colors.ts"

const TWO_PI = Math.PI * 2

export function drawClassAmbientVFX(
  canvas: PixelCanvas,
  particles: Particles,
  player: Player,
  cam: { toPixX(w:number):number; toPixY(w:number):number },
  t: number,
): void {
  const px = cam.toPixX(player.x)
  const py = cam.toPixY(player.y)

  switch (player.class) {

    case "warrior": {
      // Burning ember ring — orange/red sparks at medium distance, menacing
      if (Math.random() < 0.5) {
        const a = Math.random() * TWO_PI
        const r = 8 + Math.sin(t * 5) * 2
        const wx = player.x + Math.cos(a) * r, wy = player.y + Math.sin(a) * r
        particles.emit(wx, wy, Math.cos(a)*8, Math.sin(a)*8 - 10, C.warrior.r, C.warrior.g*0.5, 0, 0.25, 1)
      }
      // Sword-slash trail glow on canvas
      const slashA = t * 2
      for (let k = 0; k < 3; k++) {
        const sa = slashA + k * 0.7
        const sr = 12 + Math.sin(t*4+k)*3
        canvas.addGlow(px + Math.cos(sa)*sr, py + Math.sin(sa)*sr, 2, C.warrior.r, C.warrior.g*0.6|0, 0, 0.4)
      }
      break
    }

    case "mage": {
      // Crystalline orbiting runes with blue sparkle
      const numRunes = 5
      for (let i = 0; i < numRunes; i++) {
        const a = t * 1.8 + (i / numRunes) * TWO_PI
        const r = 10 + Math.sin(t * 3 + i) * 2
        canvas.addGlow(px + Math.cos(a)*r, py + Math.sin(a)*r, 2.5, C.mage.r, C.mage.g, C.mage.b, 0.8)
        canvas.addDisc(px + Math.cos(a)*r, py + Math.sin(a)*r, 0.8, 200, 230, 255)
      }
      // Mana shimmer particles
      if (Math.random() < 0.35) {
        const a2 = Math.random() * TWO_PI
        particles.emit(player.x + Math.cos(a2)*6, player.y + Math.sin(a2)*6,
                       (Math.random()-0.5)*15, -10 - Math.random()*15,
                       C.mage.r, C.mage.g, C.mage.b, 0.3, 1.2)
      }
      break
    }

    case "archer": {
      // Aimed energy arrow trailing — teal/green streak in aim direction
      const aimAngle = Math.atan2(player.aimY, player.aimX)
      for (let k = 0; k < 4; k++) {
        const dist = 6 + k * 4
        const jitter = (Math.random() - 0.5) * 2
        canvas.addGlow(px + Math.cos(aimAngle)*dist + jitter, py + Math.sin(aimAngle)*dist + jitter,
                       1.5, C.archer.r, C.archer.g, C.archer.b, 0.5 - k * 0.1)
      }
      // Occasional leaf/wind particle
      if (Math.random() < 0.25) {
        const a3 = Math.random() * TWO_PI
        particles.emit(player.x + Math.cos(a3)*5, player.y + Math.sin(a3)*5,
                       Math.cos(aimAngle)*20 + (Math.random()-0.5)*10, Math.sin(aimAngle)*20 + (Math.random()-0.5)*10,
                       C.archer.r, C.archer.g, C.archer.b, 0.2, 1)
      }
      break
    }

    case "necromancer": {
      // Soul wisps circling at varying radii, drifting upward
      const numWisps = 6
      for (let i = 0; i < numWisps; i++) {
        const a = t * (1.2 + i * 0.1) + (i / numWisps) * TWO_PI
        const r = 9 + Math.sin(t * 2 + i * 1.3) * 3
        canvas.addGlow(px + Math.cos(a)*r, py + Math.sin(a)*r - 2, 2, C.necromancer.r, C.necromancer.g, C.necromancer.b, 0.7)
      }
      // Rising soul particles
      if (Math.random() < 0.45) {
        particles.emit(player.x + (Math.random()-0.5)*12, player.y,
                       (Math.random()-0.5)*8, -18 - Math.random()*12,
                       C.necromancer.r, C.necromancer.g, C.necromancer.b, 0.5, 1.5)
      }
      break
    }

    case "paladin": {
      // Holy aura — expanding golden rings
      const ringPhase = (t * 0.8) % 1
      canvas.addGlow(px, py, 10 + ringPhase * 8, C.paladin.r, C.paladin.g, C.paladin.b, (1-ringPhase) * 0.5)
      const innerPhase = ((t * 0.8) + 0.5) % 1
      canvas.addGlow(px, py, 10 + innerPhase * 8, C.paladin.r, C.paladin.g, C.paladin.b, (1-innerPhase) * 0.4)
      // Cross rays at cardinal directions
      for (let dir = 0; dir < 4; dir++) {
        const da = dir * Math.PI / 2
        const rayLen = 12 + Math.sin(t * 3 + dir) * 3
        canvas.addLine(px, py, (px + Math.cos(da)*rayLen)|0, (py + Math.sin(da)*rayLen)|0,
                       C.paladin.r, C.paladin.g*0.8|0, C.paladin.b*0.3|0)
      }
      // Gold sparkle
      if (Math.random() < 0.3) {
        const a = Math.random() * TWO_PI
        particles.emit(player.x + Math.cos(a)*10, player.y + Math.sin(a)*10,
                       0, -20 - Math.random()*10, C.paladin.r, C.paladin.g, C.paladin.b, 0.35, 1.5)
      }
      break
    }

    case "rogue": {
      // After-image shadows offset in opposite aim direction
      for (let k = 1; k <= 3; k++) {
        const fade = 0.3 - k * 0.08
        canvas.addGlow(px - player.aimX * k * 5, py - player.aimY * k * 5, 3, C.rogue.r, C.rogue.g, C.rogue.b, fade)
      }
      // Knife spark at aim tip
      const tipX = px + player.aimX * 10, tipY = py + player.aimY * 10
      canvas.addGlow(tipX, tipY, 1.5, C.rogue.r, C.rogue.g, C.rogue.b, 0.8)
      // Dark purple sparks
      if (Math.random() < 0.35) {
        const a = Math.random() * TWO_PI
        particles.emit(player.x + Math.cos(a)*4, player.y + Math.sin(a)*4,
                       Math.cos(a)*12, Math.sin(a)*12, C.rogue.r, C.rogue.g, C.rogue.b, 0.18, 1)
      }
      break
    }

    case "druid": {
      // Organic vine tendrils spiraling outward
      const numVines = 4
      for (let i = 0; i < numVines; i++) {
        const baseA = t * 0.8 + (i / numVines) * TWO_PI
        for (let s = 0; s < 4; s++) {
          const r = 4 + s * 3
          const wobble = Math.sin(t * 4 + i + s) * 0.4
          const a = baseA + wobble
          canvas.addGlow(px + Math.cos(a)*r, py + Math.sin(a)*r, 1.5, C.druid.r, C.druid.g, C.druid.b, 0.6-s*0.1)
        }
      }
      // Leaf burst particles
      if (Math.random() < 0.3) {
        const a = Math.random() * TWO_PI
        const spd = 10 + Math.random() * 15
        particles.emit(player.x + Math.cos(a)*8, player.y + Math.sin(a)*8,
                       Math.cos(a)*spd, Math.sin(a)*spd - 5, C.druid.r, C.druid.g, C.druid.b, 0.4, 1.5)
      }
      break
    }
  }
}
