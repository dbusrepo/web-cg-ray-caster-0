import { myAssert } from '../myAssert';
import { PTR_T, SIZE_T, NULL_PTR } from '../memUtils';
import { ObjectAllocator, newObjectAllocator } from '../objectAllocator';
import { logi } from '../importVars';

@final @unmanaged class Slice {

  private top: u32;
  private bottom: u32;

  private height: u32;
  private clipTop: u32;

  private hit: u8;
  private side: u8;

  private distance: f32;

  private mipMapIdx: u32;
  private texX: u32;
  private texStepY: f32;
  private texY: f32;

  private floorWallX: f32;
  private floorWallY: f32;

  private prevPtr: PTR_T = NULL_PTR;
  private nextPtr: PTR_T = NULL_PTR;

  get Distance(): f32 {
    return this.distance;
  }

  set Distance(distance: f32) {
    this.distance = distance;
  }

  get MipMapIdx(): u32 {
    return this.mipMapIdx;
  }

  set MipMapIdx(mipMapIdx: u32) {
    this.mipMapIdx = mipMapIdx;
  }

  get Hit(): u8 {
    return this.hit;
  }

  set Hit(hit: u8) {
    this.hit = hit;
  }

  get Side(): u8 {
    return this.side;
  }

  set Side(side: u8) {
    this.side = side;
  }

  get Top(): u32 {
    return this.top;
  }

  set Top(top: u32) {
    this.top = top;
  }
  
  get Bottom(): u32 {
    return this.bottom;
  }

  set Bottom(bottom: u32) {
    this.bottom = bottom;
  }

  get TexX(): u32 {
    return this.texX;
  }

  set TexX(texX: u32) {
    this.texX = texX;
  }

  get TexStepY(): f32 {
    return this.texStepY;
  }

  set TexStepY(texStepY: f32) {
    this.texStepY = texStepY;
  }

  get TexY(): f32 {
    return this.texY;
  }

  set TexY(texY: f32) {
    this.texY = texY;
  }

  get FloorWallX(): f32 {
    return this.floorWallX;
  }

  set FloorWallX(floorWallX: f32) {
    this.floorWallX = floorWallX;
  }

  get FloorWallY(): f32 {
    return this.floorWallY;
  }

  set FloorWallY(floorWallY: f32) {
    this.floorWallY = floorWallY;
  }

  get Height(): u32 {
    return this.height;
  }

  set Height(height: u32) {
    this.height = height;
  }

  get ClipTop(): u32 {
    return this.clipTop;
  }

  set ClipTop(clipTop: u32) {
    this.clipTop = clipTop;
  }

  get PrevPtr(): PTR_T {
    return this.prevPtr;
  }

  set PrevPtr(prevPtr: PTR_T) {
    this.prevPtr = prevPtr;
  }

  get NextPtr(): PTR_T {
    return this.nextPtr;
  }

  set NextPtr(nextPtr: PTR_T) {
    this.nextPtr = nextPtr;
  }
}

let wallSliceAllocator = changetype<ObjectAllocator<Slice>>(NULL_PTR);

function initSliceAllocator(): void {
  wallSliceAllocator = newObjectAllocator<Slice>(1);
}

function newSlice(): Slice {
  if (changetype<PTR_T>(wallSliceAllocator) === NULL_PTR) {
    initSliceAllocator();
  }
  const wallSlice = wallSliceAllocator.new();
  return wallSlice;
}

function getSliceDistancePtr(slicePtr: PTR_T): PTR_T {
  return slicePtr + offsetof<Slice>('distance');
}

function getSliceHitPtr(slicePtr: PTR_T): PTR_T {
  return slicePtr + offsetof<Slice>('hit');
}

function getSliceSidePtr(slicePtr: PTR_T): PTR_T {
  return slicePtr + offsetof<Slice>('side');
}

function getSliceTopPtr(slicePtr: PTR_T): PTR_T {
  return slicePtr + offsetof<Slice>('top');
}

function getSliceBottomPtr(slicePtr: PTR_T): PTR_T {
  return slicePtr + offsetof<Slice>('bottom');
}

function getSliceTexXPtr(slicePtr: PTR_T): PTR_T {
  return slicePtr + offsetof<Slice>('texX');
}

function getSliceTexStepYPtr(slicePtr: PTR_T): PTR_T {
  return slicePtr + offsetof<Slice>('texStepY');
}

function getSliceTexYPtr(slicePtr: PTR_T): PTR_T {
  return slicePtr + offsetof<Slice>('texY');
}

function getSliceFloorWallXPtr(slicePtr: PTR_T): PTR_T {
  return slicePtr + offsetof<Slice>('floorWallX');
}

function getSliceFloorWallYPtr(slicePtr: PTR_T): PTR_T {
  return slicePtr + offsetof<Slice>('floorWallY');
}

function getSliceMipMapIdxPtr(slicePtr: PTR_T): PTR_T {
  return slicePtr + offsetof<Slice>('mipMapIdx');
}

function getSliceHeightPtr(slicePtr: PTR_T): PTR_T {
  return slicePtr + offsetof<Slice>('height');
}

function getSliceClipTopPtr(slicePtr: PTR_T): PTR_T {
  return slicePtr + offsetof<Slice>('clipTop');
}

function getSlicePrevPtrPtr(slicePtr: PTR_T): PTR_T {
  return slicePtr + offsetof<Slice>('prevPtr');
}

function getSliceNextPtrPtr(slicePtr: PTR_T): PTR_T {
  return slicePtr + offsetof<Slice>('nextPtr');
}

export {
  Slice,
  newSlice,
  getSliceDistancePtr,
  getSliceHitPtr,
  getSliceSidePtr,
  getSliceTopPtr,
  getSliceBottomPtr,
  getSliceTexXPtr,
  getSliceTexStepYPtr,
  getSliceTexYPtr,
  getSliceFloorWallXPtr,
  getSliceFloorWallYPtr,
  getSliceMipMapIdxPtr,
  getSliceHeightPtr,
  getSliceClipTopPtr,
  getSlicePrevPtrPtr,
  getSliceNextPtrPtr,
};
