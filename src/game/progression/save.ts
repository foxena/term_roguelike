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
  }
}

function toSaveData(p: MetaProgress, stats: SaveData["stats"]): SaveData {
  return {
    version: 1,
    essence: p.essence,
    prestigePoints: p.prestigePoints,
    totalPrestige: p.totalPrestige,
    ranks: { ...p.ranks },
    unlockedClasses: [...p.unlockedClasses],
    stats,
  }
}

function fromSaveData(d: SaveData): MetaProgress {
  return {
    essence: d.essence,
    prestigePoints: d.prestigePoints,
    totalPrestige: d.totalPrestige,
    ranks: d.ranks,
    unlockedClasses: new Set(d.unlockedClasses),
  }
}

export async function saveGame(p: MetaProgress, stats: SaveData["stats"]): Promise<void> {
  if (!existsSync(SAVE_DIR)) await mkdir(SAVE_DIR, { recursive: true })
  await writeFile(SAVE_FILE, JSON.stringify(toSaveData(p, stats), null, 2))
}

export async function loadGame(): Promise<{ meta: MetaProgress; stats: SaveData["stats"] }> {
  const defaultStats = { totalKills: 0, totalRuns: 0, bestFloor: 0 }
  if (!existsSync(SAVE_FILE)) return { meta: makeMetaProgress(), stats: defaultStats }
  try {
    const raw = await readFile(SAVE_FILE, "utf-8")
    const d: SaveData = JSON.parse(raw)
    return { meta: fromSaveData(d), stats: d.stats }
  } catch {
    return { meta: makeMetaProgress(), stats: defaultStats }
  }
}

export type GameStats = SaveData["stats"]
