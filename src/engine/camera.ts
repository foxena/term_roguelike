/** Maps world-space floats → canvas pixel coordinates. */
export class Camera {
  x = 0    // world position of the top-left pixel
  y = 0
  shakeX = 0
  shakeY = 0
  private shakeAmt = 0
  private shakeDur = 0

  follow(wx: number, wy: number, canvasW: number, canvasH: number, lerp = 0.12): void {
    const tx = wx - canvasW / 2
    const ty = wy - canvasH / 2
    this.x += (tx - this.x) * lerp
    this.y += (ty - this.y) * lerp
  }

  snap(wx: number, wy: number, canvasW: number, canvasH: number): void {
    this.x = wx - canvasW / 2
    this.y = wy - canvasH / 2
  }

  shake(amount: number, durationSec: number): void {
    if (amount > this.shakeAmt) {
      this.shakeAmt = amount
      this.shakeDur = durationSec
    }
  }

  update(dt: number): void {
    if (this.shakeDur > 0) {
      this.shakeDur -= dt
      const s = this.shakeAmt * (this.shakeDur > 0 ? 1 : 0)
      this.shakeX = (Math.random() - 0.5) * 2 * s
      this.shakeY = (Math.random() - 0.5) * 2 * s
      if (this.shakeDur <= 0) { this.shakeAmt = 0; this.shakeX = 0; this.shakeY = 0 }
    }
  }

  /** Convert world x to canvas pixel x. */
  toPixX(wx: number): number { return (wx - this.x + this.shakeX) | 0 }
  toPixY(wy: number): number { return (wy - this.y + this.shakeY) | 0 }
}
