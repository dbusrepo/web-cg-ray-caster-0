import { gWasmRun, gWasmView } from '../wasmEngine/wasmRun';

class Viewport {
  constructor(
    private viewportPtr: number,
    private startXoffset: number, 
    private startYoffset: number,
    private widthOffset: number,
    private heightOffset: number) {
    this.startXoffset = viewportPtr + startXoffset;
    this.startYoffset = viewportPtr + startYoffset;
    this.widthOffset = viewportPtr + widthOffset;
    this.heightOffset = viewportPtr + heightOffset;
  }

  get Ptr(): number {
    return this.viewportPtr;
  }

  get StartX(): number {
    return gWasmView.getUint16(this.startXoffset, true);
  }

  set StartX(value: number) {
    gWasmView.setUint16(this.startXoffset, value, true);
  }

  get StartY(): number {
    return gWasmView.getUint16(this.startYoffset, true);
  }

  set StartY(value: number) {
    gWasmView.setUint16(this.startYoffset, value, true);
  }

  get Width(): number {
    return gWasmView.getUint16(this.widthOffset, true);
  }

  set Width(value: number) {
    gWasmView.setUint16(this.widthOffset, value, true);
  }

  get Height(): number {
    return gWasmView.getUint16(this.heightOffset, true);
  }

  set Height(value: number) {
    gWasmView.setUint16(this.heightOffset, value, true);
  }
}

function getWasmViewport(): Viewport {
  const wasmEngine = gWasmRun.WasmModules.engine;
  const viewportPtr = wasmEngine.getViewPortPtr();
  const startXoffset = wasmEngine.getViewportStartXOffset();
  const startYoffset = wasmEngine.getViewportStartYOffset();
  const widthOffset = wasmEngine.getViewportWidthOffset();
  const heightOffset = wasmEngine.getViewportHeightOffset();
  const viewport = new Viewport(viewportPtr, startXoffset, startYoffset, widthOffset, heightOffset);
  return viewport;
}

export type { Viewport };
export { getWasmViewport };
