export interface RGB { r: number; g: number; b: number }

export const C = {
  bg:          { r: 4,   g: 6,   b: 14  },
  navyMid:     { r: 8,   g: 12,  b: 28  },
  pink:        { r: 255, g: 60,  b: 160 },
  cyan:        { r: 60,  g: 200, b: 255 },
  gold:        { r: 255, g: 210, b: 80  },
  purple:      { r: 150, g: 90,  b: 255 },
  green:       { r: 80,  g: 255, b: 140 },
  red:         { r: 255, g: 50,  b: 50  },
  orange:      { r: 255, g: 140, b: 30  },
  white:       { r: 255, g: 255, b: 255 },
  dimText:     { r: 100, g: 120, b: 170 },
  hudBg:       { r: 6,   g: 8,   b: 18  },
  // class palettes
  warrior:     { r: 255, g: 120, b: 40  },
  mage:        { r: 80,  g: 160, b: 255 },
  archer:      { r: 80,  g: 230, b: 180 },
  necromancer: { r: 140, g: 80,  b: 255 },
  paladin:     { r: 255, g: 220, b: 80  },
  rogue:       { r: 200, g: 80,  b: 255 },
  druid:       { r: 100, g: 220, b: 80  },
} as const

export function lerp(a: RGB, b: RGB, t: number): RGB {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t }
}

export function scale(c: RGB, s: number): RGB {
  return { r: c.r * s, g: c.g * s, b: c.b * s }
}
