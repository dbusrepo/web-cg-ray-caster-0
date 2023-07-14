import type { WasmModules, WasmEngineModule } from '../wasmEngine/wasmLoader';
import { gWasmRun, gWasmView } from '../wasmEngine/wasmRun';

class Viewport {
  constructor(
    private viewportPtr: number,
    private startXPtr: number,
    private startYPtr: number,
    private widthPtr: number,
    private heightPtr: number,
  ) {}

  get WasmPtr(): number {
    return this.viewportPtr;
  }

  get StartX(): number {
    return gWasmView.getUint16(this.startXPtr, true);
  }

  set StartX(value: number) {
    gWasmView.setUint16(this.startXPtr, value, true);
  }

  get StartY(): number {
    return gWasmView.getUint16(this.startYPtr, true);
  }

  set StartY(value: number) {
    gWasmView.setUint16(this.startYPtr, value, true);
  }

  get Width(): number {
    return gWasmView.getUint16(this.widthPtr, true);
  }

  set Width(value: number) {
    gWasmView.setUint16(this.widthPtr, value, true);
  }

  get Height(): number {
    return gWasmView.getUint16(this.heightPtr, true);
  }

  set Height(value: number) {
    gWasmView.setUint16(this.heightPtr, value, true);
  }
}

function getWasmViewportView(
  wasmEngineModule: WasmEngineModule,
  wasmRaycasterPtr: number,
): Viewport {
  const viewportPtr = wasmEngineModule.getViewportPtr(wasmRaycasterPtr);
  const startXPtr = wasmEngineModule.getViewportStartXPtr(viewportPtr);
  const startYPtr = wasmEngineModule.getViewportStartYPtr(viewportPtr);
  const widthPtr = wasmEngineModule.getViewportWidthPtr(viewportPtr);
  const heightPtr = wasmEngineModule.getViewportHeightPtr(viewportPtr);
  const viewport = new Viewport(
    viewportPtr,
    startXPtr,
    startYPtr,
    widthPtr,
    heightPtr,
  );
  return viewport;
}

export { Viewport, getWasmViewportView };
