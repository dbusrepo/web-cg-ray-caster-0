import { myAssert } from '../myAssert';
import { PTR_T, SIZE_T, NULL_PTR } from '../memUtils';
import { ObjectAllocator, newObjectAllocator } from '../objectAllocator';
import { SArray, newSArray } from '../sarray';
import { Viewport, newViewport } from './viewport';
import { Player, newPlayer } from './player';
import { Map, newMap } from './map';
import { WallSlice, newWallSlice } from './wallslice';
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
  frameColorRGBAPtr,
} from '../importVars';
import {
  FrameColorRGBA, 
  newFrameColorRGBA,
  // deleteFrameColorRGBA, 
  MAX_LIGHT_LEVELS,
  BPP_RGBA,
  getRedLightTablePtr,
  getGreenLightTablePtr,
  getBlueLightTablePtr,
  getRedFogTablePtr,
  getGreenFogTablePtr,
  getBlueFogTablePtr,
} from '../frameColorRGBA';

@final @unmanaged class Raycaster {
  private borderColor: u32;
  private viewport: Viewport;
  private projYCenter: i32;
  private player: Player;
  private map: Map;
  private zBuffer: SArray<f32>;
  private wallSlices: SArray<WallSlice>;
  private minWallTop: u32;
  private maxWallTop: u32;
  private minWallBottom: u32;
  private maxWallBottom: u32;

  init(): void {
    this.initBuffers();
  }

  initBuffers(): void {
    this.allocZBuffer();
    this.allocWallSlices();
  }

  allocZBuffer(): void {
    this.zBuffer = newSArray<f32>(this.Viewport.Width);
  }

  allocWallSlices(): void {
    this.wallSlices = newSArray<WallSlice>(this.Viewport.Width);
  }

  get WallSliceObjSizeLg2(): SIZE_T {
    return this.wallSlices.ObjSizeLg2;
  }

  get Viewport(): Viewport {
    return this.viewport;
  }

  set Viewport(viewport: Viewport) {
    this.viewport = viewport;
  }

  get ProjYCenter(): i32 {
    return this.projYCenter;
  }

  set ProjYCenter(projYCenter: i32) {
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

  get ZBuffer(): SArray<f32> {
    return this.zBuffer;
  }

  get WallSlices(): SArray<WallSlice> {
    return this.wallSlices;
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

function getBorderColorPtr(raycasterPtr: PTR_T): PTR_T {
  return raycasterPtr + offsetof<Raycaster>("borderColor");
}

function getZBufferPtr(raycasterPtr: PTR_T): PTR_T {
  const raycaster = changetype<Raycaster>(raycasterPtr);
  return raycaster.ZBuffer.DataPtr;
}

function getProjYCenterPtr(raycasterPtr: PTR_T): PTR_T {
  return raycasterPtr + offsetof<Raycaster>("projYCenter");
}

function getWallSlicesPtr(raycasterPtr: PTR_T): PTR_T {
  const raycaster = changetype<Raycaster>(raycasterPtr);
  return raycaster.WallSlices.DataPtr;
}

function getXGridPtr(raycasterPtr: PTR_T): PTR_T {
  const raycaster = changetype<Raycaster>(raycasterPtr);
  return raycaster.Map.xGridPtr.DataPtr;
}

function getYGridPtr(raycasterPtr: PTR_T): PTR_T {
  const raycaster = changetype<Raycaster>(raycasterPtr);
  return raycaster.Map.yGridPtr.DataPtr;
}

function getWallSliceObjSizeLg2(raycasterPtr: PTR_T): SIZE_T {
  const raycaster = changetype<Raycaster>(raycasterPtr);
  return raycaster.WallSliceObjSizeLg2;
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
  const raycaster = changetype<Raycaster>(raycasterPtr);
  return raycaster.ViewportPtr;
}

function getPlayerPtr(raycasterPtr: PTR_T): PTR_T {
  const raycaster = changetype<Raycaster>(raycasterPtr);
  return raycaster.PlayerPtr;
}

export {
  Raycaster,
  newRaycaster,
  getBorderColorPtr,
  getProjYCenterPtr,
  getZBufferPtr,
  getXGridPtr,
  getYGridPtr,
  getWallSlicesPtr,
  getWallSliceObjSizeLg2,
  getMinWallTopPtr,
  getMaxWallTopPtr,
  getMinWallBottomPtr,
  getMaxWallBottomPtr,
  getViewportPtr,
  getPlayerPtr,
};
