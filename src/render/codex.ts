import { RGBA, type OptimizedBuffer } from "@opentui/core"
import { ACHIEVEMENTS, type AchievementStats } from "../game/achievements.ts"

function rgb(r: number, g: number, b: number) { return RGBA.fromInts(r, g, b, 255) }

const R_TEXT  = rgb(200, 215, 255)
const R_DIM   = rgb(80, 100, 150)
const R_GOLD  = rgb(255, 210, 80)
const R_GREEN = rgb(80, 255, 140)
const R_BG    = rgb(6, 8, 18)

export function drawCodex(
  buffer: OptimizedBuffer, unlocked: Set<string>, achStats: AchievementStats,
  cellW: number, cellH: number
): void {
  buffer.fillRect(0, 0, cellW, cellH, R_BG)
  const title = "✦ CODEX & ACHIEVEMENTS ✦"
  buffer.drawText(title, ((cellW - title.length) / 2) | 0, 0, R_GOLD)
  buffer.drawText(`${unlocked.size}/${ACHIEVEMENTS.length} unlocked`, 2, 1, R_GREEN)

  for (let i = 0; i < ACHIEVEMENTS.length; i++) {
    const a = ACHIEVEMENTS[i]
    const done = unlocked.has(a.id)
    const y = 3 + i
    if (y >= cellH - 2) break
    const col = done ? R_GREEN : R_DIM
    const icon = done ? "✓" : "○"
    buffer.drawText(`${icon} ${a.name.padEnd(18)} ${done ? a.desc : "???"}`, 2, y, col, R_BG)
  }

  buffer.drawText("ESC / C to close", 2, cellH - 1, R_DIM)
}

export function drawHelp(buffer: OptimizedBuffer, cellW: number, cellH: number): void {
  buffer.fillRect(0, 0, cellW, cellH, rgb(6, 8, 18))
  const lines = [
    ["CONTROLS", ""],
    ["WASD / H J K L", "Move"],
    ["ARROW KEYS",     "Aim / fire (ranged classes)"],
    ["SPACE",          "Class ability (cooldown)"],
    ["E",              "Interact / confirm"],
    ["TAB",            "Toggle minimap / switch hub tab"],
    ["ESC / P",        "Pause / resume"],
    ["R",              "Restart (from death screen)"],
    ["C",              "Codex / achievements"],
    ["H",              "Hub (from class select)"],
    ["Q",              "Quit"],
    ["", ""],
    ["CLASSES", ""],
    ["Warrior",    "Melee cleave + whirlwind. Face enemies to attack."],
    ["Mage",       "Aim and hold arrow key to fire crystal bolts."],
    ["Archer",     "Rapid pierce-shots. Volley ability."],
    ["Necromancer","Soul bolt + corpse burst. Unlock via meta tree."],
    ["Paladin",    "Radiant smite + holy nova ring."],
    ["Rogue",      "Dagger spray + teleport-dash strike."],
    ["Druid",      "Nature bolt + vine whip AOE."],
  ]
  buffer.drawText("✦ NEONFALL — HELP ✦", ((cellW - 20) / 2) | 0, 0, rgb(60, 200, 255))
  for (let i = 0; i < lines.length; i++) {
    const [key, val] = lines[i]
    if (!key) continue
    const isSect = !val
    buffer.drawText(key, 2, 2 + i, isSect ? rgb(255, 210, 80) : rgb(200, 215, 255))
    if (val) buffer.drawText(val, 22, 2 + i, rgb(140, 160, 200))
  }
  buffer.drawText("ESC to close", 2, cellH - 1, rgb(80, 100, 150))
}
