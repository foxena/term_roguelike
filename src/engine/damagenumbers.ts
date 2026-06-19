import type { OptimizedBuffer } from "@opentui/core"
import { RGBA } from "@opentui/core"

interface DmgNum { x: number; y: number; vy: number; value: string; life: number; maxLife: number; r: number; g: number; b: number }

export class DamageNumbers {
  private nums: DmgNum[] = []

  spawn(wx: number, wy: number, value: number, r = 255, g = 80, b = 80): void {
    this.nums.push({ x: wx, y: wy, vy: -22, value: Math.ceil(value).toString(),
                     life: 0.9, maxLife: 0.9, r, g, b })
  }

  update(dt: number): void {
    let i = 0
    while (i < this.nums.length) {
      const n = this.nums[i]
      n.y  += n.vy * dt
      n.vy *= 1 - dt * 3
      n.life -= dt
      if (n.life <= 0) this.nums.splice(i, 1); else i++
    }
  }

  /** Draw in cell-space on top of the pixel layer. */
  draw(buffer: OptimizedBuffer, camX: number, camY: number, cellScale: number): void {
    for (const n of this.nums) {
      const t = n.life / n.maxLife
      const alpha = Math.round(t * 255)
      const cx = ((n.x - camX) / (cellScale * 2)) | 0
      const cy = ((n.y - camY) / (cellScale * 2)) | 0
      if (cx < 0 || cy < 0) continue
      buffer.drawText(n.value, cx, cy, RGBA.fromInts(n.r, n.g, n.b, alpha))
    }
  }
}
