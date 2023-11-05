import { myAssert } from '../myAssert';
import { PTR_T, SIZE_T, NULL_PTR, getTypeSize } from '../memUtils';
import { ObjectAllocator, newObjectAllocator } from '../objectAllocator';
import { SArray, newSArray } from '../sarray';
import { Viewport, newViewport } from './viewport';
import { Player, newPlayer } from './player';
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
import { RaycasterParams } from './raycasterParams';

@final @unmanaged class Raycaster {
  private frameColorRGBA: FrameColorRGBA;
  private viewport: Viewport;
  private borderWidth: u32;
  private borderColor: u32;
  private textures: SArray<Texture>;
  private mipmaps: SArray<BitImageRGBA>;
  private player: Player;
  private projYCenter: u32;

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

function getRaycaster(raycasterPtr: PTR_T): Raycaster {
  return changetype<Raycaster>(raycasterPtr);
}

function getProjYCenterPtr(raycasterPtr: PTR_T): PTR_T {
  return raycasterPtr + offsetof<Raycaster>("projYCenter");
}

function getViewportPtr(raycasterPtr: PTR_T): PTR_T {
  const raycaster = getRaycaster(raycasterPtr);
  return raycaster.ViewportPtr;
}

function getPlayerPtr(raycasterPtr: PTR_T): PTR_T {
  const raycaster = getRaycaster(raycasterPtr);
  return raycaster.PlayerPtr;
}

export {
  Raycaster,
  newRaycaster,
  getBorderColorPtr,
  getBorderWidthPtr,
  getProjYCenterPtr,
  getViewportPtr,
  getPlayerPtr,
};
