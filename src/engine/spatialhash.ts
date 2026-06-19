/** Broad-phase spatial hash for circle-vs-circle queries. Cell size should be ~2× largest entity radius. */
export class SpatialHash {
  private cells = new Map<number, number[]>()
  private cellSize: number

  constructor(cellSize = 20) { this.cellSize = cellSize }

  private key(cx: number, cy: number): number { return cx * 100003 + cy }

  clear(): void { this.cells.clear() }

  insert(id: number, x: number, y: number, r: number): void {
    const cs = this.cellSize
    const x0 = Math.floor((x - r) / cs), x1 = Math.floor((x + r) / cs)
    const y0 = Math.floor((y - r) / cs), y1 = Math.floor((y + r) / cs)
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const k = this.key(cx, cy)
        let cell = this.cells.get(k)
        if (!cell) { cell = []; this.cells.set(k, cell) }
        cell.push(id)
      }
    }
  }

  /** Yield candidates near (x, y, r). May include duplicates. */
  query(x: number, y: number, r: number, out: number[]): void {
    out.length = 0
    const cs = this.cellSize
    const x0 = Math.floor((x - r) / cs), x1 = Math.floor((x + r) / cs)
    const y0 = Math.floor((y - r) / cs), y1 = Math.floor((y + r) / cs)
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const cell = this.cells.get(this.key(cx, cy))
        if (cell) for (const id of cell) out.push(id)
      }
    }
  }
}
