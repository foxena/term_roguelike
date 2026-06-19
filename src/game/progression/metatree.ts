export interface MetaNode {
  id: string
  name: string
  desc: string
  cost: number          // Essence
  maxRank: number
  prereqs: string[]     // node ids
  category: "offense" | "defense" | "utility" | "class" | "prestige"
  effect: (rank: number) => Partial<MetaBonus>
}

export interface MetaBonus {
  dmgMult: number
  speedMult: number
  hpBonus: number
  hpRegenRate: number
  fireRateMult: number
  critChance: number
  goldBonus: number     // additive flat per run
  essenceMult: number   // multiplies essence earned
  startingGold: number
  extraItemChoice: number  // +N treasure choices
  unlockClass?: string
}

export function zeroBonus(): MetaBonus {
  return { dmgMult:1, speedMult:1, hpBonus:0, hpRegenRate:0, fireRateMult:1,
           critChance:0, goldBonus:0, essenceMult:1, startingGold:0, extraItemChoice:0 }
}

export const META_NODES: MetaNode[] = [
  // Offense
  { id:"dmg1",   name:"Sharpened",    desc:"+20% damage",             cost:15, maxRank:5, prereqs:[],       category:"offense", effect:r=>({dmgMult:1+r*0.2}) },
  { id:"crit1",  name:"Lucky Strike", desc:"+5% crit chance/rank",    cost:20, maxRank:4, prereqs:["dmg1"], category:"offense", effect:r=>({critChance:r*0.05}) },
  { id:"fire1",  name:"Quick Hands",  desc:"+15% fire rate/rank",     cost:18, maxRank:4, prereqs:[],       category:"offense", effect:r=>({fireRateMult:1+r*0.15}) },
  { id:"dmg2",   name:"Lethal Edge",  desc:"+50% damage (big boost)", cost:60, maxRank:3, prereqs:["dmg1","crit1"], category:"offense", effect:r=>({dmgMult:1+r*0.5}) },

  // Defense
  { id:"hp1",    name:"Vitality",     desc:"+25 max HP/rank",         cost:12, maxRank:6, prereqs:[],       category:"defense", effect:r=>({hpBonus:r*25}) },
  { id:"regen1", name:"Resilience",   desc:"+0.5 HP regen/sec/rank",  cost:20, maxRank:4, prereqs:["hp1"],  category:"defense", effect:r=>({hpRegenRate:r*0.5}) },
  { id:"hp2",    name:"Iron Flesh",   desc:"+100 max HP",             cost:50, maxRank:2, prereqs:["hp1","regen1"], category:"defense", effect:r=>({hpBonus:r*100}) },

  // Utility
  { id:"spd1",   name:"Fleet Footed", desc:"+15% move speed/rank",    cost:14, maxRank:4, prereqs:[],       category:"utility", effect:r=>({speedMult:1+r*0.15}) },
  { id:"gold1",  name:"Treasure Sense",desc:"+5 starting gold/rank",  cost:10, maxRank:5, prereqs:[],       category:"utility", effect:r=>({startingGold:r*5}) },
  { id:"ess1",   name:"Soul Harvest", desc:"+20% essence per run/rank",cost:25,maxRank:4, prereqs:[],       category:"utility", effect:r=>({essenceMult:1+r*0.2}) },
  { id:"item1",  name:"Sharp Eye",    desc:"+1 item choice in treasure",cost:35,maxRank:2,prereqs:["gold1"],category:"utility", effect:r=>({extraItemChoice:r}) },
  { id:"gold2",  name:"Hoarder",      desc:"+15 gold/run, +10% essence",cost:40,maxRank:3,prereqs:["gold1","ess1"],category:"utility",effect:r=>({goldBonus:r*15,essenceMult:1+r*0.1}) },

  // Class unlocks (these become available after prestige 1)
  { id:"unlock_necromancer", name:"Forbidden Arts", desc:"Unlock Necromancer", cost:80, maxRank:1, prereqs:["dmg2"], category:"class", effect:_=>({unlockClass:"necromancer"}) },
  { id:"unlock_rogue",       name:"Shadow Training",desc:"Unlock Rogue",       cost:80, maxRank:1, prereqs:["spd1"], category:"class", effect:_=>({unlockClass:"rogue"}) },
  { id:"unlock_druid",       name:"Nature's Call",  desc:"Unlock Druid",       cost:80, maxRank:1, prereqs:["hp2"],  category:"class", effect:_=>({unlockClass:"druid"}) },
  { id:"unlock_paladin",     name:"Holy Calling",   desc:"Unlock Paladin",     cost:80, maxRank:1, prereqs:["regen1"],category:"class",effect:_=>({unlockClass:"paladin"}) },
]

export const META_NODE_MAP = new Map(META_NODES.map(n=>[n.id, n]))

export interface MetaProgress {
  ranks: Record<string, number>       // node id → current rank
  essence: number
  prestigePoints: number
  totalPrestige: number
  unlockedClasses: Set<string>
}

export function makeMetaProgress(): MetaProgress {
  return { ranks: {}, essence: 0, prestigePoints: 0, totalPrestige: 0,
           unlockedClasses: new Set(["warrior","mage","archer"]) }
}

export function canUnlock(node: MetaNode, progress: MetaProgress): boolean {
  const rank = progress.ranks[node.id] ?? 0
  if (rank >= node.maxRank) return false
  if (progress.essence < node.cost) return false
  for (const prereq of node.prereqs) {
    if ((progress.ranks[prereq] ?? 0) < 1) return false
  }
  return true
}

export function unlockNode(node: MetaNode, progress: MetaProgress): boolean {
  if (!canUnlock(node, progress)) return false
  progress.essence -= node.cost
  progress.ranks[node.id] = (progress.ranks[node.id] ?? 0) + 1
  const bonus = node.effect(progress.ranks[node.id])
  if (bonus.unlockClass) progress.unlockedClasses.add(bonus.unlockClass)
  return true
}

export function computeMetaBonus(progress: MetaProgress): MetaBonus {
  const bonus = zeroBonus()
  for (const [id, rank] of Object.entries(progress.ranks)) {
    if (rank <= 0) continue
    const node = META_NODE_MAP.get(id)
    if (!node) continue
    const eff = node.effect(rank)
    if (eff.dmgMult)      bonus.dmgMult      *= eff.dmgMult
    if (eff.speedMult)    bonus.speedMult    *= eff.speedMult
    if (eff.hpBonus)      bonus.hpBonus      += eff.hpBonus
    if (eff.hpRegenRate)  bonus.hpRegenRate  += eff.hpRegenRate
    if (eff.fireRateMult) bonus.fireRateMult *= eff.fireRateMult
    if (eff.critChance)   bonus.critChance   += eff.critChance
    if (eff.goldBonus)    bonus.goldBonus    += eff.goldBonus
    if (eff.essenceMult)  bonus.essenceMult  *= eff.essenceMult
    if (eff.startingGold) bonus.startingGold += eff.startingGold
    if (eff.extraItemChoice) bonus.extraItemChoice += eff.extraItemChoice
  }
  // Prestige global multipliers
  const pp = progress.totalPrestige
  bonus.dmgMult      *= 1 + pp * 0.15
  bonus.speedMult    *= 1 + pp * 0.05
  bonus.essenceMult  *= 1 + pp * 0.2
  return bonus
}
