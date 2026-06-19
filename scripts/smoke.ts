// Headless simulation test: exercises the world without a terminal.
import { World, MAP_W, MAP_H } from "../src/world/world.ts"

const world = new World(12345)
console.log(`map ${MAP_W}x${MAP_H}, opening enemies: ${world.count}, player @ ${world.player.x},${world.player.y}`)

const dt = 1 / 60
let frames = 0
let peakEnemies = 0
let maxFrameMs = 0

// Simulate 60 seconds of play, jittering the player around and cleaving.
const simSeconds = 60
const totalFrames = simSeconds * 60
const t0 = performance.now()

for (let f = 0; f < totalFrames; f++) {
  // Wander: change direction a few times a second.
  if (f % 12 === 0) {
    const dx = (Math.floor(Math.random() * 3) - 1)
    const dy = (Math.floor(Math.random() * 3) - 1)
    world.requestMove(dx, dy)
  }
  if (f % 50 === 0) world.cleave()

  const s = performance.now()
  world.update(dt)
  maxFrameMs = Math.max(maxFrameMs, performance.now() - s)

  peakEnemies = Math.max(peakEnemies, world.count)
  frames++

  if (world.state === "dead") {
    console.log(`died at frame ${f} (t=${world.time.toFixed(1)}s)`)
    break
  }
}

const wall = performance.now() - t0

// Verify invariants: every live enemy is on a floor tile and within bounds.
let badTiles = 0
for (let i = 0; i < world.count; i++) {
  const x = world.ex[i]
  const y = world.ey[i]
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H || world.map.tiles[y * MAP_W + x] === 0) badTiles++
}

console.log("---")
console.log(`frames simulated : ${frames}`)
console.log(`wall time        : ${wall.toFixed(0)}ms (${(wall / frames).toFixed(3)}ms/frame avg)`)
console.log(`worst frame      : ${maxFrameMs.toFixed(3)}ms`)
console.log(`peak enemies     : ${peakEnemies}`)
console.log(`final enemies    : ${world.count}`)
console.log(`kills            : ${world.kills}`)
console.log(`wave reached      : ${world.wave}`)
console.log(`player hp        : ${world.player.hp}/${world.player.maxHp}`)
console.log(`enemies off floor: ${badTiles} (must be 0)`)
console.log(badTiles === 0 ? "OK ✓" : "FAIL ✗")
