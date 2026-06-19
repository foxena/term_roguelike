/** Global hit-stop: freeze simulation briefly on impactful hits for juicy feel. */
export class HitStop {
  private remaining = 0

  trigger(durationSec: number): void {
    if (durationSec > this.remaining) this.remaining = durationSec
  }

  /** Returns the dt to pass to the simulation (0 when frozen). */
  tick(realDt: number): number {
    if (this.remaining <= 0) return realDt
    this.remaining -= realDt
    return 0
  }

  get active(): boolean { return this.remaining > 0 }
}
