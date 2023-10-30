import { myAssert } from '../myAssert';
import { PTR_T, SIZE_T, NULL_PTR, getTypeSize } from '../memUtils';
import { ObjectAllocator, newObjectAllocator } from '../objectAllocator';
import { SArray, newSArray } from '../sarray';
import { Viewport, newViewport } from './viewport';
import { Player, newPlayer } from './player';
import { Sprite } from './sprite';
import { Door } from './door';
import { Map } from './map';
import { Slice } from './slice';
import { Texture } from '../texture';
import { BitImageRGBA } from '../bitImageRGBA';
import { Ref } from '../ref';
import { Pointer } from '../pointer';
import {
  sharedHeapPtr,
  numWorkers,
  mainWorkerIdx,
  workerIdx,
  logi,
  logf,
  rgbaSurface0ptr,
  rgbaSurface0width,
  rgbaSurface0height,
  syncArrayPtr,
  sleepArrayPtr,
  inputKeysPtr,
  hrTimerPtr,
  raycasterPtr,
} from '../importVars';
import {
  FrameColorRGBA, 
  // newFrameColorRGBA,
  // deleteFrameColorRGBA, 
  // MAX_LIGHT_LEVELS,
  // BPP_RGBA,
  // getRedLightTablePtr,
  // getGreenLightTablePtr,
  // getBlueLightTablePtr,
  // getRedFogTablePtr,
  // getGreenFogTablePtr,
  // getBlueFogTablePtr,
} from '../frameColorRGBA';
import { Renderer, newRenderer, } from './renderer';
import { RaycasterParams } from './raycasterParams';

@final @unmanaged class Raycaster {
  private frameColorRGBA: FrameColorRGBA;
  private textures: SArray<Texture>;
  private mipmaps: SArray<BitImageRGBA>;
  private sprites: SArray<Sprite>;
  private doorsList: Pointer<Door>;
  private wallSlices: SArray<Slice>;
  private wallZBuffer: SArray<f32>;
  private transpSlices: SArray<Ref<Slice>>;
  private wallHeight: u32;
  private player: Player;
  private map: Map;
  private viewport: Viewport;
  private borderWidth: u32;
  private borderColor: u32;
  private projYCenter: u32;
  private maxWallDistance: f32;
  private minWallTop: u32;
  private maxWallTop: u32;
  private minWallBottom: u32;
  private maxWallBottom: u32;
  private renderer: Renderer;

  public init(params: RaycasterParams): void {
    this.frameColorRGBA = params.frameColorRGBA;
    this.textures = params.textures;
    this.mipmaps = params.mipmaps;
    this.initPlayer();
    this.initViewPort();
  }

  private initPlayer(): void {
    this.player = newPlayer();
  }

  private initViewPort(): void {
    this.viewport = newViewport();
  }

  private initRenderer(): void { // TODO:
    this.renderer = newRenderer();
    this.renderer.init(this.frameColorRGBA, this.viewport, this.textures, this.mipmaps);
  }

  public render(): void {
    this.renderer.render(this.wallSlices, this.player, this.map, this.projYCenter);
  }

  public allocSpritesArr(numSprites: SIZE_T): void {
    this.sprites = newSArray<Sprite>(numSprites);
  }

  get Textures(): SArray<Texture> {
    return this.textures;
  }

  get Mipmaps(): SArray<BitImageRGBA> {
    return this.mipmaps;
  }

  get Viewport(): Viewport {
    return this.viewport;
  }

  set Viewport(viewport: Viewport) {
    this.viewport = viewport;
  }

  get ProjYCenter(): u32 {
    return this.projYCenter;
  }

  set ProjYCenter(projYCenter: u32) {
    this.projYCenter = projYCenter;
  }

  get Player(): Player {
    return this.player;
  }

  set Player(player: Player) {
    this.player = player;
  }

  get Map(): Map {
    return this.map;
  }

  set Map(map: Map) {
    this.map = map;
  }

  get WallHeight(): u32 {
    return this.wallHeight;
  }

  set WallHeight(wallHeight: u32) {
    this.wallHeight = wallHeight;
  }

  get WallZBuffer(): SArray<f32> {
    return this.wallZBuffer;
  }

  set WallZBuffer(wallZBuffer: SArray<f32>) {
    this.wallZBuffer = wallZBuffer;
  }

  get Sprites(): SArray<Sprite> {
    return this.sprites;
  }

  get WallSlices(): SArray<Slice> {
    return this.wallSlices;
  }

  set WallSlices(wallSlices: SArray<Slice>) {
    this.wallSlices = wallSlices;
  }

  get TranspSlices(): SArray<Ref<Slice>> {
    return this.transpSlices;
  }

  set TranspSlices(transpSlices: SArray<Ref<Slice>>) {
    this.transpSlices = transpSlices;
  }

  get ViewportPtr(): PTR_T {
    return changetype<PTR_T>(this.viewport);
  }

  get PlayerPtr(): PTR_T {
    return changetype<PTR_T>(this.player);
  }

