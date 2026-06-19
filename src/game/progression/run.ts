export interface RunStats {
  kills: number
  gold: number
  damageTaken: number
  roomsCleared: number
  floor: number
  essence: number
  itemIds: string[]   // collected item ids this run
}

export function makeRun(): RunStats {
  return { kills: 0, gold: 0, damageTaken: 0, roomsCleared: 0, floor: 1, essence: 0, itemIds: [] }
}

export function computeEssence(run: RunStats): number {
  return Math.floor(run.kills * 0.5 + run.roomsCleared * 5 + run.floor * 10 + run.itemIds.length * 3)
}
