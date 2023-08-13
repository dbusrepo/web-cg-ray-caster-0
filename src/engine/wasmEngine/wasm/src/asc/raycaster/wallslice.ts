import { myAssert } from '../myAssert';
import { PTR_T, SIZE_T, NULL_PTR } from '../memUtils';
import { ObjectAllocator, newObjectAllocator } from '../objectAllocator';
import { logi } from '../importVars';

@final @unmanaged class WallSlice {

  private top: u32;
  private bottom: u32;

  private hit: u8;
  private side: u8;

  private distance: f32;

  private mipMapIdx: u32;
  private texX: u32;
  private texStepY: f32;
  private texY: f32;

  private floorWallX: f32;
  private floorWallY: f32;

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
}

let wallSliceAllocator = changetype<ObjectAllocator<WallSlice>>(NULL_PTR);

function initWallSliceAllocator(): void {
  wallSliceAllocator = newObjectAllocator<WallSlice>(1);
}

function newWallSlice(): WallSlice {
  if (changetype<PTR_T>(wallSliceAllocator) === NULL_PTR) {
    initWallSliceAllocator();
  }
  const wallSlice = wallSliceAllocator.new();
  return wallSlice;
}

function getWallSliceDistancePtr(wallSlicePtr: PTR_T): PTR_T {
  return wallSlicePtr + offsetof<WallSlice>('distance');
}

function getWallSliceHitPtr(wallSlicePtr: PTR_T): PTR_T {
  return wallSlicePtr + offsetof<WallSlice>('hit');
}

function getWallSliceSidePtr(wallSlicePtr: PTR_T): PTR_T {
  return wallSlicePtr + offsetof<WallSlice>('side');
}

function getWallSliceTopPtr(wallSlicePtr: PTR_T): PTR_T {
  return wallSlicePtr + offsetof<WallSlice>('top');
}

function getWallSliceBottomPtr(wallSlicePtr: PTR_T): PTR_T {
  return wallSlicePtr + offsetof<WallSlice>('bottom');
}

function getWallSliceTexXPtr(wallSlicePtr: PTR_T): PTR_T {
  return wallSlicePtr + offsetof<WallSlice>('texX');
}

function getWallSliceTexStepYPtr(wallSlicePtr: PTR_T): PTR_T {
  return wallSlicePtr + offsetof<WallSlice>('texStepY');
}

function getWallSliceTexYPtr(wallSlicePtr: PTR_T): PTR_T {
  return wallSlicePtr + offsetof<WallSlice>('texY');
}

function getWallSliceFloorWallXPtr(wallSlicePtr: PTR_T): PTR_T {
  return wallSlicePtr + offsetof<WallSlice>('floorWallX');
}

function getWallSliceFloorWallYPtr(wallSlicePtr: PTR_T): PTR_T {
  return wallSlicePtr + offsetof<WallSlice>('floorWallY');
}

function getWallSliceMipMapIdxPtr(wallSlicePtr: PTR_T): PTR_T {
  return wallSlicePtr + offsetof<WallSlice>('mipMapIdx');
}

export {
  WallSlice,
  newWallSlice,
  getWallSliceDistancePtr,
  getWallSliceHitPtr,
  getWallSliceSidePtr,
  getWallSliceTopPtr,
  getWallSliceBottomPtr,
  getWallSliceTexXPtr,
  getWallSliceTexStepYPtr,
  getWallSliceTexYPtr,
  getWallSliceFloorWallXPtr,
  getWallSliceFloorWallYPtr,
  getWallSliceMipMapIdxPtr,
};
  
