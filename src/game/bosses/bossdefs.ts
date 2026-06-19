import type { Player, EnemyPool, ProjectilePool } from "../entities.ts"
import type { Particles } from "../../engine/particles.ts"
import type { Camera } from "../../engine/camera.ts"
import type { RNG } from "../../engine/rng.ts"

export interface BossAttack {
  name: string
  cooldown: number
  execute(boss: BossState, player: Player, projs: ProjectilePool, particles: Particles, camera: Camera, rng: RNG): void
}

export interface BossDef {
  id: string
  name: string
  hp: number
  radius: number
  speed: number
  phase2Threshold: number  // HP% to trigger phase 2
  r: number; g: number; b: number
  attacks: BossAttack[]
  phase2Attacks: BossAttack[]
  reward: { essence: number; gold: number }
}

export interface BossState {
  x: number; y: number
  vx: number; vy: number
  hp: number; maxHp: number
  phase: 1 | 2
  attackTimers: number[]   // cooldown remaining per attack slot
  alive: boolean
  stunT: number
  t: number                // time alive
  flashT: number           // hit flash seconds remaining
}

export function makeBossState(def: BossDef, x: number, y: number): BossState {
  return {
    x, y, vx: 0, vy: 0,
    hp: def.hp, maxHp: def.hp,
    phase: 1,
    attackTimers: def.attacks.map(a => a.cooldown * Math.random()),
    alive: true, stunT: 0, t: 0, flashT: 0,
  }
}

// ---- Shared attack helpers ------------------------------------------------

function ring(boss: BossState, projs: ProjectilePool, n: number, speed: number,
              dmg: number, life: number, r: number, g: number, b: number, offset = 0): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + offset
    projs.spawn(boss.x, boss.y, Math.cos(a)*speed, Math.sin(a)*speed, dmg, life, r, g, b, 4, 0, false)
  }
}

function burst(boss: BossState, projs: ProjectilePool, particles: Particles, camera: Camera,
               n: number, speed: number, dmg: number, r: number, g: number, b: number): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    projs.spawn(boss.x, boss.y, Math.cos(a)*speed*(0.7+Math.random()*0.6), Math.sin(a)*speed*(0.7+Math.random()*0.6),
                dmg, 2.5, r, g, b, 3, 0, false)
  }
  particles.burst(boss.x, boss.y, 12, r, g, b, 80, 0.5, 2.5)
  camera.shake(5, 0.15)
}

function aim(boss: BossState, player: Player, projs: ProjectilePool,
             count: number, speed: number, spread: number, dmg: number, life: number,
             r: number, g: number, b: number): void {
  const dx = player.x - boss.x, dy = player.y - boss.y
  const base = Math.atan2(dy, dx)
  for (let i = 0; i < count; i++) {
    const a = base + (i - (count-1)/2) * spread
    projs.spawn(boss.x, boss.y, Math.cos(a)*speed, Math.sin(a)*speed, dmg, life, r, g, b, 3, 0, false)
  }
}

// ---- Boss definitions -------------------------------------------------------

export const BOSS_DEFS: BossDef[] = [
  // Floor 1 boss: The Surge — glowing pink orb with homing bullets
  {
    id: "surge", name: "THE SURGE", hp: 120, radius: 10, speed: 40,
    phase2Threshold: 0.5, r: 255, g: 60, b: 160,
    attacks: [
      { name: "ring",    cooldown: 2.2, execute: (b,_,p,parts,cam,rng) => { ring(b,p,12,90,8,2.2,255,60,160); cam.shake(3,0.1) } },
      { name: "aimed",   cooldown: 1.5, execute: (b,pl,p,parts,cam,rng) => aim(b,pl,p,3,110,0.35,10,2,255,60,160) },
    ],
    phase2Attacks: [
      { name: "bigring", cooldown: 1.8, execute: (b,_,p,parts,cam,rng) => { ring(b,p,20,110,10,2.5,255,100,200); ring(b,p,10,70,8,3,200,40,120,Math.PI/20); cam.shake(4,0.12) } },
      { name: "spiral",  cooldown: 0.25, execute: (b,_,p,parts,cam,rng) => { const a=b.t*3; projs_spawn_helper(b,p,a,120,10,2.5,255,60,160) } },
    ],
    reward: { essence: 30, gold: 15 },
  },
  // Floor 2 boss: The Warden — cyan tank with sweep beam
  {
    id: "warden", name: "THE WARDEN", hp: 200, radius: 14, speed: 28,
    phase2Threshold: 0.45, r: 60, g: 200, b: 255,
    attacks: [
      { name: "sweep",  cooldown: 2.8, execute: (b,pl,p,parts,cam,rng) => {
          for(let i=0;i<5;i++){
            const a=Math.atan2(pl.y-b.y,pl.x-b.x)+(i-2)*0.18
            p.spawn(b.x,b.y,Math.cos(a)*130,Math.sin(a)*130,14,2.2,60,200,255,4,0,false)
          }
          cam.shake(4,0.12)
        }
      },
      { name: "burst",  cooldown: 3.5, execute: (b,_,p,parts,cam,rng) => burst(b,p,parts,cam,16,100,12,60,200,255) },
    ],
    phase2Attacks: [
      { name: "ring2",  cooldown: 1.4, execute: (b,_,p,parts,cam,rng) => { ring(b,p,24,120,14,2.8,60,200,255); cam.shake(5,0.15) } },
      { name: "aimed2", cooldown: 1.0, execute: (b,pl,p,parts,cam,rng) => aim(b,pl,p,5,140,0.28,14,2.2,60,200,255) },
    ],
    reward: { essence: 55, gold: 25 },
  },
  // Floor 3+ boss: The Rift — purple void with teleport & spiral
  {
    id: "rift", name: "THE RIFT", hp: 300, radius: 12, speed: 55,
    phase2Threshold: 0.4, r: 180, g: 60, b: 255,
    attacks: [
      { name: "void",   cooldown: 1.8, execute: (b,_,p,parts,cam,rng) => { ring(b,p,16,95,12,2.5,180,60,255); ring(b,p,8,60,10,3,100,30,200,Math.PI/16) } },
      { name: "aimed",  cooldown: 1.2, execute: (b,pl,p,parts,cam,rng) => aim(b,pl,p,4,140,0.25,15,2,180,60,255) },
    ],
    phase2Attacks: [
      { name: "void2",  cooldown: 1.0, execute: (b,_,p,parts,cam,rng) => { ring(b,p,32,110,14,3,180,60,255); ring(b,p,16,75,12,3.5,120,40,220,Math.PI/32); cam.shake(6,0.2) } },
      { name: "teleport",cooldown:4.0, execute:(b,pl,p,parts,cam,rng)=>{
          parts.burst(b.x,b.y,20,180,60,255,80,0.5,2.5)
          b.x = pl.x + (rng.next()-0.5)*80; b.y = pl.y + (rng.next()-0.5)*80
          parts.burst(b.x,b.y,20,180,60,255,80,0.5,2.5); cam.shake(7,0.2)
        }
      },
    ],
    reward: { essence: 80, gold: 40 },
  },
]

// helper because closures in attack definitions can't import projs.spawn directly
function projs_spawn_helper(boss: BossState, projs: ProjectilePool, angle: number,
                             speed: number, dmg: number, life: number, r: number, g: number, b: number): void {
  projs.spawn(boss.x, boss.y, Math.cos(angle)*speed, Math.sin(angle)*speed, dmg, life, r, g, b, 3, 0, false)
}
