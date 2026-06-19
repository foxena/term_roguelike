export interface RunStats {
  kills: number
  gold: number
  damageTaken: number
  roomsCleared: number
  floor: number
  essence: number   // earned this run, added to meta on run end
}

export function makeRun(): RunStats {
  return { kills: 0, gold: 0, damageTaken: 0, roomsCleared: 0, floor: 1, essence: 0 }
}

export function computeEssence(run: RunStats): number {
  return Math.floor(run.kills * 0.5 + run.roomsCleared * 5 + run.floor * 10)
}
