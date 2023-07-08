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
  bgColor,
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
} from './importVars';
import { BitImage } from './bitImage';
import { initImages } from './initImages';
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
} from './raycaster/raycaster';

// TODO:
// import { initRayCaster } from './raycaster/raycaster';

// import { MYIMG, IMG1 } from './gen_importImages';
// import * as strings from './gen_importStrings';

// import {
//   imagesIndexPtr,
//   imagesIndexSize,
//   imagesDataSize,
//   imagesDataPtr,
//   numImages,
// } from './importVars';
// import { stringsDataPtr, stringsDataSize } from './importVars';
// import { FONT_Y_SIZE, fontCharsPtr, fontCharsSize } from './importVars';

// import { test } from './test/test';

const MAIN_THREAD_IDX = mainWorkerIdx;

const syncLoc = utils.getArrElPtr<i32>(syncArrayPtr, workerIdx);
const sleepLoc = utils.getArrElPtr<i32>(sleepArrayPtr, workerIdx);

let images = changetype<SArray<BitImage>>(NULL_PTR);
let raycaster = changetype<Raycaster>(NULL_PTR);
// let viewport = changetype<Viewport>(NULL_PTR);
// let player = changetype<Player>(NULL_PTR);
// let map = changetype<Map>(NULL_PTR);

function getRaycasterXGridPtr(): PTR_T {
  return raycaster.Map.xGridPtr.DataPtr;
}

function getRaycasterYGridPtr(): PTR_T {
  return raycaster.Map.yGridPtr.DataPtr;
}

function allocMap(mapWidth: i32, mapHeight: i32): void {
  const map = newMap(mapWidth, mapHeight);
  raycaster.Map = map;
}

function initData(): void {
  if (workerIdx == MAIN_THREAD_IDX) {

    raycaster = newRaycaster();

    const viewport = newViewport();
    raycaster.Viewport = viewport;

    const player = newPlayer();
    raycaster.Player = player;

  } else {
    raycaster = changetype<Raycaster>(raycasterPtr);
  }

  images = initImages();
}

function init(): void {
  if (workerIdx == MAIN_THREAD_IDX) {
    initSharedHeap();
    initMemManager();
    initData();
  } else {
    initMemManager();
    initData();
  }

  // logi(memory.size());

  // myAssert(images != null);
  // const image = images.at(0);
  // logi(image.Width as i32);
  // logi(image.Height as i32);

  // const arr = newDArray<u32>(1);
  // test();
}

function postInitRaycaster(): void {
  raycaster.postInit();
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

function render(): void {

  // utils.sleep(sleepLoc, 1);

  const r = utils.range(workerIdx, numWorkers, rgbaSurface0height);
  const s = <usize>(r >> 32);
  const e = <usize>r;
  // logi(r as i32);

  // const t0 = <u64>process.hrtime();
  // if (workerIdx == MAIN_THREAD_IDX) {
  draw.clearBg(s, e, 0xff_00_00_00); // ABGR
  // }

  // const t1 = <u64>process.hrtime();
  // store<u64>(hrTimerPtr, t1 - t0);

  // render image test
  // const image = images.at(IMG1);
  // // const byte = load<u8>(image.Ptr);
  // // logi(<i32>byte);

  // if (workerIdx == MAIN_THREAD_IDX) {
  // const minWidth = <usize>Math.min(image.Width, rgbaSurface0width);
  // for (let i = s; i != e; ++i) {
  //   let screenPtr: PTR_T = rgbaSurface0ptr + i * rgbaSurface0width * 4;
  //   const pixels: PTR_T = image.Ptr + i * image.Width * 4;
  //   memory.copy(screenPtr, pixels, minWidth * 4);
  // }
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
//   // logi(usePalette);
//   // logi(imagesIndexPtr);
//   // logi(imagesIndexSize);
//   // logi(imagesDataPtr);
//   // logi(imagesDataSize);
//   // logi(numImages);
//
//   // logi(MYIMG);
//   // logi(imagesIndexSize);
//
//   // test();
//   // test images loading
//   // logi(numImages);
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

export { 
  init,
  render,
  run,

  allocMap,

  getRaycasterPtr,
  getBorderColorPtr,
  getZBufferPtr,
  getRaycasterXGridPtr,
  getRaycasterYGridPtr,
  postInitRaycaster,

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
};
