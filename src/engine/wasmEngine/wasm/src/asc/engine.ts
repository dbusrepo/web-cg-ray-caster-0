import { myAssert } from './myAssert';
import { initSharedHeap, heapAlloc, heapFree } from './heapAlloc';
import {
  initMemManager,
  alloc,
  free,
} from './workerHeapManager';
import { ArenaAlloc, newArena } from './arenaAlloc';
import { ObjectAllocator } from './objectAllocator';
import * as utils from './utils';
import * as draw from './draw';
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
  texturesPtr,
  mipmapsPtr,
} from './importVars';
import { GREYSTONE } from './gen_importImages';
import { Texture, initTextures, initMipMaps } from './texture';
import { BitImageRGBA } from './bitImageRGBA';
// import { DArray, newDArray, deleteDArray } from './darray';
import { Pointer } from './pointer';
import { SArray, newSArray } from './sarray';
import { test } from './test/test';
import { PTR_T, SIZE_T, NULL_PTR, getTypeSize } from './memUtils';
import { Viewport, newViewport,
  getViewportStartXPtr, getViewportStartYPtr, 
  getViewportWidthPtr, getViewportHeightPtr,
} from './raycaster/viewport';
import { Player, newPlayer,
  getPlayerPosXPtr,
  getPlayerPosYPtr,
  getPlayerDirXPtr,
  getPlayerDirYPtr,
  getPlayerPlaneXPtr,
  getPlayerPlaneYPtr,
  getPlayerPosZPtr,
} from './raycaster/player';
import { Map, newMap } from './raycaster/map';
import { 
  Raycaster,
  newRaycaster,
  getBorderColorPtr,
  getProjYCenterPtr,
  getZBufferPtr,
  getXWallMapPtr,
  getXWallMapWidth,
  getXWallMapHeight,
  getYWallMapPtr,
  getYWallMapWidth,
  getYWallMapHeight,
  getFloorMapPtr,
  getWallSlicesPtr,
  getWallSliceObjSizeLg2,
  getMinWallTopPtr,
  getMaxWallTopPtr,
  getMinWallBottomPtr,
  getMaxWallBottomPtr,
  getViewportPtr,
  getPlayerPtr,
  getMaxWallDistancePtr,
} from './raycaster/raycaster';
import { 
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
  getWallSliceMipMapIdxPtr,
  getWallSliceFloorWallXPtr,
  getWallSliceFloorWallYPtr,
  getWallSliceProjHeightPtr,
  getWallSliceClipTopPtr,
} from './raycaster/wallslice';
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
} from './frameColorRGBA';

const syncLoc = utils.getArrElPtr<i32>(syncArrayPtr, workerIdx);
const sleepLoc = utils.getArrElPtr<i32>(sleepArrayPtr, workerIdx);

const MAIN_THREAD_IDX = mainWorkerIdx;

// let map = changetype<Map>(NULL_PTR);
let raycaster = changetype<Raycaster>(NULL_PTR);
let textures = changetype<SArray<Texture>>(NULL_PTR);
let mipmaps = changetype<SArray<BitImageRGBA>>(NULL_PTR);

function initMap(mapWidth: i32, mapHeight: i32): void {
  const map = newMap(mapWidth, mapHeight);
  raycaster.Map = map;
}


function initData(): void {
  if (workerIdx == MAIN_THREAD_IDX) {
    textures = initTextures();
    mipmaps = initMipMaps(textures);

    myAssert(raycasterPtr == NULL_PTR);
    raycaster = newRaycaster();

    const viewport = newViewport();
    raycaster.Viewport = viewport;

    const player = newPlayer();
    raycaster.Player = player;
  } else {
    textures = changetype<SArray<Texture>>(texturesPtr);
    mipmaps = changetype<SArray<BitImageRGBA>>(mipmapsPtr);
    myAssert(raycasterPtr != NULL_PTR);
    raycaster = changetype<Raycaster>(raycasterPtr);
  }
}

function init(): void {
  if (workerIdx == MAIN_THREAD_IDX) {
    initSharedHeap();
    // logi(align<u64>());
    // logi(hrTimerPtr);
    // const t0 = <u64>process.hrtime();
    // draw.clearBg(0, frameHeight, 0xff_00_00_00);
    // const t1 = <u64>process.hrtime();
    // store<u64>(hrTimerPtr, t1 - t0);
  }

  initMemManager();
  initData();
}

function getTexturesPtr(): PTR_T {
  return changetype<PTR_T>(textures);
}

function getMipMapsPtr(): PTR_T {
  return changetype<PTR_T>(mipmaps);
}

function getRaycasterPtr(): PTR_T {
  return changetype<PTR_T>(raycaster);
}

function initRaycaster(): void {
  raycaster.init(textures, mipmaps);
}

function render(): void {
  raycaster.render();
}

function getFrameColorRGBAPtr(): PTR_T {
  return raycaster.FrameColorRGBAPtr;
}

function run(): void {
  while (true) {
    if (workerIdx != MAIN_THREAD_IDX) {
      atomic.wait<i32>(syncLoc, 0);
    }

    // utils.sleep(sleepLoc, 16);
    render();

    if (workerIdx != MAIN_THREAD_IDX) {
      atomic.store<i32>(syncLoc, 0);
      atomic.notify(syncLoc);
    }
  }
}

export { 
  init,
  render,
  run,

  initMap,

  initRaycaster,

  getRaycasterPtr,
  getBorderColorPtr,
  getProjYCenterPtr,
  getZBufferPtr,
  getWallSlicesPtr,
  getXWallMapPtr,
  getXWallMapWidth,
  getXWallMapHeight,
  getYWallMapPtr,
  getYWallMapWidth,
  getYWallMapHeight,
  getFloorMapPtr,
  getWallSliceObjSizeLg2,
  getMinWallTopPtr,
  getMaxWallTopPtr,
  getMinWallBottomPtr,
  getMaxWallBottomPtr,
  getMaxWallDistancePtr,

  getViewportPtr,
  getViewportStartXPtr,
  getViewportStartYPtr,
  getViewportWidthPtr,
  getViewportHeightPtr,

  getPlayerPtr,
  getPlayerPosXPtr,
  getPlayerPosYPtr,
  getPlayerPosZPtr,
  getPlayerDirXPtr,
  getPlayerDirYPtr,
  getPlayerPlaneXPtr,
  getPlayerPlaneYPtr,

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
  getWallSliceProjHeightPtr,
  getWallSliceClipTopPtr,

  getFrameColorRGBAPtr,
  getRedLightTablePtr,
  getGreenLightTablePtr,
  getBlueLightTablePtr,
  getRedFogTablePtr,
  getGreenFogTablePtr,
  getBlueFogTablePtr,

  getTexturesPtr,
  getMipMapsPtr,
};
