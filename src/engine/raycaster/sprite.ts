import type { WasmModules, WasmEngineModule } from '../wasmEngine/wasmLoader';
import { gWasmRun, gWasmView } from '../wasmEngine/wasmRun';

class Sprite {
  constructor(
    // private spritePtr: number,
    private posXPtr: number,
    private posYPtr: number,
    private texIdxPtr: number,
  ) {}

  // get WasmPtr(): number {
  //   return this.spritePtr;
  // }

  get PosX(): number {
    return gWasmView.getFloat32(this.posXPtr, true);
  }

  set PosX(value: number) {
    gWasmView.setFloat32(this.posXPtr, value, true);
  }

  get PosY(): number {
    return gWasmView.getFloat32(this.posYPtr, true);
  }

  set PosY(value: number) {
    gWasmView.setFloat32(this.posYPtr, value, true);
  }

  get TexIdx(): number {
    return gWasmView.getUint32(this.texIdxPtr, true);
  }

  set TexIdx(value: number) {
    gWasmView.setUint32(this.texIdxPtr, value, true);
  }
}

function getWasmSpritesView(
  wasmEngineMod: WasmEngineModule,
  wasmRaycasterPtr: number,
): Sprite[] {
  const numSprites = wasmEngineMod.getSpritesLength(wasmRaycasterPtr);
  const sprites = new Array<Sprite>(numSprites);
  for (let i = 0; i < numSprites; i++) {
    const spritePtr = wasmEngineMod.getSpritePtr(wasmRaycasterPtr, i);
    const posXPtr = wasmEngineMod.getSpritePosXPtr(spritePtr);
    const posYPtr = wasmEngineMod.getSpritePosYPtr(spritePtr);
    const texIdxPtr = wasmEngineMod.getSpriteTexIdxPtr(spritePtr);
    sprites[i] = new Sprite(posXPtr, posYPtr, texIdxPtr);
  }
  return sprites;
}

export { Sprite, getWasmSpritesView };
