import { RGBA } from "@opentui/core"

/** Central palette. Keep all colors here so the look stays cohesive. */
export const Palette = {
  bg: RGBA.fromHex("#0b0e14"),

  wallLit: RGBA.fromHex("#4b577a"),
  wallDim: RGBA.fromHex("#222a3d"),
  floorLit: RGBA.fromHex("#1b2233"),
  floorDim: RGBA.fromHex("#10141d"),

  player: RGBA.fromHex("#ffd166"),
  playerHurt: RGBA.fromHex("#ff5d5d"),

  enemy: RGBA.fromHex("#ef476f"),
  enemyFast: RGBA.fromHex("#ff9f1c"),
  enemyTank: RGBA.fromHex("#9b5de5"),

  hudBg: RGBA.fromHex("#070a10"),
  text: RGBA.fromHex("#c8d3f5"),
  textDim: RGBA.fromHex("#5b6788"),
  accent: RGBA.fromHex("#7aa2f7"),

  hpGood: RGBA.fromHex("#06d6a0"),
  hpMid: RGBA.fromHex("#ffd166"),
  hpBad: RGBA.fromHex("#ef476f"),

  cleave: RGBA.fromHex("#e0fbfc"),
} as const
