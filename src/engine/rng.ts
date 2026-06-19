export class RNG {
  private s: number
  constructor(seed: number = (Math.random() * 2 ** 32) >>> 0) {
    this.s = seed >>> 0 || 1
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) | 0
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  int(max: number): number { return Math.floor(this.next() * max) }
  range(min: number, max: number): number { return min + this.int(max - min + 1) }
  chance(p: number): boolean { return this.next() < p }
  pick<T>(arr: T[]): T { return arr[this.int(arr.length)] }
}
