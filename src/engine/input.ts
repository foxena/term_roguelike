export interface InputState {
  // held movement (WASD / HJKL / arrows)
  moveX: number   // -1 0 1
  moveY: number   // -1 0 1
  // aim direction (arrow keys for ranged classes)
  aimX: number
  aimY: number
  // button presses (consumed on read)
  ability: boolean    // Space
  interact: boolean   // E
  map: boolean        // Tab
  pause: boolean      // Esc
  confirm: boolean    // Enter
  // raw for menus
  raw: string
}

export function makeInput(): InputState {
  return { moveX: 0, moveY: 0, aimX: 0, aimY: 1, ability: false, interact: false, map: false, pause: false, confirm: false, raw: "" }
}

export function clearInputFrame(s: InputState): void {
  s.ability = false
  s.interact = false
  s.map = false
  s.pause = false
  s.confirm = false
  s.raw = ""
}

/** Apply a raw keyName string to the input state. */
export function applyKey(s: InputState, name: string, held: Map<string, boolean>): void {
  s.raw = name
  switch (name) {
    // movement
    case "w": case "up":    case "k": held.set("up",    true); break
    case "s": case "down":  case "j": held.set("down",  true); break
    case "a": case "left":  case "h": held.set("left",  true); break
    case "d": case "right": case "l": held.set("right", true); break
    case "y": held.set("upleft",    true); break
    case "u": held.set("upright",   true); break
    case "b": held.set("downleft",  true); break
    case "n": held.set("downright", true); break
    // actions
    case "space":  s.ability  = true; break
    case "e":      s.interact = true; break
    case "tab":    s.map      = true; break
    case "escape": s.pause    = true; break
    case "return": s.confirm  = true; break
  }
  syncDirs(s, held)
}

export function releaseKey(s: InputState, name: string, held: Map<string, boolean>): void {
  switch (name) {
    case "w": case "up":    case "k": held.delete("up");        break
    case "s": case "down":  case "j": held.delete("down");      break
    case "a": case "left":  case "h": held.delete("left");      break
    case "d": case "right": case "l": held.delete("right");     break
    case "y": held.delete("upleft");    break
    case "u": held.delete("upright");   break
    case "b": held.delete("downleft");  break
    case "n": held.delete("downright"); break
  }
  syncDirs(s, held)
}

function syncDirs(s: InputState, held: Map<string, boolean>): void {
  let mx = 0, my = 0
  if (held.has("left")  || held.has("upleft")   || held.has("downleft"))  mx -= 1
  if (held.has("right") || held.has("upright")  || held.has("downright")) mx += 1
  if (held.has("up")    || held.has("upleft")   || held.has("upright"))   my -= 1
  if (held.has("down")  || held.has("downleft") || held.has("downright")) my += 1
  s.moveX = mx
  s.moveY = my
}
