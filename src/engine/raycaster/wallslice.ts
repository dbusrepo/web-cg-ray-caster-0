import type { WasmModules, WasmEngineModule } from '../wasmEngine/wasmLoader';
import { BitImageRGBA } from '../assets/images/bitImageRGBA';
import { gWasmRun, gWasmView } from '../wasmEngine/wasmRun';

class WallSlice {
  private cachedMipmap: BitImageRGBA;

  constructor(
    // private wallSlicePtr: number,
    private distancePtr: number,
    private hitPtr: number,
    private sidePtr: number,
    private topPtr: number,
    private bottomPtr: number,
    private texXPtr: number,
    private texStepYPtr: number,
    private texPosYPtr: number,
    private texIdPtr: number,
    private mipLvlPtr: number,
    private floorWallX: number,
    private floorWallY: number,
  ) {}

  get CachedMipmap(): BitImageRGBA {
    return this.cachedMipmap;
  }

  set CachedMipmap(cachedMipmap: BitImageRGBA) {
    this.cachedMipmap = cachedMipmap;
  }

  // get WallSlicePtr(): number {
  //   return this.wallSlicePtr;
  // }

  get Distance(): number {
    return gWasmView.getFloat64(this.distancePtr, true);
  }

  set Distance(distance: number) {
    gWasmView.setFloat64(this.distancePtr, distance, true);
  }

  get Hit(): number {
    return gWasmView.getUint8(this.hitPtr);
  }

  set Hit(hit: number) {
    gWasmView.setUint8(this.hitPtr, hit);
  }

  set Side(side: number) {
    gWasmView.setUint8(this.sidePtr, side);
  }

  get Side(): number {
    return gWasmView.getUint8(this.sidePtr);
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

  get FloorWallX(): number {
    return gWasmView.getFloat64(this.floorWallX, true);
  }

  set FloorWallX(floorWallX: number) {
    gWasmView.setFloat64(this.floorWallX, floorWallX, true);
  }

  get FloorWallY(): number {
    return gWasmView.getFloat64(this.floorWallY, true);
  }

  set FloorWallY(floorWallY: number) {
    gWasmView.setFloat64(this.floorWallY, floorWallY, true);
  }
}

function getWasmWallSlicesView(
  wasmEngineModule: WasmEngineModule,
  wasmRaycasterPtr: number,
  numColumns: number,
): WallSlice[] {
  const wallSlicesPtr = wasmEngineModule.getWallSlicesPtr(wasmRaycasterPtr);
  const wallSliceObjSizeLg2 =
    wasmEngineModule.getWallSliceObjSizeLg2(wasmRaycasterPtr);
  const wallSlices = new Array<WallSlice>(numColumns);
  for (let i = 0; i < numColumns; i++) {
    const wallSlicePtr = wallSlicesPtr + (i << wallSliceObjSizeLg2);
    wallSlices[i] = new WallSlice(
      // wallSlicePtr,
      wasmEngineModule.getWallSliceDistancePtr(wallSlicePtr),
      wasmEngineModule.getWallSliceHitPtr(wallSlicePtr),
      wasmEngineModule.getWallSliceSidePtr(wallSlicePtr),
      wasmEngineModule.getWallSliceTopPtr(wallSlicePtr),
      wasmEngineModule.getWallSliceBottomPtr(wallSlicePtr),
      wasmEngineModule.getWallSliceTexXPtr(wallSlicePtr),
      wasmEngineModule.getWallSliceTexStepYPtr(wallSlicePtr),
      wasmEngineModule.getWallSliceTexPosYPtr(wallSlicePtr),
      wasmEngineModule.getWallSliceTexIdPtr(wallSlicePtr),
      wasmEngineModule.getWallSliceMipLvlPtr(wallSlicePtr),
      wasmEngineModule.getWallSliceFloorWallXPtr(wallSlicePtr),
      wasmEngineModule.getWallSliceFloorWallYPtr(wallSlicePtr),
    );
  }
  return wallSlices;
}

export { WallSlice, getWasmWallSlicesView };
