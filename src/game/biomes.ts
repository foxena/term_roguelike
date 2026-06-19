export interface BiomeDef {
  id: string
  name: string
  // Colour overrides for room rendering (bg/wall/floor)
  bgR: number; bgG: number; bgB: number
  wallR: number; wallG: number; wallB: number
  floorR: number; floorG: number; floorB: number
  ambientR: number; ambientG: number; ambientB: number  // ambient glow tint
  // Enemy type weights override
  enemyWeights: number[]   // [chaser, swarmer, brute, shooter, exploder]
  hazard?: "lava" | "ice" | "void"  // future hazard hook
  musicMood: "dark" | "tense" | "eerie" | "boss"
}

export const BIOMES: BiomeDef[] = [
  {
    id: "neon_dungeon", name: "Neon Dungeon",
    bgR:4, bgG:6, bgB:14,  wallR:30, wallG:40, wallB:90,  floorR:8, floorG:10, floorB:22,
    ambientR:60, ambientG:80, ambientB:200,
    enemyWeights: [50, 30, 10, 8, 2], musicMood: "dark",
  },
  {
    id: "crimson_abyss", name: "Crimson Abyss",
    bgR:14, bgG:3, bgB:3,  wallR:90, wallG:20, wallB:20,  floorR:22, floorG:6, floorB:6,
    ambientR:200, ambientG:40, ambientB:40,
    enemyWeights: [30, 20, 25, 15, 10], musicMood: "tense",
  },
  {
    id: "void_rift", name: "Void Rift",
    bgR:2, bgG:2, bgB:14,  wallR:60, wallG:20, wallB:140,  floorR:8, floorG:6, floorB:28,
    ambientR:120, ambientG:40, ambientB:255,
    enemyWeights: [25, 40, 10, 20, 5], musicMood: "eerie",
  },
  {
    id: "poison_swamp", name: "Toxic Swamp",
    bgR:3, bgG:12, bgB:5,  wallR:20, wallG:60, wallB:20,  floorR:6, floorG:20, floorB:8,
    ambientR:40, ambientG:200, ambientB:60,
    enemyWeights: [40, 35, 5, 10, 10], musicMood: "eerie",
  },
  {
    id: "glacier", name: "Frozen Core",
    bgR:5, bgG:10, bgB:20,  wallR:60, wallG:120, wallB:200,  floorR:14, floorG:28, floorB:50,
    ambientR:100, ambientG:180, ambientB:255,
    enemyWeights: [20, 15, 40, 20, 5], musicMood: "dark",
  },
]

export function getBiome(floorNum: number): BiomeDef {
  const idx = (floorNum - 1) % BIOMES.length
  return BIOMES[idx]
}
