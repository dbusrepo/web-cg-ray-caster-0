import assert from 'assert';
import type { WasmModules, WasmEngineModule } from '../wasmEngine/wasmLoader';
import { BitImageRGBA } from '../assets/images/bitImageRGBA';
import type { WasmNullPtr } from '../wasmEngine/wasmRun';
import { gWasmRun, gWasmView, WASM_NULL_PTR } from '../wasmEngine/wasmRun';

type SliceRef = Slice | null;

class Slice {
  private mipmap: BitImageRGBA;

  constructor(
    private slicePtr: number,
    private distancePtr: number,
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
    private isSpritePtr: number,
  ) {}

  init(
    slicePtr: number,
    distancePtr: number,
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
    isSpritePtr: number,
  ) {
    this.slicePtr = slicePtr;
    this.distancePtr = distancePtr;
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
    this.isSpritePtr = isSpritePtr;
  }

  get WasmPtr(): number {
    return this.slicePtr;
  }

  get Prev(): SliceRef {
    return this.PrevPtr === WASM_NULL_PTR ? null : getSliceView(this.PrevPtr);
  }

  set Prev(prev: SliceRef) {
    this.PrevPtr = prev ? prev.WasmPtr : WASM_NULL_PTR;
  }

  get Next(): SliceRef {
    return this.NextPtr === WASM_NULL_PTR ? null : getSliceView(this.NextPtr);
  }

  set Next(next: SliceRef) {
    this.NextPtr = next ? next.WasmPtr : WASM_NULL_PTR;
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

  get IsSprite(): boolean {
    return gWasmView.getUint8(this.isSpritePtr) !== 0;
  }

  set IsSprite(isSprite: boolean) {
    gWasmView.setUint8(this.isSpritePtr, isSprite ? 1 : 0);
  }
}

let freeList: SliceRef = null;

const newSliceView = () => {
  const wasmEngineModule = gWasmRun.WasmModules.engine;
  let sliceView;
  if (freeList) {
    sliceView = freeList;
    freeList = freeList.Next;
  } else {
    const slicePtr = wasmEngineModule.allocSlice();
    sliceView = getSliceView(slicePtr);
  }
  sliceView.Next = sliceView.Prev = null;
  return sliceView;
};

const freeSliceView = (slice: Slice) => {
  slice.Next = freeList;
  freeList = slice;
};

const freeTranspSliceViewsList = (slice: Slice) => {
  // double linked list, add to free list in O(1)
  const prev = slice.Prev as Slice;
  prev.Next = freeList;
  freeList = slice;
};

let sliceViewMap = new Map<number, Slice>();

function getSliceView(slicePtr: number): Slice {
  const wasmEngineModule = gWasmRun.WasmModules.engine;
  if (!sliceViewMap.has(slicePtr)) {
    sliceViewMap.set(
      slicePtr,
      new Slice(
        slicePtr,
        wasmEngineModule.getSliceDistancePtr(slicePtr),
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
        wasmEngineModule.getSliceIsSpritePtr(slicePtr),
      ),
    );
  }
  return sliceViewMap.get(slicePtr) as Slice;
}

function getWasmWallSlicesView(wasmRaycasterPtr: number): Slice[] {
  const wasmEngineModule = gWasmRun.WasmModules.engine;
  const numWallSlices = wasmEngineModule.getWallSlicesLength(wasmRaycasterPtr);
  const wallSlices = new Array<Slice>(numWallSlices);
  for (let i = 0; i < numWallSlices; i++) {
    const wallSlicePtr = wasmEngineModule.getWallSlicePtr(wasmRaycasterPtr, i);
    wallSlices[i] = getSliceView(wallSlicePtr);
  }
  return wallSlices;
}

export type { Slice, SliceRef };

export {
  getWasmWallSlicesView,
  newSliceView,
  freeSliceView,
  freeTranspSliceViewsList,
};
