import assert from 'assert';
import type { WasmModules, WasmEngineModule } from '../wasmEngine/wasmLoader';
import { BitImageRGBA } from '../assets/images/bitImageRGBA';
import { gWasmRun, gWasmView, WASM_NULL_PTR } from '../wasmEngine/wasmRun';

class Slice {
  private mipmap: BitImageRGBA; // ts cached fields
  private next: Slice | null = null;
  private prev: Slice | null = null;

  constructor(
    private slicePtr: number,
    private distancePtr: number,
    private heightPtr: number,
    private clipTopPtr: number,
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
    private prevPtrPtr: number,
    private nextPtrPtr: number,
  ) {}

  init(
    slicePtr: number,
    distancePtr: number,
    heightPtr: number,
    clipTopPtr: number,
    hitPtr: number,
    sidePtr: number,
    topPtr: number,
    bottomPtr: number,
    mipMapIdxPtr: number,
    texXPtr: number,
    texStepYPtr: number,
    texYPtr: number,
    floorWallXPtr: number,
    floorWallYPtr: number,
    prevPtrPtr: number,
    nextPtrPtr: number,
  ) {
    this.slicePtr = slicePtr;
    this.distancePtr = distancePtr;
    this.heightPtr = heightPtr;
    this.clipTopPtr = clipTopPtr;
    this.hitPtr = hitPtr;
    this.sidePtr = sidePtr;
    this.topPtr = topPtr;
    this.bottomPtr = bottomPtr;
    this.mipMapIdxPtr = mipMapIdxPtr;
    this.texXPtr = texXPtr;
    this.texStepYPtr = texStepYPtr;
    this.texYPtr = texYPtr;
    this.floorWallXPtr = floorWallXPtr;
    this.floorWallYPtr = floorWallYPtr;
    this.prevPtrPtr = prevPtrPtr;
    this.nextPtrPtr = nextPtrPtr;
  }

  get Prev(): Slice | null {
    return this.prev;
  }

  set Prev(prev: Slice | null) {
    this.prev = prev;
    gWasmView.setUint32(
      this.prevPtrPtr,
      prev ? prev.WasmPtr : WASM_NULL_PTR,
      true,
    );
  }

  get Next(): Slice | null {
    return this.next;
  }

  set Next(next: Slice | null) {
    this.next = next;
    gWasmView.setUint32(
      this.nextPtrPtr,
      next ? next.WasmPtr : WASM_NULL_PTR,
      true,
    );
  }

  get WasmPtr(): number {
    return this.slicePtr;
  }

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

  get Height(): number {
    return gWasmView.getUint32(this.heightPtr, true);
  }

  set Height(projHeight: number) {
    gWasmView.setUint32(this.heightPtr, projHeight, true);
  }

  get ClipTop(): number {
    return gWasmView.getUint32(this.clipTopPtr, true);
  }

  set ClipTop(clipTop: number) {
    gWasmView.setUint32(this.clipTopPtr, clipTop, true);
  }

  get PrevPtr(): number {
    return gWasmView.getUint32(this.prevPtrPtr, true);
  }

  set PrevPtr(prevPtr: number) {
    gWasmView.setUint32(this.prevPtrPtr, prevPtr, true);
  }

  get NextPtr(): number {
    return gWasmView.getUint32(this.nextPtrPtr, true);
  }

  set NextPtr(nextPtr: number) {
    gWasmView.setUint32(this.nextPtrPtr, nextPtr, true);
  }
}

let freeList: Slice | null = null;

const newSliceView = (wasmEngineModule: WasmEngineModule) => {
  let sliceView;
  if (freeList) {
    sliceView = freeList;
    freeList = freeList.Next;
  } else {
    const slicePtr = wasmEngineModule.allocSlice();
    sliceView = createSliceView(wasmEngineModule, slicePtr);
  }
  // wsliceView.Next = null;
  // wsliceView.Prev = null;
  return sliceView;
};

const freeSliceView = (slice: Slice) => {
  slice.Next = freeList;
  freeList = slice;
};

const freeTranspSliceViewsList = (slice: Slice) => {
  // double linked list, add to free list in O(1)
  const { Prev: prev } = slice;
  // assert(prev);
  prev!.Next = freeList;
  freeList = slice;
};

function createSliceView(wasmEngineModule: WasmEngineModule, slicePtr: number) {
  return new Slice(
    slicePtr,
    wasmEngineModule.getSliceDistancePtr(slicePtr),
    wasmEngineModule.getSliceHeightPtr(slicePtr),
    wasmEngineModule.getSliceClipTopPtr(slicePtr),
    wasmEngineModule.getSliceHitPtr(slicePtr),
    wasmEngineModule.getSliceSidePtr(slicePtr),
    wasmEngineModule.getSliceTopPtr(slicePtr),
    wasmEngineModule.getSliceBottomPtr(slicePtr),
    wasmEngineModule.getSliceMipMapIdxPtr(slicePtr),
    wasmEngineModule.getSliceTexXPtr(slicePtr),
    wasmEngineModule.getSliceTexStepYPtr(slicePtr),
    wasmEngineModule.getSliceTexYPtr(slicePtr),
    wasmEngineModule.getSliceFloorWallXPtr(slicePtr),
    wasmEngineModule.getSliceFloorWallYPtr(slicePtr),
    wasmEngineModule.getSlicePrevPtrPtr(slicePtr),
    wasmEngineModule.getSliceNextPtrPtr(slicePtr),
  );
}

function getWasmWallSlicesView(
  wasmEngineModule: WasmEngineModule,
  wasmRaycasterPtr: number,
): Slice[] {
  const numWallSlices = wasmEngineModule.getWallSlicesLength(wasmRaycasterPtr);
  const wallSlices = new Array<Slice>(numWallSlices);
  for (let i = 0; i < numWallSlices; i++) {
    const wallSlicePtr = wasmEngineModule.getWallSlicePtr(wasmRaycasterPtr, i);
    wallSlices[i] = createSliceView(wasmEngineModule, wallSlicePtr);
  }
  return wallSlices;
}

export {
  Slice,
  getWasmWallSlicesView,
  newSliceView,
  freeSliceView,
  freeTranspSliceViewsList,
};
