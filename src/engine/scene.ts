import type { PixelCanvas } from "./pixelcanvas.ts"
import type { OptimizedBuffer } from "@opentui/core"
import type { InputState } from "./input.ts"

export interface Scene {
  update(dt: number, input: InputState): void
  draw(canvas: PixelCanvas, buffer: OptimizedBuffer, canvasW: number, canvasH: number): void
  onEnter?(): void
  onExit?(): void
}

export class SceneStack {
  private stack: Scene[] = []

  push(scene: Scene): void {
    this.stack.at(-1)?.onExit?.()
    this.stack.push(scene)
    scene.onEnter?.()
  }

  pop(): void {
    this.stack.pop()?.onExit?.()
    this.stack.at(-1)?.onEnter?.()
  }

  replace(scene: Scene): void {
    this.stack.pop()?.onExit?.()
    this.stack.push(scene)
    scene.onEnter?.()
  }

  update(dt: number, input: InputState): void {
    this.stack.at(-1)?.update(dt, input)
  }

  draw(canvas: PixelCanvas, buffer: OptimizedBuffer, w: number, h: number): void {
    this.stack.at(-1)?.draw(canvas, buffer, w, h)
  }

  get current(): Scene | undefined { return this.stack.at(-1) }
}
