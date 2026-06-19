export type StatusType = "burn" | "poison" | "slow" | "stun" | "freeze"

export interface StatusEffect {
  type: StatusType
  duration: number
  strength: number  // dmg/sec for burn/poison; speed multiplier for slow
}

const MAX_ENEMIES = 600

export class StatusEffectPool {
  // Parallel arrays per enemy slot: up to 3 concurrent effects each
  private effects: Array<StatusEffect[]> = Array.from({ length: MAX_ENEMIES }, () => [])

  clear(i: number): void { this.effects[i] = [] }

  apply(i: number, eff: StatusEffect): void {
    const slot = this.effects[i]
    const existing = slot.find(e => e.type === eff.type)
    if (existing) {
      existing.duration = Math.max(existing.duration, eff.duration)
      existing.strength = Math.max(existing.strength, eff.strength)
    } else if (slot.length < 3) {
      slot.push({ ...eff })
    }
  }

  /** Returns total damage this tick and speed multiplier. Removes expired effects. */
  tick(i: number, dt: number): { dmg: number; speedMult: number; stunned: boolean } {
    const slot = this.effects[i]
    let dmg = 0, speedMult = 1, stunned = false
    let j = 0
    while (j < slot.length) {
      const e = slot[j]
      e.duration -= dt
      if (e.duration <= 0) { slot.splice(j, 1); continue }
      if (e.type === "burn" || e.type === "poison") dmg += e.strength * dt
      if (e.type === "slow") speedMult = Math.min(speedMult, e.strength)
      if (e.type === "stun" || e.type === "freeze") stunned = true
      j++
    }
    return { dmg, speedMult, stunned }
  }

  getEffects(i: number): StatusEffect[] { return this.effects[i] }
}
