import type { WasmModules, WasmEngineModule } from '../wasmEngine/wasmLoader';
import { gWasmRun, gWasmView } from '../wasmEngine/wasmRun';
import { BitImageRGBA } from '../assets/images/bitImageRGBA';

class Sprite {
  public static SPRITE_HEIGHT_LIMIT: number;

  private srcIdx: number;
  private mipmap: BitImageRGBA;
  private texYOffsets: Uint32Array;
  private texXOffsets: Uint32Array;
  private renderXs: Uint32Array;
  private numRenderXs: number;
  private mipLevel: number; // current mip level

  constructor(
    // private spritePtr: number,
    private posXPtr: number,
    private posYPtr: number,
    private posZPtr: number,
    private texIdxPtr: number,
    //
    private visiblePtr: number,
    private distancePtr: number,
    private startXPtr: number,
    private endXPtr: number,
    private texXPtr: number,
    private texStepXPtr: number,
    private startYPtr: number,
    private endYPtr: number,
    private texYPtr: number,
    private texStepYPtr: number,
  ) {}

  // init(posX: number, posY: number, posZ: number, texIdx: number): void {
  //   this.PosX = posX;
  //   this.PosY = posY;
  //   this.PosZ = posZ;
  //   this.TexIdx = texIdx;
  // }

  // get WasmPtr(): number {
  //   return this.spritePtr;
  // }

  allocTexYOffsets(length: number): void {
    if (!this.texYOffsets) {
      this.texYOffsets = new Uint32Array(length);
    }
  }

  allocXOffsets(length: number): void {
    if (!this.texXOffsets) {
      this.texXOffsets = new Uint32Array(length);
    }
    if (!this.renderXs) {
      this.renderXs = new Uint32Array(length);
    }
  }

  get NumRenderXs(): number {
    return this.numRenderXs;
  }

  set NumRenderXs(value: number) {
    this.numRenderXs = value;
  }

  get RenderXs(): Uint32Array {
    return this.renderXs;
  }

  get TexXOffsets(): Uint32Array {
    return this.texXOffsets;
  }

  get SrcIdx(): number {
    return this.srcIdx;
  }

  set SrcIdx(value: number) {
    this.srcIdx = value;
  }

  get MipLevel(): number {
    return this.mipLevel;
  }

  set MipLevel(value: number) {
    this.mipLevel = value;
  }

  get TexYOffsets(): Uint32Array {
    return this.texYOffsets;
  }

  get Mipmap(): BitImageRGBA {
    return this.mipmap;
  }

  set Mipmap(mipmap: BitImageRGBA) {
    this.mipmap = mipmap;
  }

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

  get PosZ(): number {
    return gWasmView.getFloat32(this.posZPtr, true);
  }

  set PosZ(value: number) {
    gWasmView.setFloat32(this.posZPtr, value, true);
  }

  get TexIdx(): number {
    return gWasmView.getUint32(this.texIdxPtr, true);
  }

  set TexIdx(value: number) {
    gWasmView.setUint32(this.texIdxPtr, value, true);
  }

  get Visible(): number {
    // u8 (asc) -> i32 (wasm)
    return gWasmView.getInt32(this.visiblePtr, true);
  }

  set Visible(value: number) {
    gWasmView.setInt32(this.visiblePtr, value, true);
  }

  get Distance(): number {
    return gWasmView.getFloat32(this.distancePtr, true);
  }

  set Distance(value: number) {
    gWasmView.setFloat32(this.distancePtr, value, true);
  }

  get StartX(): number {
    return gWasmView.getUint32(this.startXPtr, true);
  }

  set StartX(value: number) {
    gWasmView.setUint32(this.startXPtr, value, true);
  }

  get EndX(): number {
    return gWasmView.getUint32(this.endXPtr, true);
  }

  set EndX(value: number) {
    gWasmView.setUint32(this.endXPtr, value, true);
  }

  get TexX(): number {
    return gWasmView.getFloat32(this.texXPtr, true);
  }

  set TexX(value: number) {
    gWasmView.setFloat32(this.texXPtr, value, true);
  }

  get TexStepX(): number {
    return gWasmView.getFloat32(this.texStepXPtr, true);
  }

  set TexStepX(value: number) {
    gWasmView.setFloat32(this.texStepXPtr, value, true);
  }

  get StartY(): number {
    return gWasmView.getUint32(this.startYPtr, true);
  }

  set StartY(value: number) {
    gWasmView.setUint32(this.startYPtr, value, true);
  }

  get EndY(): number {
    return gWasmView.getUint32(this.endYPtr, true);
  }

  set EndY(value: number) {
    gWasmView.setUint32(this.endYPtr, value, true);
  }

  get TexY(): number {
    return gWasmView.getFloat32(this.texYPtr, true);
  }

  set TexY(value: number) {
    gWasmView.setFloat32(this.texYPtr, value, true);
  }

  get TexStepY(): number {
    return gWasmView.getFloat32(this.texStepYPtr, true);
  }

  set TexStepY(value: number) {
    gWasmView.setFloat32(this.texStepYPtr, value, true);
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
    const posZPtr = wasmEngineMod.getSpritePosZPtr(spritePtr);
    const texIdxPtr = wasmEngineMod.getSpriteTexIdxPtr(spritePtr);
    const visiblePtr = wasmEngineMod.getSpriteVisiblePtr(spritePtr);
    const distancePtr = wasmEngineMod.getSpriteDistancePtr(spritePtr);
    const startXPtr = wasmEngineMod.getSpriteStartXPtr(spritePtr);
    const endXPtr = wasmEngineMod.getSpriteEndXPtr(spritePtr);
    const texXPtr = wasmEngineMod.getSpriteTexXPtr(spritePtr);
    const texStepXPtr = wasmEngineMod.getSpriteTexStepXPtr(spritePtr);
    const startYPtr = wasmEngineMod.getSpriteStartYPtr(spritePtr);
    const endYPtr = wasmEngineMod.getSpriteEndYPtr(spritePtr);
    const texYPtr = wasmEngineMod.getSpriteTexYPtr(spritePtr);
    const texStepYPtr = wasmEngineMod.getSpriteTexStepYPtr(spritePtr);
    sprites[i] = new Sprite(
      posXPtr,
      posYPtr,
      posZPtr,
      texIdxPtr,
      visiblePtr,
      distancePtr,
      startXPtr,
      endXPtr,
      texXPtr,
      texStepXPtr,
      startYPtr,
      endYPtr,
      texYPtr,
      texStepYPtr,
    );
  }
  return sprites;
}

export { Sprite, getWasmSpritesView };
