import { RGBA, type OptimizedBuffer } from "@opentui/core"

const UPPER_HALF_BLOCK = 0x2580 // ▀  — fg paints the top pixel, bg the bottom pixel

function clamp255(v: number): number {
  if (v <= 0) return 0
  if (v >= 255) return 255
  return v | 0
}

/**
 * A true-colour RGB pixel framebuffer that blits into an OpenTUI cell buffer
 * using the upper-half-block trick: each terminal cell shows two stacked
 * "pixels" (fg = top, bg = bottom). Cell aspect (~1 wide : 2 tall) means the
 * resulting pixels are roughly square.
 *
 * Colours accumulate ADDITIVELY (HDR-ish) so overlapping glows blow out toward
 * white cores with coloured halos — the basis of the neon look. Values are
 * tone-mapped (clamped) only at blit time.
 *
 * Resolution: `width` px across = cells across; `height` px tall = cells * 2.
 */
export class PixelCanvas {
  readonly width: number
  readonly height: number
  readonly cellRows: number
  /** Interleaved RGB, length width*height*3. */
  readonly data: Float32Array

  // Reused across the whole blit to avoid per-cell allocation.
  private readonly top = RGBA.fromInts(0, 0, 0, 255)
  private readonly bot = RGBA.fromInts(0, 0, 0, 255)

  constructor(width: number, cellRows: number) {
    this.width = width
    this.cellRows = cellRows
    this.height = cellRows * 2
    this.data = new Float32Array(width * this.height * 3)
  }

  /** Reset every pixel to a (usually dark) base colour. */
  clear(r = 0, g = 0, b = 0): void {
    const d = this.data
    if (r === 0 && g === 0 && b === 0) {
      d.fill(0)
      return
    }
    for (let i = 0; i < d.length; i += 3) {
      d[i] = r
      d[i + 1] = g
      d[i + 2] = b
    }
  }

  /** Additive single-pixel plot (no bounds cost beyond the check). */
  addPixel(x: number, y: number, r: number, g: number, b: number): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return
    const i = (y * this.width + x) * 3
    this.data[i] += r
    this.data[i + 1] += g
    this.data[i + 2] += b
  }

  /**
   * Soft radial glow: brightness falls off from the centre. `falloff` shapes
   * the curve (2 = quadratic, higher = tighter core). The natural neon brush.
   */
  addGlow(cx: number, cy: number, radius: number, r: number, g: number, b: number, intensity = 1, falloff = 2): void {
    const minX = Math.max(0, Math.floor(cx - radius))
    const maxX = Math.min(this.width - 1, Math.ceil(cx + radius))
    const minY = Math.max(0, Math.floor(cy - radius))
    const maxY = Math.min(this.height - 1, Math.ceil(cy + radius))
    const r2 = radius * radius
    const d = this.data
    const w = this.width
    for (let y = minY; y <= maxY; y++) {
      const dy = y - cy
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx
        const dist2 = dx * dx + dy * dy
        if (dist2 > r2) continue
        let t = 1 - Math.sqrt(dist2) / radius
        if (falloff !== 1) t = Math.pow(t, falloff)
        const k = t * intensity
        const i = (y * w + x) * 3
        d[i] += r * k
        d[i + 1] += g * k
        d[i + 2] += b * k
      }
    }
  }

  /** Solid-ish disc with a 1px soft edge — good for unit cores. */
  addDisc(cx: number, cy: number, radius: number, r: number, g: number, b: number): void {
    const minX = Math.max(0, Math.floor(cx - radius - 1))
    const maxX = Math.min(this.width - 1, Math.ceil(cx + radius + 1))
    const minY = Math.max(0, Math.floor(cy - radius - 1))
    const maxY = Math.min(this.height - 1, Math.ceil(cy + radius + 1))
    const d = this.data
    const w = this.width
    for (let y = minY; y <= maxY; y++) {
      const dy = y - cy
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx
        const dist = Math.sqrt(dx * dx + dy * dy)
        const k = Math.max(0, Math.min(1, radius + 0.5 - dist))
        if (k <= 0) continue
        const i = (y * w + x) * 3
        d[i] += r * k
        d[i + 1] += g * k
        d[i + 2] += b * k
      }
    }
  }

  /** Additive line (Bresenham) — projectile cores, beams, trails. */
  addLine(x0: number, y0: number, x1: number, y1: number, r: number, g: number, b: number): void {
    x0 |= 0
    y0 |= 0
    x1 |= 0
    y1 |= 0
    const dx = Math.abs(x1 - x0)
    const dy = -Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1
    const sy = y0 < y1 ? 1 : -1
    let err = dx + dy
    for (;;) {
      this.addPixel(x0, y0, r, g, b)
      if (x0 === x1 && y0 === y1) break
      const e2 = 2 * err
      if (e2 >= dy) {
        err += dy
        x0 += sx
      }
      if (e2 <= dx) {
        err += dx
        y0 += sy
      }
    }
  }

  /**
   * Cheap separable bloom: blur a copy and add it back, amplifying bright areas
   * into soft halos. `passes` box-blur iterations approximate a gaussian.
   */
  bloom(strength = 0.6, passes = 2, scratch?: Float32Array): void {
    const d = this.data
    const n = d.length
    const tmp = scratch && scratch.length >= n ? scratch : new Float32Array(n)
    tmp.set(d.subarray(0, n))
    const w = this.width
    const h = this.height
    for (let p = 0; p < passes; p++) {
      // Horizontal
      for (let y = 0; y < h; y++) {
        const row = y * w * 3
        for (let c = 0; c < 3; c++) {
          for (let x = 1; x < w - 1; x++) {
            const i = row + x * 3 + c
            tmp[i] = (tmp[i - 3] + tmp[i] + tmp[i + 3]) / 3
          }
        }
      }
      // Vertical
      const stride = w * 3
      for (let x = 0; x < w; x++) {
        const col = x * 3
        for (let c = 0; c < 3; c++) {
          for (let y = 1; y < h - 1; y++) {
            const i = y * stride + col + c
            tmp[i] = (tmp[i - stride] + tmp[i] + tmp[i + stride]) / 3
          }
        }
      }
    }
    for (let i = 0; i < n; i++) d[i] += tmp[i] * strength
  }

  /** Blit to a cell buffer at cell origin (ox, oy) using half-blocks. */
  blit(buffer: OptimizedBuffer, ox = 0, oy = 0): void {
    const { data, width, cellRows, top, bot } = this
    const stride = width * 3
    const tb = top.buffer
    const bb = bot.buffer
    for (let cy = 0; cy < cellRows; cy++) {
      const topRow = 2 * cy * stride
      const botRow = (2 * cy + 1) * stride
      const screenY = oy + cy
      for (let x = 0; x < width; x++) {
        const ti = topRow + x * 3
        const bi = botRow + x * 3
        // Write the colour byte directly, preserving each channel's meta byte.
        tb[0] = (tb[0] & 0xff00) | clamp255(data[ti])
        tb[1] = (tb[1] & 0xff00) | clamp255(data[ti + 1])
        tb[2] = (tb[2] & 0xff00) | clamp255(data[ti + 2])
        bb[0] = (bb[0] & 0xff00) | clamp255(data[bi])
        bb[1] = (bb[1] & 0xff00) | clamp255(data[bi + 1])
        bb[2] = (bb[2] & 0xff00) | clamp255(data[bi + 2])
        buffer.drawChar(UPPER_HALF_BLOCK, ox + x, screenY, top, bot)
      }
    }
  }
}