  get BorderColor(): u32 {
    return this.borderColor;
  }

  set BorderColor(borderColor: u32) {
    this.borderColor = borderColor;
  }

  get MinWallTop(): u32 {
    return this.minWallTop;
  }

  set MinWallTop(minWallTop: u32) {
    this.minWallTop = minWallTop;
  }

  get MaxWallTop(): u32 {
    return this.maxWallTop;
  }
  
  set MaxWallTop(maxWallTop: u32) {
    this.maxWallTop = maxWallTop;
  }

  get MinWallBottom(): u32 {
    return this.minWallBottom;
  }

  get MaxWallBottom(): u32 {
    return this.maxWallBottom;
  }

  set MaxWallBottom(maxWallBottom: u32) {
    this.maxWallBottom = maxWallBottom;
  }

  get MaxWallDistance(): f32 {
    return this.maxWallDistance;
  }

  set MaxWallDistance(maxWallDistance: f32) {
    this.maxWallDistance = maxWallDistance;
  }

  get Renderer(): Renderer {
    return this.renderer;
  }

  get DoorsList(): Pointer<Door> {
    return this.doorsList;
  }

  set DoorsList(doorsList: Pointer<Door>) {
    this.doorsList = doorsList;
  }
}

let raycasterAlloc = changetype<ObjectAllocator<Raycaster>>(NULL_PTR);

function initRaycasterAllocator(): void {
  raycasterAlloc = newObjectAllocator<Raycaster>(1);
}

function newRaycaster(): Raycaster {
  if (changetype<PTR_T>(raycasterAlloc) === NULL_PTR) {
    initRaycasterAllocator();
  }
  const raycaster = raycasterAlloc.new();
  return raycaster;
}

function getBorderWidthPtr(raycasterPtr: PTR_T): PTR_T {
  return raycasterPtr + offsetof<Raycaster>("borderWidth");
}

function getBorderColorPtr(raycasterPtr: PTR_T): PTR_T {
  return raycasterPtr + offsetof<Raycaster>("borderColor");
}

function getWallHeightPtr(raycasterPtr: PTR_T): PTR_T {
  return raycasterPtr + offsetof<Raycaster>("wallHeight");
}

function getRaycaster(raycasterPtr: PTR_T): Raycaster {
  return changetype<Raycaster>(raycasterPtr);
}

function allocWallZBuffer(raycasterPtr: PTR_T): PTR_T {
  const raycaster = getRaycaster(raycasterPtr);
  raycaster.WallZBuffer = newSArray<f32>(raycaster.Viewport.Width);
  return raycaster.WallZBuffer.DataPtr;
}

// function getZBufferPtr(raycasterPtr: PTR_T): PTR_T {
//   const raycaster = getRaycaster(raycasterPtr);
//   return raycaster.ZBuffer.DataPtr;
// }

function allocWallSlices(raycasterPtr: PTR_T): void {
  const raycaster = getRaycaster(raycasterPtr);
  const wallSlices = newSArray<Slice>(raycaster.Viewport.Width);
  raycaster.WallSlices = wallSlices;
}

function getWallSlicesLength(raycasterPtr: PTR_T): SIZE_T {
  const raycaster = getRaycaster(raycasterPtr);
  return raycaster.WallSlices.Length;
}

function getProjYCenterPtr(raycasterPtr: PTR_T): PTR_T {
  return raycasterPtr + offsetof<Raycaster>("projYCenter");
}

function getSpritesLength(raycasterPtr: PTR_T): SIZE_T {
  const raycaster = getRaycaster(raycasterPtr);
  return raycaster.Sprites.Length;
}

function getSpritesPtr(raycasterPtr: PTR_T): PTR_T {
  const raycaster = getRaycaster(raycasterPtr);
  return raycaster.Sprites.DataPtr;
}

function getSpritePtr(raycasterPtr: PTR_T, spriteIdx: SIZE_T): PTR_T {
  const raycaster = getRaycaster(raycasterPtr);
  return raycaster.Sprites.ptrAt(spriteIdx);
}

function getSpriteObjSizeLg2(raycasterPtr: PTR_T): SIZE_T {
  const raycaster = getRaycaster(raycasterPtr);
  return raycaster.Sprites.ObjSizeLg2;
}

function getWallSlicesPtr(raycasterPtr: PTR_T): PTR_T {
  const raycaster = getRaycaster(raycasterPtr);
  return raycaster.WallSlices.DataPtr;
}

function getWallSlicePtr(raycasterPtr: PTR_T, wallSliceIdx: SIZE_T): PTR_T {
  const raycaster = getRaycaster(raycasterPtr);
  return raycaster.WallSlices.ptrAt(wallSliceIdx);
}

function getWallSliceObjSizeLg2(raycasterPtr: PTR_T): SIZE_T {
  const raycaster = getRaycaster(raycasterPtr);
  return raycaster.WallSlices.ObjSizeLg2;
}

