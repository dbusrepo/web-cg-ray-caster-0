import type { WasmModules, WasmEngineModule } from '../wasmEngine/wasmLoader';
import { gWasmRun, gWasmView } from '../wasmEngine/wasmRun';

class WallSlice {
  constructor(
    // private wallSlicePtr: number,
    private colIdxPtr: number,
    private topPtr: number,
    private bottomPtr: number,
    private texXPtr: number,
    private texStepYPtr: number,
    private texPosYPtr: number,
    private texIdPtr: number,
    private mipLvlPtr: number,
  ) {}

  // get WallSlicePtr(): number {
  //   return this.wallSlicePtr;
  // }

  get ColIdx(): number {
    return gWasmView.getUint16(this.colIdxPtr, true);
  }

  set ColIdx(colIdx: number) {
    gWasmView.setUint16(this.colIdxPtr, colIdx, true);
  }

  get Top(): number {
    return gWasmView.getUint16(this.topPtr, true);
  }

  set Top(top: number) {
    gWasmView.setUint16(this.topPtr, top, true);
  }

  get Bottom(): number {
    return gWasmView.getUint16(this.bottomPtr, true);
  }

  set Bottom(bottom: number) {
    gWasmView.setUint16(this.bottomPtr, bottom, true);
  }

  get TexX(): number {
    return gWasmView.getUint16(this.texXPtr, true);
  }

  set TexX(texX: number) {
    gWasmView.setUint16(this.texXPtr, texX, true);
  }

  get TexStepY(): number {
    return gWasmView.getFloat64(this.texStepYPtr, true);
  }

  set TexStepY(texStepY: number) {
    gWasmView.setFloat64(this.texStepYPtr, texStepY, true);
  }

  get TexPosY(): number {
    return gWasmView.getFloat64(this.texPosYPtr, true);
  }
  
  set TexPosY(texPosY: number) {
    gWasmView.setFloat64(this.texPosYPtr, texPosY, true);
  }

  get TexId(): number {
    return gWasmView.getUint16(this.texIdPtr, true);
  }

  set TexId(texId: number) {
    gWasmView.setUint16(this.texIdPtr, texId, true);
  }

  get MipLvl(): number {
    return gWasmView.getUint8(this.mipLvlPtr);
  }

  set MipLvl(mipLvl: number) {
    gWasmView.setUint8(this.mipLvlPtr, mipLvl);
  }
}

function getWasmWallSlicesView(wasmEngineModule: WasmEngineModule, wasmRaycasterPtr: number, numColumns: number): WallSlice[] {
  const wallSlicesPtr = wasmEngineModule.getWallSlicesPtr(wasmRaycasterPtr);
  const wallSliceObjSizeLg2 = wasmEngineModule.getWallSliceObjSizeLg2(wasmRaycasterPtr);
  const wallSlices = new Array<WallSlice>(numColumns);
  for (let i = 0; i < numColumns; i++) {
    const wallSlicePtr = wallSlicesPtr + (i << wallSliceObjSizeLg2);
    wallSlices[i] = new WallSlice(
      // wallSlicePtr,
      wasmEngineModule.getWallSliceColIdxPtr(wallSlicePtr),
      wasmEngineModule.getWallSliceTopPtr(wallSlicePtr),
      wasmEngineModule.getWallSliceBottomPtr(wallSlicePtr),
      wasmEngineModule.getWallSliceTexXPtr(wallSlicePtr),
      wasmEngineModule.getWallSliceTexStepYPtr(wallSlicePtr),
      wasmEngineModule.getWallSliceTexPosYPtr(wallSlicePtr),
      wasmEngineModule.getWallSliceTexIdPtr(wallSlicePtr),
      wasmEngineModule.getWallSliceMipLvlPtr(wallSlicePtr),
    );
  }
  return wallSlices;
}

export { WallSlice, getWasmWallSlicesView };
