/** Tiny seedable PRNG (mulberry32). Deterministic given a seed. */
export class RNG {
  private s: number

  constructor(seed: number = (Math.random() * 2 ** 32) >>> 0) {
    this.s = seed >>> 0 || 1
  }

  /** Float in [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) | 0
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Integer in [0, maxExclusive). */
  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive)
  }

  /** Integer in [min, maxInclusive]. */
  range(min: number, maxInclusive: number): number {
    return min + this.int(maxInclusive - min + 1)
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p
  }
}