function getXWallMapPtr(raycasterPtr: PTR_T): PTR_T {
  const raycaster = getRaycaster(raycasterPtr);
  return raycaster.Map.XWallMap.DataPtr;
}

function getYWallMapPtr(raycasterPtr: PTR_T): PTR_T {
  const raycaster = getRaycaster(raycasterPtr);
  return raycaster.Map.YWallMap.DataPtr;
}

function getXWallMapWidth(raycasterPtr: PTR_T): u32 {
  const raycaster = getRaycaster(raycasterPtr);
  return raycaster.Map.XWallMapWidth;
}

function getXWallMapHeight(raycasterPtr: PTR_T): u32 {
  const raycaster = getRaycaster(raycasterPtr);
  return raycaster.Map.XWallMapHeight;
}

function getYWallMapWidth(raycasterPtr: PTR_T): u32 {
  const raycaster = getRaycaster(raycasterPtr);
  return raycaster.Map.YWallMapWidth;
}

function getYWallMapHeight(raycasterPtr: PTR_T): u32 {
  const raycaster = getRaycaster(raycasterPtr);
  return raycaster.Map.YWallMapHeight;
}

function getFloorMapPtr(raycasterPtr: PTR_T): PTR_T {
  const raycaster = getRaycaster(raycasterPtr);
  return raycaster.Map.FloorMap.DataPtr;
}

function getMinWallTopPtr(raycasterPtr: PTR_T): PTR_T {
  return raycasterPtr + offsetof<Raycaster>("minWallTop");
}

function getMaxWallTopPtr(raycasterPtr: PTR_T): PTR_T {
  return raycasterPtr + offsetof<Raycaster>("maxWallTop");
}

function getMinWallBottomPtr(raycasterPtr: PTR_T): PTR_T {
  return raycasterPtr + offsetof<Raycaster>("minWallBottom");
}

function getMaxWallBottomPtr(raycasterPtr: PTR_T): PTR_T {
  return raycasterPtr + offsetof<Raycaster>("maxWallBottom");
}

function getViewportPtr(raycasterPtr: PTR_T): PTR_T {
  const raycaster = getRaycaster(raycasterPtr);
  return raycaster.ViewportPtr;
}

function getPlayerPtr(raycasterPtr: PTR_T): PTR_T {
  const raycaster = getRaycaster(raycasterPtr);
  return raycaster.PlayerPtr;
}

function getMaxWallDistancePtr(raycasterPtr: PTR_T): PTR_T {
  return raycasterPtr + offsetof<Raycaster>("maxWallDistance");
}

function getDoorsListPtr(raycasterPtr: PTR_T): PTR_T {
  return raycasterPtr + offsetof<Raycaster>("doorsList");
}

function allocSpritesArr(raycasterPtr: PTR_T, numSprites: SIZE_T): void {
  const raycaster = getRaycaster(raycasterPtr);
  raycaster.allocSpritesArr(numSprites);
}

function allocTranspSlices(raycasterPtr: PTR_T): void {
  const raycaster = getRaycaster(raycasterPtr);
  const transpWallSlices = newSArray<Ref<Slice>>(raycaster.Viewport.Width);
  raycaster.TranspSlices = transpWallSlices;
}

function resetTranspSlicesPtrs(raycasterPtr: PTR_T): void {
  const raycaster = getRaycaster(raycasterPtr);
  const startOffs = raycaster.TranspSlices.ptrAt(0);
  const endOffs = raycaster.TranspSlices.ptrAt(raycaster.TranspSlices.Length);
  const numBytes = endOffs - startOffs;
  memory.fill(startOffs, NULL_PTR as u8, numBytes);
}

function setTranspSliceAtIdx(raycasterPtr: PTR_T, wallSliceIdx: SIZE_T, wallSlicePtr: PTR_T): void {
  const raycaster = getRaycaster(raycasterPtr);
  raycaster.TranspSlices.at(wallSliceIdx).Ptr = wallSlicePtr;
}

export {
  Raycaster,
  newRaycaster,
  allocWallZBuffer,
  getBorderColorPtr,
  getWallHeightPtr,
  getBorderWidthPtr,
  getProjYCenterPtr,
  getXWallMapPtr,
  getXWallMapWidth,
  getXWallMapHeight,
  getYWallMapPtr,
  getYWallMapWidth,
  getYWallMapHeight,
  getFloorMapPtr,
  allocWallSlices,
  getWallSlicesLength,
  getWallSlicesPtr,
  getWallSlicePtr,
  getWallSliceObjSizeLg2,
  getSpritesPtr,
  getSpritesLength,
  getSpritePtr,
  getSpriteObjSizeLg2,
  allocSpritesArr,
  getMinWallTopPtr,
  getMaxWallTopPtr,
  getMinWallBottomPtr,
  getMaxWallBottomPtr,
  getViewportPtr,
  getPlayerPtr,
  getMaxWallDistancePtr,

  allocTranspSlices,
  resetTranspSlicesPtrs,
  setTranspSliceAtIdx,

  getDoorsListPtr,
};
