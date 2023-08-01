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
  getZBufferPtr,
  getXGridPtr,
  getYGridPtr,
  getWallSlicesPtr,
  allocBuffers,
  getWallSliceObjSizeLg2,
  getMinWallTopPtr,
  getMaxWallBottomPtr,
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

function getViewportPtr(raycasterPtr: PTR_T): PTR_T {
  const raycaster = changetype<Raycaster>(raycasterPtr);
  return raycaster.ViewportPtr;
}

function getPlayerPtr(raycasterPtr: PTR_T): PTR_T {
  const raycaster = changetype<Raycaster>(raycasterPtr);
  return raycaster.PlayerPtr;
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

  // utils.sleep(sleepLoc, 1);

  const r = utils.range(workerIdx, numWorkers, rgbaSurface0height);
  const s = <usize>(r >> 32);
  const e = <usize>r;
  // logi(r as i32);

  // const t0 = <u64>process.hrtime();

  draw.clearBg(s, e, 0xff_00_00_00); // ABGR

  // if (workerIdx == MAIN_THREAD_IDX) {
  //   const color1 = FrameColorRGBA.colorABGR(0xff, 0, 0, 0xff);
  //   for (let l = 0; l < MAX_LIGHT_LEVELS; ++l) {
  //     const color2 = frameColorRGBA.lightColorABGR(color1, l);
  //     // const color2 = frameColorRGBA.fogColorABGR(color1, l);
  //     drawQuad(0, l * 2, 100, 2, color2);
  //   }
  // }


  // logi(c++);
  // heapAlloc(1024*1024);

  // const t1 = <u64>process.hrtime();
  // store<u64>(hrTimerPtr, t1 - t0);

  // render mipmaps test
  // if (workerIdx == MAIN_THREAD_IDX) {
  //   // const mipmap = textures.at(GREYSTONE).getMipmap(0);
  //   const numMipmaps = textures.at(GREYSTONE).NumMipmaps;
  //   // draw all mipmap levels
  //   const scaleX = 3;
  //   const scaleY = 3;
  //   let scrX: SIZE_T = 0;
  //   for (let i: SIZE_T = 0; i < numMipmaps; ++i) {
  //     const mipmap = textures.at(GREYSTONE).getMipmap(i);
  //     let srcPtr: PTR_T = mipmap.Ptr;
  //     let dstPtr: PTR_T = rgbaSurface0ptr + scrX * 4;
  //     myAssert(mipmap.Height * scaleY <= rgbaSurface0height);
  //     myAssert(mipmap.Width * scaleX <= rgbaSurface0width);
  //     for (let i: SIZE_T = 0; i != mipmap.Height; ++i) {
  //       for (let sy: SIZE_T = 0; sy != scaleY; ++sy) {
  //         // memory.copy(dstPtr, srcPtr, mipmap.Width * 4);
  //         let dstRowPtr = dstPtr;
  //         let srcRowPtr = srcPtr;
  //         for (let j: SIZE_T = 0; j != mipmap.Width; ++j) {
  //           const srcPixel = load<u32>(srcRowPtr);
  //           for (let sx: SIZE_T = 0; sx != scaleX; ++sx) {
  //             store<u32>(dstRowPtr, srcPixel);
  //             dstRowPtr += 4;
  //           }
  //           srcRowPtr += 4;
  //         }
  //         dstPtr += rgbaSurface0width * 4;
  //       }
  //       srcPtr += mipmap.Width * 4;
  //     }
  //     // adjust scrX for the next mipmap level
  //     scrX += mipmap.Width * scaleX;
  //   }
  // }

  // if (workerIdx == MAIN_THREAD_IDX) {
    // draw.drawText(strings.SENT2, 10, 10, 1, 0xFF_00_00_FF);
    // draw.drawText(strings.SENT2, 10, 18, 2, 0xFF_00_00_FF);
    // let y = 20;
    // for (let s = 1; s < 5; ) {
    //   draw.drawText(strings.SENT2, 10, y, f32(s), 0xFF_00_00_FF);
    //   y += FONT_Y_SIZE * s;
    //   s++;
    // }
  // }

  // logi(load<u8>(inputKeysPtr));

  // logi(align<u64>());
  // logi(hrTimerPtr);
  // const t0 = <u64>process.hrtime();
  // draw.clearBg(0, frameHeight, 0xff_00_00_00);
  // const t1 = <u64>process.hrtime();
  // store<u64>(hrTimerPtr, t1 - t0);
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

// function run(): void {
//   // initWorkerMem();
//
//   // const p = alloc(32);
//   // const t = alloc(32);
//   // dealloc(p);
//   // logi(load<u32>(WORKER_MEM_COUNTER_PTR));
//
//   // logi(strings.MSG1);
//   // logi(strings.SENT2);
//   // logi(strings.SENT3);
//
//   // logi(load<u8>(fontCharsPtr + 65*8));
//
//   // logi(load<u8>(stringsDataPtr));
//   // logi(load<u8>(stringsDataPtr+1));
//   // logi(load<u8>(stringsDataPtr+2));
//   // logi(load<u8>(stringsDataPtr+3));
//   // logi(load<u8>(stringsDataPtr+4));
//
//   // logi(stringsIndexPtr);
//   // logi(stringsIndexSize);
//   // logi(stringsDataPtr);
//   // logi(stringsDataSize);
//
//   // logi(fontCharsPtr);
//   // logi(fontCharsSize);
//
//   // logi(MYIMG);
//
//   // test();
//   // test images loading
//   // const images = initImages();
//   // for (let i = 0; i < images.length(); ++i) {
//   //   const pixels = images.at(i).pixels;
//   //   logi(<i32>pixels);
//   //   const byte = load<u8>(pixels);
//   //   logi(byte);
//   //   logi(images.at(i).width);
//   //   logi(images.at(i).height);
//   // }
//
//   const images = initImages();
//   const image = images.at(0);
//
//   // const width = image.width;
//   // const height = image.height;
//
//   // let screenPtr: PTR_T;
//   // let pixels: PTR_T;
//
//   // logi(imagesIndexOffset);
//   // logi(image.pixels);
//   // logi(image.width);
//   // logi(image.height);
//   // for (let i = 0; i != frameHeight; ++i) {
//   //   let screenPtr: PTR_T = frameBufferPtr + i * frameWidth * 4;
//   //   const pixels: PTR_T = image.pixels + i * image.width * 4;
//   //   memory.copy(screenPtr, pixels, frameWidth * 4);
//
//   //   // screenPtr = frameBufferPtr + i * frameWidth * 4;
//   //   // pixels = image.pixels + i * image.width * 4;
//   //   // // logi(screenPtr);
//   //   // for (let j = 0; j != frameWidth; ++j) {
//   //   //   const col = load<u32>(pixels);
//   //   //   store<u32>(screenPtr, col);
//   //   //   // store<i32>(screenPtr, 0xFF_00_00_FF);
//   //   //   pixels += 4;
//   //   //   screenPtr += 4;
//   //   //   // logi(j);
//   //   // }
//   // }
//
//   const r = utils.range(workerIdx, numWorkers, frameHeight);
//   const s = <u32>(r >> 32);
//   const e = <u32>r;
//
//   // logi(<i32>process.hrtime())
//
//   // logi(sleepLoc);
//   // logi(load<u32>(sleepLoc));
//
//   draw.clearBg(s, e, 0xff_00_00_00); // ABGR
// }

function drawQuad(x: i32, y: i32, w: i32, h: i32, colorARGB: u32): void {
  for (let i = 0; i < h; ++i) {
    const rowPtr = rgbaSurface0ptr + (y + i) * rgbaSurface0width * BPP_RGBA
    for (let j = 0; j < w; ++j) {
      const screenPtr = rowPtr + (x + j) * BPP_RGBA;
      store<u32>(screenPtr, colorARGB);
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
  getZBufferPtr,
  getWallSlicesPtr,
  getXGridPtr,
  getYGridPtr,
  allocBuffers,
  getWallSliceObjSizeLg2,
  getMinWallTopPtr,
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
