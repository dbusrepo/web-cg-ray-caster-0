import type { WasmModules, WasmEngineModule } from '../wasmEngine/wasmLoader';
import { BitImageRGBA } from '../assets/images/bitImageRGBA';
import { gWasmRun, gWasmView } from '../wasmEngine/wasmRun';

class WallSlice {
  private mipmap: BitImageRGBA; // ts cached fields
  public projHeight: number;
  public clipTop: number;

  constructor(
    // private wallSlicePtr: number,
    private distancePtr: number,
    private hitPtr: number,
    private sidePtr: number,
    private topPtr: number,
    private bottomPtr: number,
    private mipMapIdxPtr: number,
    private texXPtr: number,
    private texStepYPtr: number,
    private texYPtr: number,
    private floorWallXPtr: number,
    private floorWallYPtr: number,
  ) {}

  get Mipmap(): BitImageRGBA {
    return this.mipmap;
  }

  set Mipmap(mipmap: BitImageRGBA) {
    this.mipmap = mipmap;
  }

  get MipMapIdx(): number {
    return gWasmView.getUint32(this.mipMapIdxPtr, true);
  }

  set MipMapIdx(mipMapIdx: number) {
    gWasmView.setUint32(this.mipMapIdxPtr, mipMapIdx, true);
  }

  // get WallSlicePtr(): number {
  //   return this.wallSlicePtr;
  // }

  get Distance(): number {
    return gWasmView.getFloat32(this.distancePtr, true);
  }

  set Distance(distance: number) {
    gWasmView.setFloat32(this.distancePtr, distance, true);
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
    return gWasmView.getUint32(this.topPtr, true);
  }

  set Top(top: number) {
    gWasmView.setUint32(this.topPtr, top, true);
  }

  get Bottom(): number {
    return gWasmView.getUint32(this.bottomPtr, true);
  }

  set Bottom(bottom: number) {
    gWasmView.setUint32(this.bottomPtr, bottom, true);
  }

  get TexX(): number {
    return gWasmView.getUint32(this.texXPtr, true);
  }

  set TexX(texX: number) {
    gWasmView.setUint32(this.texXPtr, texX, true);
  }

  get TexStepY(): number {
    return gWasmView.getFloat32(this.texStepYPtr, true);
  }

  set TexStepY(texStepY: number) {
    gWasmView.setFloat32(this.texStepYPtr, texStepY, true);
  }

  get TexY(): number {
    return gWasmView.getFloat32(this.texYPtr, true);
  }

  set TexY(texY: number) {
    gWasmView.setFloat32(this.texYPtr, texY, true);
  }

  get FloorWallX(): number {
    return gWasmView.getFloat32(this.floorWallXPtr, true);
  }

  set FloorWallX(floorWallX: number) {
    gWasmView.setFloat32(this.floorWallXPtr, floorWallX, true);
  }

  get FloorWallY(): number {
    return gWasmView.getFloat32(this.floorWallYPtr, true);
  }

  set FloorWallY(floorWallY: number) {
    gWasmView.setFloat32(this.floorWallYPtr, floorWallY, true);
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
      wasmEngineModule.getWallSliceMipMapIdxPtr(wallSlicePtr),
      wasmEngineModule.getWallSliceTexXPtr(wallSlicePtr),
      wasmEngineModule.getWallSliceTexStepYPtr(wallSlicePtr),
      wasmEngineModule.getWallSliceTexYPtr(wallSlicePtr),
      wasmEngineModule.getWallSliceFloorWallXPtr(wallSlicePtr),
      wasmEngineModule.getWallSliceFloorWallYPtr(wallSlicePtr),
    );
  }
  return wallSlices;
}

export { WallSlice, getWasmWallSlicesView };
