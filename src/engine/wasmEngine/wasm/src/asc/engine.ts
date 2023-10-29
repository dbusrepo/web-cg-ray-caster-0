import { myAssert } from './myAssert';
import { initSharedHeap } from './sharedHeapAlloc';
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
  frameColorRGBAPtr,
  texturesPtr,
  mipmapsPtr,
  raycasterPtr,
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
import {
  Player,
  newPlayer,
  getPlayerPosXPtr,
  getPlayerPosYPtr,
  getPlayerDirXPtr,
  getPlayerDirYPtr,
  getPlayerPlaneXPtr,
  getPlayerPlaneYPtr,
  getPlayerPosZPtr,
} from './raycaster/player';
import {
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
} from './raycaster/sprite';
import { Map, newMap } from './raycaster/map';
import { 
  Raycaster,
  newRaycaster,
  getBorderColorPtr,
  getWallHeightPtr,
  getBorderWidthPtr,
  getProjYCenterPtr,
  allocWallZBuffer,
  allocWallSlices,
  getWallSlicesLength,
  getXWallMapPtr,
  getXWallMapWidth,
  getXWallMapHeight,
  getYWallMapPtr,
  getYWallMapWidth,
  getYWallMapHeight,
  getFloorMapPtr,
  getSpritesPtr,
  getSpritesLength,
  getSpritePtr,
  getSpriteObjSizeLg2,
  allocSpritesArr,
  getWallSlicesPtr,
  getWallSlicePtr,
  getWallSliceObjSizeLg2,
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
} from './raycaster/raycaster';
import { 
  allocSlice,
  getSliceDistancePtr,
  getSliceHitPtr,
  getSliceSidePtr,
  getSliceTopPtr,
  getSliceBottomPtr,
  getSliceTexXPtr,
  getSliceTexStepYPtr,
  getSliceTexYPtr,
  getSliceMipMapIdxPtr,
  getSliceFloorWallXPtr,
  getSliceFloorWallYPtr,
  getSliceClipTopPtr,
  getSlicePrevPtrPtr,
  getSliceNextPtrPtr,
  getSliceIsSpritePtr,
} from './raycaster/slice';
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
import { 
  RaycasterParams,
  newRaycasterParams,
  deleteRaycasterParams,
} from './raycaster/raycasterParams';

const syncLoc = utils.getArrElPtr<i32>(syncArrayPtr, workerIdx);
const sleepLoc = utils.getArrElPtr<i32>(sleepArrayPtr, workerIdx);

const MAIN_THREAD_IDX = mainWorkerIdx;

let frameColorRGBA = changetype<FrameColorRGBA>(NULL_PTR);
let textures = changetype<SArray<Texture>>(NULL_PTR);
let mipmaps = changetype<SArray<BitImageRGBA>>(NULL_PTR);

// let map = changetype<Map>(NULL_PTR);
let raycaster = changetype<Raycaster>(NULL_PTR);

function initData(): void {
  if (workerIdx == MAIN_THREAD_IDX) {
    myAssert(frameColorRGBAPtr == NULL_PTR);
    myAssert(texturesPtr == NULL_PTR);
    myAssert(mipmapsPtr == NULL_PTR);
    myAssert(raycasterPtr == NULL_PTR);

    frameColorRGBA = newFrameColorRGBA();
    textures = initTextures();
    mipmaps = initMipMaps(textures);
    raycaster = newRaycaster();

    const raycasterParams = newRaycasterParams();
    raycasterParams.frameColorRGBA = frameColorRGBA;
    raycasterParams.textures = textures;
    raycasterParams.mipmaps = mipmaps;
    raycaster.init(raycasterParams);
    deleteRaycasterParams(raycasterParams);
  } else {
    myAssert(frameColorRGBAPtr != NULL_PTR);
    frameColorRGBA = changetype<FrameColorRGBA>(frameColorRGBAPtr);

    myAssert(texturesPtr != NULL_PTR);
    textures = changetype<SArray<Texture>>(texturesPtr);

    myAssert(mipmapsPtr != NULL_PTR);
    mipmaps = changetype<SArray<BitImageRGBA>>(mipmapsPtr);

    myAssert(raycasterPtr != NULL_PTR);
    raycaster = changetype<Raycaster>(raycasterPtr);
  }
}

function allocMap(mapWidth: i32, mapHeight: i32): void {
  const map = newMap(mapWidth, mapHeight);
  raycaster.Map = map;
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

function render(): void {
  raycaster.render();
}

function getFrameColorRGBAPtr(): PTR_T {
  return changetype<PTR_T>(frameColorRGBA);
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
  allocMap,
  getRaycasterPtr,
  getBorderColorPtr,
  getWallHeightPtr,
  getBorderWidthPtr,
  getProjYCenterPtr,
  allocWallSlices,
  allocWallZBuffer,
  getWallSlicesLength,
  getWallSlicesPtr,
  getWallSlicePtr,
  getSpritesPtr,
  getSpritesLength,
  getSpritePtr,
  getSpriteObjSizeLg2,
  allocSpritesArr,
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

  getSliceDistancePtr,
  getSliceHitPtr,
  getSliceSidePtr,
  getSliceTopPtr,
  getSliceBottomPtr,
  getSliceTexXPtr,
  getSliceTexStepYPtr,
  getSliceTexYPtr,
  getSliceFloorWallXPtr,
  getSliceFloorWallYPtr,
  getSliceMipMapIdxPtr,
  getSliceClipTopPtr,
  getSlicePrevPtrPtr,
  getSliceNextPtrPtr,
  getSliceIsSpritePtr,

  getFrameColorRGBAPtr,
  getRedLightTablePtr,
  getGreenLightTablePtr,
  getBlueLightTablePtr,
  getRedFogTablePtr,
  getGreenFogTablePtr,
  getBlueFogTablePtr,

  getTexturesPtr,
  getMipMapsPtr,

  allocSlice,
  allocTranspSlices,
  resetTranspSlicesPtrs,
  setTranspSliceAtIdx,
};
