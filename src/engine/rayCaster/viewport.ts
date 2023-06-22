import { gWasmRun } from '../wasmEngine/wasmRun';

class Viewport {
  constructor(
    // wasmMemBuffer: ArrayBuffer,
    private viewportPtr: number,
    private startXoffset: number, 
    private startYoffset: number,
    private widthOffset: number,
    private heightOffset: number) {
    this.startXoffset = viewportPtr + startXoffset;
    this.startYoffset = viewportPtr + startYoffset;
    this.widthOffset = viewportPtr + widthOffset;
    this.heightOffset = viewportPtr + heightOffset;
    // this.uint16 = new Uint16Array(wasmMemBuffer, viewportPtr);
    // this.view = new DataView(wasmMemBuffer, viewportPtr);
  }

  get StartX(): number {
    return gWasmRun.WasmViews.view.getUint16(this.startXoffset, true);
  }

  set StartX(value: number) {
    gWasmRun.WasmViews.view.setUint16(this.startXoffset, value, true);
  }

  get StartY(): number {
    return gWasmRun.WasmViews.view.getUint16(this.startYoffset, true);
  }

  set StartY(value: number) {
    gWasmRun.WasmViews.view.setUint16(this.startYoffset, value, true);
  }

  get Width(): number {
    return gWasmRun.WasmViews.view.getUint16(this.widthOffset, true);
  }

  set Width(value: number) {
    gWasmRun.WasmViews.view.setUint16(this.widthOffset, value, true);
  }

  get Height(): number {
    return gWasmRun.WasmViews.view.getUint16(this.heightOffset, true);
  }

  set Height(value: number) {
    gWasmRun.WasmViews.view.setUint16(this.heightOffset, value, true);
  }

  get Ptr(): number {
    return this.viewportPtr;
  }
}

function getWasmViewport(): Viewport {
  const wasmModules = gWasmRun.WasmModules;
  const viewportPtr = wasmModules.engine.getViewPort();
  // console.log('viewportPtr', viewportPtr); // TODO:
  // console.log('Limit: ', gWasmRun.WasmViews.view.byteOffset + gWasmRun.WasmViews.view.byteLength);
  const startXoffset = wasmModules.engine.getViewportStartXOffset();
  const startYoffset = wasmModules.engine.getViewportStartYOffset();
  const widthOffset = wasmModules.engine.getViewportWidthOffset();
  const heightOffset = wasmModules.engine.getViewportHeightOffset();
  const viewport = new Viewport(viewportPtr, startXoffset, startYoffset, widthOffset, heightOffset);
  return viewport;
}

export type { Viewport };
export { getWasmViewport };
