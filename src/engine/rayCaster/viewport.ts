import type { WasmModules } from '../wasmEngine/wasmLoader';

class Viewport {

  constructor(
    private uint16: Uint16Array,
    private startXoffset: number, 
    private startYoffset: number,
    private widthOffset: number,
    private heightOffset: number) {}

  get startX(): number {
    return Atomics.load(this.uint16, this.startXoffset);
  }

  set startX(value: number) {
    Atomics.store(this.uint16, this.startXoffset, value);
  }

  get startY(): number {
    return Atomics.load(this.uint16, this.startYoffset);
  }

  set startY(value: number) {
    Atomics.store(this.uint16, this.startYoffset, value);
  }

  get width(): number {
    return Atomics.load(this.uint16, this.widthOffset);
  }

  set width(value: number) {
    Atomics.store(this.uint16, this.widthOffset, value);
  }

  get height(): number {
    return Atomics.load(this.uint16, this.heightOffset);
  }

  set height(value: number) {
    Atomics.store(this.uint16, this.heightOffset, value);
  }
}

function getWasmViewport(wasmModules: WasmModules, wasmMemBuffer: ArrayBuffer): Viewport {
  const viewportPtr = wasmModules.engine.getViewPort();
  console.log('viewportPtr', viewportPtr);
  const uint16 = new Uint16Array(wasmMemBuffer, viewportPtr);
  const startXoffset = wasmModules.engine.getViewportStartXOffset();
  const startYoffset = wasmModules.engine.getViewportStartYOffset();
  const widthOffset = wasmModules.engine.getViewportWidthOffset();
  const heightOffset = wasmModules.engine.getViewportHeightOffset();
  const viewport = new Viewport(uint16, startXoffset, startYoffset, widthOffset, heightOffset);
  return viewport;
}

export type { Viewport };
export { getWasmViewport };
