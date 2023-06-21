import type { WasmModules } from '../wasmEngine/wasmLoader';

class Viewport {
  private uint16: Uint16Array;
  private view: DataView;

  constructor(
    wasmMemBuffer: ArrayBuffer,
    viewportPtr: number,
    private startXoffset: number, 
    private startYoffset: number,
    private widthOffset: number,
    private heightOffset: number) {
    this.uint16 = new Uint16Array(wasmMemBuffer, viewportPtr);
    this.view = new DataView(wasmMemBuffer, viewportPtr);
  }

  get startX(): number {
    return this.view.getUint16(this.startXoffset, true);
    // return Atomics.load(this.uint16, this.startXoffset);
  }

  set startX(value: number) {
    this.view.setUint16(this.startXoffset, value, true);
    // Atomics.store(this.uint16, this.startXoffset, value);
  }

  get startY(): number {
    return this.view.getUint16(this.startYoffset, true);
    // return Atomics.load(this.uint16, this.startYoffset);
  }

  set startY(value: number) {
    this.view.setUint16(this.startYoffset, value, true);
    // Atomics.store(this.uint16, this.startYoffset, value);
  }

  get width(): number {
    return this.view.getUint16(this.widthOffset, true);
    // return Atomics.load(this.uint16, this.widthOffset);
  }

  set width(value: number) {
    this.view.setUint16(this.widthOffset, value, true);
    // Atomics.store(this.uint16, this.widthOffset, value);
  }

  get height(): number {
    return this.view.getUint16(this.heightOffset, true);
    // return Atomics.load(this.uint16, this.heightOffset);
  }

  set height(value: number) {
    this.view.setUint16(this.heightOffset, value, true);
    // Atomics.store(this.uint16, this.heightOffset, value);
  }

  get Ptr(): number {
    return this.uint16.byteOffset;
  }
}

function getWasmViewport(wasmModules: WasmModules, wasmMemBuffer: ArrayBuffer): Viewport {
  const viewportPtr = wasmModules.engine.getViewPort();
  console.log('viewportPtr', viewportPtr);
  const startXoffset = wasmModules.engine.getViewportStartXOffset();
  const startYoffset = wasmModules.engine.getViewportStartYOffset();
  const widthOffset = wasmModules.engine.getViewportWidthOffset();
  const heightOffset = wasmModules.engine.getViewportHeightOffset();
  const viewport = new Viewport(wasmMemBuffer, viewportPtr, startXoffset, startYoffset, widthOffset, heightOffset);
  return viewport;
}

export type { Viewport };
export { getWasmViewport };
