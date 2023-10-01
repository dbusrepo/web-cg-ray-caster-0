import { myAssert } from '../myAssert';
import { PTR_T, SIZE_T, NULL_PTR } from '../memUtils';
import { ObjectAllocator, newObjectAllocator } from '../objectAllocator';
import { logi } from '../importVars';

@final @unmanaged class Sprite {
  private posX: f32;
  private posY: f32;
  private posZ: f32; // height wrt floor (0 on floor level)
  private texIdx: u32;

  private visible: u8; // 0: invisible, 1: visible
  private distance: f32;
  private startX: u32;
  private endX: u32;
  private texX: u32;
  private texStepX: f32;
  private startY: u32;
  private endY: u32;
  private texY: u32;
  private texStepY: f32;

  // active: u8; // 0: inactive, 1: active
  // active, tx, ty, 

  get PosX(): f32 {
    return this.posX;
  }
  
  set PosX(posX: f32) {
    this.posX = posX;
  }

  get PosY(): f32 {
    return this.posY;
  }

  set PosY(posY: f32) {
    this.posY = posY;
  }

  get PosZ(): f32 {
    return this.posZ;
  }

  set PosZ(posZ: f32) {
    this.posZ = posZ;
  }

  get TexIdx(): u32 {
    return this.texIdx;
  }

  set TexIdx(texIdx: u32) {
    this.texIdx = texIdx;
  }

  get Visible(): u8 {
    return this.visible;
  }

  set Visible(visible: u8) {
    this.visible = visible;
  }

  get Distance(): f32 {
    return this.distance;
  }

  set Distance(distance: f32) {
    this.distance = distance;
  }

  get StartX(): u32 {
    return this.startX;
  }

  set StartX(startX: u32) {
    this.startX = startX;
  }

  get EndX(): u32 {
    return this.endX;
  }

  set EndX(endX: u32) {
    this.endX = endX;
  }

  get TexX(): u32 {
    return this.texX;
  }

  set TexX(texX: u32) {
    this.texX = texX;
  }

  get TexStepX(): f32 {
    return this.texStepX;
  }

  set TexStepX(texStepX: f32) {
    this.texStepX = texStepX;
  }

  get StartY(): u32 {
    return this.startY;
  }

  set StartY(startY: u32) {
    this.startY = startY;
  }

  get EndY(): u32 {
    return this.endY;
  }

  set EndY(endY: u32) {
    this.endY = endY;
  }

  get TexY(): u32 {
    return this.texY;
  }

  set TexY(texY: u32) {
    this.texY = texY;
  }

  get TexStepY(): f32 {
    return this.texStepY;
  }

  set TexStepY(texStepY: f32) {
    this.texStepY = texStepY;
  }
}

let spriteAllocator = changetype<ObjectAllocator<Sprite>>(NULL_PTR);

function initSpriteAllocator(): void {
  spriteAllocator = newObjectAllocator<Sprite>(1);
}

function newSprite(): Sprite {
  if (changetype<PTR_T>(spriteAllocator) === NULL_PTR) {
    initSpriteAllocator();
  }
  const sprite = spriteAllocator.new();
  return sprite;
}

function getSpritePosXPtr(spritePtr: PTR_T): PTR_T {
  return spritePtr + offsetof<Sprite>("posX");
}

function getSpritePosYPtr(spritePtr: PTR_T): PTR_T {
  return spritePtr + offsetof<Sprite>("posY");
}

function getSpritePosZPtr(spritePtr: PTR_T): PTR_T {
  return spritePtr + offsetof<Sprite>("posZ");
}

function getSpriteTexIdxPtr(spritePtr: PTR_T): PTR_T {
  return spritePtr + offsetof<Sprite>("texIdx");
}

function getSpriteVisiblePtr(spritePtr: PTR_T): PTR_T {
  return spritePtr + offsetof<Sprite>("visible");
}

function getSpriteDistancePtr(spritePtr: PTR_T): PTR_T {
  return spritePtr + offsetof<Sprite>("distance");
}

function getSpriteStartXPtr(spritePtr: PTR_T): PTR_T {
  return spritePtr + offsetof<Sprite>("startX");
}

function getSpriteEndXPtr(spritePtr: PTR_T): PTR_T {
  return spritePtr + offsetof<Sprite>("endX");
}

function getSpriteTexXPtr(spritePtr: PTR_T): PTR_T {
  return spritePtr + offsetof<Sprite>("texX");
}

function getSpriteTexStepXPtr(spritePtr: PTR_T): PTR_T {
  return spritePtr + offsetof<Sprite>("texStepX");
}

function getSpriteStartYPtr(spritePtr: PTR_T): PTR_T {
  return spritePtr + offsetof<Sprite>("startY");
}

function getSpriteEndYPtr(spritePtr: PTR_T): PTR_T {
  return spritePtr + offsetof<Sprite>("endY");
}

function getSpriteTexYPtr(spritePtr: PTR_T): PTR_T {
  return spritePtr + offsetof<Sprite>("texY");
}

function getSpriteTexStepYPtr(spritePtr: PTR_T): PTR_T {
  return spritePtr + offsetof<Sprite>("texStepY");
}

export { 
  Sprite,
  newSprite,
  getSpritePosXPtr,
  getSpritePosYPtr,
  getSpritePosZPtr,
  getSpriteTexIdxPtr,
  getSpriteVisiblePtr,
  getSpriteDistancePtr,
  getSpriteStartXPtr,
  getSpriteEndXPtr,
  getSpriteTexXPtr,
  getSpriteTexStepXPtr,
  getSpriteStartYPtr,
  getSpriteEndYPtr,
  getSpriteTexYPtr,
  getSpriteTexStepYPtr,
};
