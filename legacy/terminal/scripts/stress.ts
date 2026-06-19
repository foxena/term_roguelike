// Horde stress test: god-mode player so enemies accumulate to large counts,
// measuring frame time under load. Proves the flow-field approach scales.
import { World, MAP_W } from "../world/world.ts"

const world = new World(777)
// Jump difficulty up so the spawn target is large quickly.
world.time = 600 // -> high wave -> large target population

const dt = 1 / 60
let worst = 0
let sumOver = 0
let samples = 0
let peak = 0

const t0 = performance.now()
for (let f = 0; f < 60 * 30; f++) {
  // God mode: keep the player alive and moving (forces flow-field recompute).
  world.player.hp = world.player.maxHp
  if (f % 8 === 0) world.requestMove(Math.floor(Math.random() * 3) - 1, Math.floor(Math.random() * 3) - 1)
  world.time = 600 // pin difficulty high

  const s = performance.now()
  world.update(dt)
  const ms = performance.now() - s

  peak = Math.max(peak, world.count)
  if (world.count > 300) {
    worst = Math.max(worst, ms)
    sumOver += ms
    samples++
  }
}
const wall = performance.now() - t0

console.log(`peak enemies         : ${peak}`)
console.log(`final enemies        : ${world.count}`)
console.log(`avg frame @ >300 foes: ${samples ? (sumOver / samples).toFixed(3) : "n/a"}ms`)
console.log(`worst frame @ >300   : ${worst.toFixed(3)}ms`)
console.log(`total wall           : ${wall.toFixed(0)}ms for ${60 * 30} frames`)

// Sanity: occupancy has no duplicate-cell collisions among live enemies.
const seen = new Set<number>()
let collisions = 0
for (let i = 0; i < world.count; i++) {
  const key = world.ey[i] * MAP_W + world.ex[i]
  if (seen.has(key)) collisions++
  seen.add(key)
}
console.log(`enemy cell collisions: ${collisions} (must be 0)`)
console.log(collisions === 0 && worst < 5 ? "OK ✓ (well under one 16ms frame)" : "CHECK ✗")
