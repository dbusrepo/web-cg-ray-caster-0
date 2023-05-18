import { myAssert } from './myAssert';
import { initSharedHeap } from './heapAlloc';
import {
  initMemManager,
  alloc,
  free,
} from './workerHeapManager';
import { heapAlloc } from './heapAlloc';
// import { ObjectAllocator } from './objectAllocator';
import * as utils from './utils';
import * as draw from './draw';
import {
  bgColor,
  heapPtr,
  numWorkers,
  mainWorkerIdx,
  workerIdx,
  logi,
  logf,
  frameWidth,
  frameHeight,
  frameBufferPtr,
  syncArrayPtr,
  sleepArrayPtr,
  hrTimerPtr,
} from './importVars';
import { BitImage } from './bitImage';
import { initImages } from './initImages';
// import { DArray, newDArray, deleteDArray } from './darray';
import { Pointer } from './pointer';
import { SArray, newSArray } from './sarray';
import { test } from './test/test';
import { PTR_T, SIZE_T } from './memUtils';

// import { MYIMG, IMG1 } from './_genImportImages';

import {
  usePalette,
  imagesIndexPtr,
  imagesIndexSize,
  imagesDataSize,
  imagesDataPtr,
  numImages,
} from './importVars';
import { stringsDataPtr, stringsDataSize } from './importVars';
import { FONT_Y_SIZE, fontCharsPtr, fontCharsSize } from './importVars';
// import * as strings from './_genImportStrings';

// import { inputKeysPtr } from './genImportVars';

// import { memCountersPtr, memCountersSize } from './importVars';

const syncLoc = utils.getArrElPtr<i32>(syncArrayPtr, workerIdx);
const sleepLoc = utils.getArrElPtr<i32>(sleepArrayPtr, workerIdx);

const MAIN_THREAD_IDX = mainWorkerIdx;

let images: SArray<BitImage> | null = null;

@inline function align<T>(): SIZE_T {
  return alignof<T>();
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
  images = initImages();
  // test();
}

function allocMap(width: usize, height: usize): PTR_T {
  const size = width * height;
  const ptr = heapAlloc(size);
  memory.fill(ptr, 0, size);
  return ptr;
}

function render(): void {

  const r = utils.range(workerIdx, numWorkers, frameHeight);
  const s = <u32>(r >> 32);
  const e = <u32>r;

  // const t0 = <u64>process.hrtime();
  draw.clearBg(s, e, 0xff_00_00_00); // ABGR
  // const t1 = <u64>process.hrtime();
  // store<u64>(hrTimerPtr, t1 - t0);

  // draw.clearBg(s, e, 0xff_ff_00_00); // ABGR

  // logi(workerIdx);

  // // // logi(image.height);
  // if (workerIdx == 1) {
  //   for (let i = s; i != e; ++i) {
  //     let screenPtr: PTR_T = frameBufferPtr + i * frameWidth * 4;
  //     const pixels: PTR_T = image.pixels + i * image.width * 4;
  //     memory.copy(screenPtr, pixels, frameWidth * 4);
  //   }
  // }

  // if (workerIdx == 0) {
  //   draw.drawText(strings.SENT2, 10, 10, 1, 0xFF_00_00_FF);
  //   draw.drawText(strings.SENT2, 10, 18, 2, 0xFF_00_00_FF);
  //   // let y = 20;
  //   // for (let s = 1; s < 5; ) {
  //   //   draw.drawText(strings.SENT2, 10, y, f32(s), 0xFF_00_00_FF);
  //   //   y += FONT_Y_SIZE * s;
  //   //   s++;
  //   // }
  // }

  // logi(load<u8>(inputKeysPtr));
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

export { init, render, run, allocMap };
