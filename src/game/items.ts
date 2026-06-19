export interface ItemDef {
  id: string
  name: string
  desc: string
  rarity: "common" | "uncommon" | "rare" | "legendary"
  // stat modifiers (multiplicative where noted)
  dmgMult?: number
  speedMult?: number
  fireRateMult?: number
  projectileCount?: number
  pierceMult?: number
  hpBonus?: number
  hpRegenRate?: number
  radiusMult?: number    // projectile size
  rangeMult?: number     // projectile lifetime
  critChance?: number
  critMult?: number
  // special tags
  tags?: string[]
}

export const ITEMS: ItemDef[] = [
  // Common
  { id:"quick_gloves",    name:"Quick Gloves",      desc:"Move 25% faster",             rarity:"common",   speedMult:1.25 },
  { id:"sharp_edge",      name:"Sharp Edge",         desc:"+30% damage",                 rarity:"common",   dmgMult:1.3 },
  { id:"fast_fingers",    name:"Fast Fingers",       desc:"Fire 30% faster",             rarity:"common",   fireRateMult:1.3 },
  { id:"bandage",         name:"Bandage",            desc:"+20 max HP",                  rarity:"common",   hpBonus:20 },
  { id:"big_shot",        name:"Big Shot",           desc:"Projectiles 40% larger",      rarity:"common",   radiusMult:1.4 },
  { id:"long_reach",      name:"Long Reach",         desc:"Projectiles travel 50% further", rarity:"common", rangeMult:1.5 },

  // Uncommon
  { id:"twin_shot",       name:"Twin Shot",          desc:"Fire an extra projectile",    rarity:"uncommon", projectileCount:2 },
  { id:"piercing_tip",    name:"Piercing Tip",       desc:"Pierce through 2 enemies",    rarity:"uncommon", pierceMult:2 },
  { id:"adrenaline",      name:"Adrenaline",         desc:"+40% speed, +20% fire rate",  rarity:"uncommon", speedMult:1.4, fireRateMult:1.2 },
  { id:"vampiric",        name:"Vampiric Edge",      desc:"Regen 1 HP/sec",              rarity:"uncommon", hpRegenRate:1 },
  { id:"crit_lens",       name:"Crit Lens",          desc:"15% crit chance (×2 dmg)",    rarity:"uncommon", critChance:0.15, critMult:2 },
  { id:"double_damage",   name:"Double Damage",      desc:"+100% damage",                rarity:"uncommon", dmgMult:2.0 },

  // Rare
  { id:"triple_shot",     name:"Triple Shot",        desc:"Fire 3 projectiles",          rarity:"rare",     projectileCount:3, fireRateMult:0.85 },
  { id:"overdrive",       name:"Overdrive",          desc:"×2 speed & fire rate",        rarity:"rare",     speedMult:2.0, fireRateMult:2.0 },
  { id:"death_spiral",    name:"Death Spiral",       desc:"Crits: 25% chance, ×3 dmg",  rarity:"rare",     critChance:0.25, critMult:3 },
  { id:"glass_cannon",    name:"Glass Cannon",       desc:"×3 dmg, -30 max HP",          rarity:"rare",     dmgMult:3.0, hpBonus:-30 },
  { id:"swift_death",     name:"Swift Death",        desc:"+50% speed, pierce all",      rarity:"rare",     speedMult:1.5, pierceMult:999 },

  // Legendary
  { id:"godspeed",        name:"Godspeed",           desc:"×3 everything",               rarity:"legendary", dmgMult:3, speedMult:3, fireRateMult:3 },
  { id:"one_hp",          name:"Cursed Amulet",      desc:"×5 dmg but 1 max HP",         rarity:"legendary", dmgMult:5, hpBonus:-999, tags:["cursed"] },
  { id:"bouncy_shots",    name:"Ricochet",           desc:"Pierce ∞, +50% dmg",          rarity:"legendary", pierceMult:999, dmgMult:1.5 },
]

export const ITEM_MAP = new Map(ITEMS.map(i => [i.id, i]))

export interface PlayerStats {
  dmgMult: number
  speedMult: number
  fireRateMult: number
  projectileCount: number
  pierce: number
  hpBonus: number
  hpRegenRate: number
  radiusMult: number
  rangeMult: number
  critChance: number
  critMult: number
}

export function baseStats(): PlayerStats {
  return { dmgMult:1, speedMult:1, fireRateMult:1, projectileCount:1, pierce:0, hpBonus:0, hpRegenRate:0, radiusMult:1, rangeMult:1, critChance:0, critMult:1.5 }
}

export function applyItem(stats: PlayerStats, item: ItemDef): void {
  if (item.dmgMult)        stats.dmgMult       *= item.dmgMult
  if (item.speedMult)      stats.speedMult     *= item.speedMult
  if (item.fireRateMult)   stats.fireRateMult  *= item.fireRateMult
  if (item.projectileCount) stats.projectileCount += item.projectileCount - 1
  if (item.pierceMult)     stats.pierce         = Math.max(stats.pierce, item.pierceMult)
  if (item.hpBonus)        stats.hpBonus       += item.hpBonus
  if (item.hpRegenRate)    stats.hpRegenRate   += item.hpRegenRate
  if (item.radiusMult)     stats.radiusMult    *= item.radiusMult
  if (item.rangeMult)      stats.rangeMult     *= item.rangeMult
  if (item.critChance)     stats.critChance    += item.critChance
  if (item.critMult)       stats.critMult       = Math.max(stats.critMult, item.critMult)
}

/** Pick `n` random items weighted by rarity (rarer = less common). */
export function pickItems(n: number, rng: { next(): number }): ItemDef[] {
  const weights = { common: 60, uncommon: 25, rare: 12, legendary: 3 }
  const pool = ITEMS.filter(i => !i.tags?.includes("cursed") || rng.next() < 0.15)
  const result: ItemDef[] = []
  const used = new Set<string>()
  for (let t = 0; t < n * 20 && result.length < n; t++) {
    const item = pool[Math.floor(rng.next() * pool.length)]
    if (used.has(item.id)) continue
    const w = weights[item.rarity]
    if (rng.next() * 100 < w) { result.push(item); used.add(item.id) }
  }
  return result
}
