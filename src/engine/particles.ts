import type { PixelCanvas } from "./pixelcanvas.ts"

const MAX = 2000

/** Struct-of-arrays pooled particle system. */
export class Particles {
  private x   = new Float32Array(MAX)
  private y   = new Float32Array(MAX)
  private vx  = new Float32Array(MAX)
  private vy  = new Float32Array(MAX)
  private r   = new Float32Array(MAX)
  private g   = new Float32Array(MAX)
  private b   = new Float32Array(MAX)
  private life = new Float32Array(MAX)  // remaining seconds
  private maxL = new Float32Array(MAX)  // starting life
  private size = new Float32Array(MAX)  // glow radius in pixels
  count = 0

  emit(x: number, y: number, vx: number, vy: number, r: number, g: number, b: number, life: number, size = 1.5): void {
    if (this.count >= MAX) return
    const i = this.count++
    this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy
    this.r[i] = r; this.g[i] = g; this.b[i] = b
    this.life[i] = life; this.maxL[i] = life; this.size[i] = size
  }

  burst(x: number, y: number, n: number, r: number, g: number, b: number, speed = 40, life = 0.5, size = 1.5): void {
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2
      const s = speed * (0.4 + Math.random() * 0.6)
      this.emit(x, y, Math.cos(angle) * s, Math.sin(angle) * s, r, g, b, life * (0.5 + Math.random() * 0.5), size)
    }
  }

  stream(x: number, y: number, angle: number, spread: number, n: number, r: number, g: number, b: number, speed = 30, life = 0.3): void {
    for (let i = 0; i < n; i++) {
      const a = angle + (Math.random() - 0.5) * spread
      const s = speed * (0.7 + Math.random() * 0.3)
      this.emit(x, y, Math.cos(a) * s, Math.sin(a) * s, r, g, b, life)
    }
  }

  update(dt: number): void {
    let i = 0
    while (i < this.count) {
      this.life[i] -= dt
      if (this.life[i] <= 0) {
        // swap-remove
        const last = this.count - 1
        this.x[i] = this.x[last]; this.y[i] = this.y[last]
        this.vx[i] = this.vx[last]; this.vy[i] = this.vy[last]
        this.r[i] = this.r[last]; this.g[i] = this.g[last]; this.b[i] = this.b[last]
        this.life[i] = this.life[last]; this.maxL[i] = this.maxL[last]; this.size[i] = this.size[last]
        this.count--
      } else {
        this.x[i] += this.vx[i] * dt
        this.y[i] += this.vy[i] * dt
        // drag
        this.vx[i] *= 1 - dt * 3
        this.vy[i] *= 1 - dt * 3
        i++
      }
    }
  }

  draw(canvas: PixelCanvas, camX: number, camY: number): void {
    for (let i = 0; i < this.count; i++) {
      const t = this.life[i] / this.maxL[i]
      const k = t * t   // quadratic fade
      const px = this.x[i] - camX
      const py = this.y[i] - camY
      const sz = this.size[i]
      if (sz <= 1) {
        canvas.addPixel(px | 0, py | 0, this.r[i] * k, this.g[i] * k, this.b[i] * k)
      } else {
        canvas.addGlow(px, py, sz, this.r[i], this.g[i], this.b[i], k * 0.7, 1.5)
      }
    }
  }
}
