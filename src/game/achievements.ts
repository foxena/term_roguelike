export interface Achievement {
  id: string
  name: string
  desc: string
  check(stats: AchievementStats): boolean
}

export interface AchievementStats {
  totalKills: number
  totalRuns: number
  bestFloor: number
  totalPrestige: number
  maxEssence: number
  classesPlayed: Set<string>
  bossesKilled: number
  itemsCollected: number
}

export const ACHIEVEMENTS: Achievement[] = [
  { id:"first_blood",  name:"First Blood",     desc:"Complete your first run",          check:s=>s.totalRuns>=1 },
  { id:"slayer_10",    name:"Slayer",           desc:"Kill 10 enemies total",            check:s=>s.totalKills>=10 },
  { id:"slayer_100",   name:"Mass Slayer",      desc:"Kill 100 enemies total",           check:s=>s.totalKills>=100 },
  { id:"slayer_1000",  name:"Harbinger",        desc:"Kill 1000 enemies total",          check:s=>s.totalKills>=1000 },
  { id:"floor5",       name:"Deep Diver",       desc:"Reach floor 5",                   check:s=>s.bestFloor>=5 },
  { id:"floor10",      name:"Abyss Walker",     desc:"Reach floor 10",                  check:s=>s.bestFloor>=10 },
  { id:"prestige1",    name:"Reborn",           desc:"Prestige for the first time",     check:s=>s.totalPrestige>=1 },
  { id:"prestige5",    name:"Eternal",          desc:"Prestige 5 times",               check:s=>s.totalPrestige>=5 },
  { id:"all_classes",  name:"Jack of All",      desc:"Play every class",               check:s=>s.classesPlayed.size>=7 },
  { id:"boss5",        name:"Boss Hunter",      desc:"Kill 5 bosses",                  check:s=>s.bossesKilled>=5 },
  { id:"collector",    name:"Collector",        desc:"Collect 20 items across runs",   check:s=>s.itemsCollected>=20 },
  { id:"essence1000",  name:"Soul Rich",        desc:"Accumulate 1000 total essence",  check:s=>s.maxEssence>=1000 },
  { id:"speedrun",     name:"Blazing Fast",     desc:"Clear floor 3 in under 5 runs",  check:s=>s.bestFloor>=3&&s.totalRuns<=5 },
  { id:"survivor",     name:"Survivor",         desc:"Complete 10 runs total",         check:s=>s.totalRuns>=10 },
]

export function checkAchievements(stats: AchievementStats, unlocked: Set<string>): Achievement[] {
  const newlyUnlocked: Achievement[] = []
  for (const ach of ACHIEVEMENTS) {
    if (!unlocked.has(ach.id) && ach.check(stats)) {
      unlocked.add(ach.id)
      newlyUnlocked.push(ach)
    }
  }
  return newlyUnlocked
}
