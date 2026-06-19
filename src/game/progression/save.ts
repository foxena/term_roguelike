import { mkdir, writeFile, readFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"
import { makeMetaProgress, type MetaProgress } from "./metatree.ts"

const SAVE_DIR  = join(homedir(), ".term_roguelike")
const SAVE_FILE = join(SAVE_DIR, "save.json")

interface SaveData {
  version: number
  essence: number
  prestigePoints: number
  totalPrestige: number
  ranks: Record<string, number>
  unlockedClasses: string[]
  stats: {
    totalKills: number
    totalRuns: number
    bestFloor: number
    bossesKilled: number
    itemsCollected: number
    maxEssence: number
    classesPlayed: string[]
  }
  achievements: string[]
}

export interface GameStats {
  totalKills: number
  totalRuns: number
  bestFloor: number
  bossesKilled: number
  itemsCollected: number
  maxEssence: number
  classesPlayed: Set<string>
  achievements: Set<string>
}

export function makeGameStats(): GameStats {
  return { totalKills:0, totalRuns:0, bestFloor:0, bossesKilled:0,
           itemsCollected:0, maxEssence:0, classesPlayed:new Set(), achievements:new Set() }
}

function toSaveData(p: MetaProgress, s: GameStats): SaveData {
  return {
    version: 2,
    essence: p.essence, prestigePoints: p.prestigePoints, totalPrestige: p.totalPrestige,
    ranks: { ...p.ranks }, unlockedClasses: [...p.unlockedClasses],
    stats: {
      totalKills: s.totalKills, totalRuns: s.totalRuns, bestFloor: s.bestFloor,
      bossesKilled: s.bossesKilled, itemsCollected: s.itemsCollected, maxEssence: s.maxEssence,
      classesPlayed: [...s.classesPlayed],
    },
    achievements: [...s.achievements],
  }
}

function fromSaveData(d: SaveData): { meta: MetaProgress; stats: GameStats } {
  const meta: MetaProgress = {
    essence: d.essence, prestigePoints: d.prestigePoints, totalPrestige: d.totalPrestige,
    ranks: d.ranks, unlockedClasses: new Set(d.unlockedClasses),
  }
  const stats: GameStats = {
    totalKills: d.stats.totalKills ?? 0, totalRuns: d.stats.totalRuns ?? 0,
    bestFloor: d.stats.bestFloor ?? 0, bossesKilled: d.stats.bossesKilled ?? 0,
    itemsCollected: d.stats.itemsCollected ?? 0, maxEssence: d.stats.maxEssence ?? 0,
    classesPlayed: new Set(d.stats.classesPlayed ?? []),
    achievements: new Set(d.achievements ?? []),
  }
  return { meta, stats }
}

export async function saveGame(p: MetaProgress, s: GameStats): Promise<void> {
  if (!existsSync(SAVE_DIR)) await mkdir(SAVE_DIR, { recursive: true })
  await writeFile(SAVE_FILE, JSON.stringify(toSaveData(p, s), null, 2))
}

export async function loadGame(): Promise<{ meta: MetaProgress; stats: GameStats }> {
  if (!existsSync(SAVE_FILE)) return { meta: makeMetaProgress(), stats: makeGameStats() }
  try {
    const raw = await readFile(SAVE_FILE, "utf-8")
    const d: SaveData = JSON.parse(raw)
    return fromSaveData(d)
  } catch {
    return { meta: makeMetaProgress(), stats: makeGameStats() }
  }
}
