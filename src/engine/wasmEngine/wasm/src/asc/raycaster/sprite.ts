import { myAssert } from '../myAssert';
import { PTR_T, SIZE_T, NULL_PTR } from '../memUtils';
import { ObjectAllocator, newObjectAllocator } from '../objectAllocator';
import { logi } from '../importVars';

@final @unmanaged class Sprite {
  private posX: f32;
  private posY: f32;
  private texIdx: u32;

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

  get TexIdx(): u32 {
    return this.texIdx;
  }

  set TexIdx(texIdx: u32) {
    this.texIdx = texIdx;
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

function getSpriteTexIdxPtr(spritePtr: PTR_T): PTR_T {
  return spritePtr + offsetof<Sprite>("texIdx");
}

export { 
  Sprite,
  newSprite,
  getSpritePosXPtr,
  getSpritePosYPtr,
  getSpriteTexIdxPtr,
};
