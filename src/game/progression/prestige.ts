import type { MetaProgress } from "./metatree.ts"

export interface PrestigeResult {
  pointsGained: number
  newTotal: number
}

/** Cost in Essence to prestige — escalates each time. */
export function prestigeCost(totalPrestige: number): number {
  return 150 + totalPrestige * 100
}

/** Reset the meta tree in exchange for a Prestige Point and permanent multipliers. */
export function doPrestige(progress: MetaProgress): PrestigeResult | null {
  const cost = prestigeCost(progress.totalPrestige)
  if (progress.essence < cost) return null

  const pointsGained = 1 + Math.floor(progress.totalPrestige / 3)
  progress.essence -= cost
  progress.ranks = {}                    // reset tree
  progress.prestigePoints += pointsGained
  progress.totalPrestige++

  // Keep unlocked classes as they are non-resetting rewards
  return { pointsGained, newTotal: progress.prestigePoints }
}

export const PRESTIGE_PERKS: { pp: number; desc: string }[] = [
  { pp:1,  desc:"All stats ×1.15 globally"                  },
  { pp:2,  desc:"Essence ×1.2 globally"                     },
  { pp:3,  desc:"All stats ×1.3 globally, +30% essence"     },
  { pp:5,  desc:"Legendary item chance doubled"             },
  { pp:8,  desc:"All stats ×2, essence ×1.5"               },
]
