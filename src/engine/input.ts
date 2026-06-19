export interface InputState {
  moveX: number          // -1 0 1
  moveY: number          // -1 0 1
  moveRefresh: number    // performance.now() of last movement keypress
  aimX: number
  aimY: number
  ability: boolean
  interact: boolean
  map: boolean
  pause: boolean
  confirm: boolean
  raw: string
}

// How long after the last movement keypress we keep moving.
// Must be longer than key-repeat interval (~30ms) but short enough to feel responsive.
const MOVE_GRACE_MS = 120

export function makeInput(): InputState {
  return { moveX: 0, moveY: 0, moveRefresh: -9999, aimX: 0, aimY: 1,
           ability: false, interact: false, map: false, pause: false, confirm: false, raw: "" }
}

export function clearInputFrame(s: InputState): void {
  s.ability  = false
  s.interact = false
  s.map      = false
  s.pause    = false
  s.confirm  = false
  s.raw      = ""
  // Expire movement if the grace period has elapsed (key was released).
  if (performance.now() - s.moveRefresh > MOVE_GRACE_MS) {
    s.moveX = 0
    s.moveY = 0
  }
}

/** Call on every keypress (including key-repeat). */
export function applyKey(s: InputState, name: string): void {
  s.raw = name
  let isMoveKey = true
  switch (name) {
    case "w": case "up":    case "k": s.moveX = 0;  s.moveY = -1; break
    case "s": case "down":  case "j": s.moveX = 0;  s.moveY =  1; break
    case "a": case "left":  case "h": s.moveX = -1; s.moveY = 0;  break
    case "d": case "right": case "l": s.moveX =  1; s.moveY = 0;  break
    // diagonals
    case "y": s.moveX = -1; s.moveY = -1; break
    case "u": s.moveX =  1; s.moveY = -1; break
    case "b": s.moveX = -1; s.moveY =  1; break
    case "n": s.moveX =  1; s.moveY =  1; break
    // actions
    case "space":  s.ability  = true; isMoveKey = false; break
    case "e":      s.interact = true; isMoveKey = false; break
    case "tab":    s.map      = true; isMoveKey = false; break
    case "escape": s.pause    = true; isMoveKey = false; break
    case "return": s.confirm  = true; isMoveKey = false; break
    default: isMoveKey = false
  }
  if (isMoveKey) s.moveRefresh = performance.now()
}
