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
  frameColorRGBAPtr,
} from './importVars';
import { GREYSTONE } from './gen_importImages';
import { Texture } from './texture';
import { initTextures } from './initTextures';
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
  getPlayerPosXPtr, getPlayerPosYPtr,
  getPlayerDirXPtr, getPlayerDirYPtr,
  getPlayerPlaneXPtr, getPlayerPlaneYPtr,
  getPlayerPitchPtr, getPlayerPosZPtr,
} from './raycaster/player';
import { Map, newMap } from './raycaster/map';
import { 
  Raycaster,
  newRaycaster,
  getBorderColorPtr,
  getProjYCenterPtr,
  getZBufferPtr,
  getXGridPtr,
  getYGridPtr,
  getWallSlicesPtr,
  allocBuffers,
  getWallSliceObjSizeLg2,
  getMinWallTopPtr,
  getMaxWallTopPtr,
  getMinWallBottomPtr,
  getMaxWallBottomPtr,
  getViewportPtr,
  getPlayerPtr,
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
  getWallSliceTexPosYPtr,
  getWallSliceTexIdPtr,
  getWallSliceMipLvlPtr,
  getWallSliceFloorWallXPtr,
  getWallSliceFloorWallYPtr,
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
import {
  drawViewVert,
} from './raycaster/draw';

const syncLoc = utils.getArrElPtr<i32>(syncArrayPtr, workerIdx);
const sleepLoc = utils.getArrElPtr<i32>(sleepArrayPtr, workerIdx);

const MAIN_THREAD_IDX = mainWorkerIdx;

let raycaster = changetype<Raycaster>(NULL_PTR);
let textures = changetype<SArray<Texture>>(NULL_PTR);
let frameColorRGBA = changetype<FrameColorRGBA>(NULL_PTR);

function getFrameColorRGBAPtr(): PTR_T {
  return changetype<PTR_T>(frameColorRGBA);
}

function allocMap(mapWidth: i32, mapHeight: i32): void {
  const map = newMap(mapWidth, mapHeight);
  raycaster.Map = map;
}

function initData(): void {
  if (workerIdx == MAIN_THREAD_IDX) {

    frameColorRGBA = newFrameColorRGBA();

    raycaster = newRaycaster();

    const viewport = newViewport();
    raycaster.Viewport = viewport;

    const player = newPlayer();
    raycaster.Player = player;

  } else {
    frameColorRGBA = changetype<FrameColorRGBA>(frameColorRGBAPtr);
    raycaster = changetype<Raycaster>(raycasterPtr);
  }

  textures = initTextures();
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

  // logi(workerIdx as i32);
  initMemManager();
  initData();
}

function getRaycasterPtr(): PTR_T {
  return changetype<PTR_T>(raycaster);
}

// function drawQuad(x: i32, y: i32, w: i32, h: i32, colorARGB: u32): void {
//   for (let i = 0; i < h; ++i) {
//     const rowPtr = rgbaSurface0ptr + (y + i) * rgbaSurface0width * BPP_RGBA
//     for (let j = 0; j < w; ++j) {
//       const screenPtr = rowPtr + (x + j) * BPP_RGBA;
//       store<u32>(screenPtr, colorARGB);
//     }
//   }
// }

function render(): void {

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
  getProjYCenterPtr,
  getZBufferPtr,
  getWallSlicesPtr,
  getXGridPtr,
  getYGridPtr,
  allocBuffers,
  getWallSliceObjSizeLg2,
  getMinWallTopPtr,
  getMaxWallTopPtr,
  getMinWallBottomPtr,
  getMaxWallBottomPtr,

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
  getPlayerPitchPtr,

  getWallSliceDistancePtr,
  getWallSliceHitPtr,
  getWallSliceSidePtr,
  getWallSliceTopPtr,
  getWallSliceBottomPtr,
  getWallSliceTexXPtr,
  getWallSliceTexStepYPtr,
  getWallSliceTexPosYPtr,
  getWallSliceTexIdPtr,
  getWallSliceMipLvlPtr,
  getWallSliceFloorWallXPtr,
  getWallSliceFloorWallYPtr,

  getFrameColorRGBAPtr,
  getRedLightTablePtr,
  getGreenLightTablePtr,
  getBlueLightTablePtr,
  getRedFogTablePtr,
  getGreenFogTablePtr,
  getBlueFogTablePtr,
};
