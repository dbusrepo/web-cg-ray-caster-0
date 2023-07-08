import { myAssert } from '../myAssert';
import { PTR_T, SIZE_T, NULL_PTR } from '../memUtils';
import { ObjectAllocator, newObjectAllocator } from '../objectAllocator';
import { logi } from '../importVars';

@final @unmanaged class WallSlice {
  private colIdx: u16;

  private top: u16;
  private bottom: u16;

  private texX: u16;

  private texStepY: f64;
  private texPosY: f64;

  private texId: u16;
  private mipLvl: u8;

  get ColIdx(): u16 {
    return this.colIdx;
  }

  set ColIdx(colIdx: u16) {
    this.colIdx = colIdx;
  }

  get Top(): u16 {
    return this.top;
  }

  set Top(top: u16) {
    this.top = top;
  }
  
  get Bottom(): u16 {
    return this.bottom;
  }

  set Bottom(bottom: u16) {
    this.bottom = bottom;
  }

  get TexX(): u16 {
    return this.texX;
  }

  set TexX(texX: u16) {
    this.texX = texX;
  }

  get TexStepY(): f64 {
    return this.texStepY;
  }

  set TexStepY(texStepY: f64) {
    this.texStepY = texStepY;
  }

  get TexPosY(): f64 {
    return this.texPosY;
  }

  set TexPosY(texPosY: f64) {
    this.texPosY = texPosY;
  }

  get TexId(): u16 {
    return this.texId;
  }

  set TexId(texId: u16) {
    this.texId = texId;
  }

  get MipLvl(): u8 {
    return this.mipLvl;
  }

  set MipLvl(mipLvl: u8) {
    this.mipLvl = mipLvl;
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

function getWallSliceColIdxPtr(wallSlicePtr: PTR_T): PTR_T {
  return wallSlicePtr + offsetof<WallSlice>('colIdx');
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

function getWallSliceTexPosYPtr(wallSlicePtr: PTR_T): PTR_T {
  return wallSlicePtr + offsetof<WallSlice>('texPosY');
}

function getWallSliceTexIdPtr(wallSlicePtr: PTR_T): PTR_T {
  return wallSlicePtr + offsetof<WallSlice>('texId');
}

function getWallSliceMipLvlPtr(wallSlicePtr: PTR_T): PTR_T {
  return wallSlicePtr + offsetof<WallSlice>('mipLvl');
}

export {
  WallSlice,
  newWallSlice,
  getWallSliceColIdxPtr,
  getWallSliceTopPtr,
  getWallSliceBottomPtr,
  getWallSliceTexXPtr,
  getWallSliceTexStepYPtr,
  getWallSliceTexPosYPtr,
  getWallSliceTexIdPtr,
  getWallSliceMipLvlPtr,
};
  
