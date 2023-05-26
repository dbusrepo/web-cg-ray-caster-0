// import assert from 'assert';
import * as WasmUtils from './wasmMemUtils';

import type { WasmViews } from './wasmViews';
import { buildWasmMemViews } from './wasmViews';
import type { WasmModules, WasmImports } from './wasmLoader';
import { loadWasmModules } from './wasmLoader';

// import { syncStore, randColor, sleep } from './utils';

import {
  FONT_X_SIZE,
  FONT_Y_SIZE,
  FONT_SPACING,
} from '../../assets/fonts/font';

import { syncStore } from './../utils';

type WasmRunParams = {
  wasmMem: WebAssembly.Memory;
  wasmMemRegionsOffsets: WasmUtils.WasmMemRegionsData;
  wasmMemRegionsSizes: WasmUtils.WasmMemRegionsData;
  wasmWorkerHeapSize: number;
  mainWorkerIdx: number;
  workerIdx: number;
  numWorkers: number;
  frameWidth: number;
  frameHeight: number;
  numImages: number;
  // usePalette: boolean;
};

class WasmRun {
  protected params: WasmRunParams;
  protected wasmViews: WasmViews;
  protected wasmModules: WasmModules;

  public async init(params: WasmRunParams) {
    this.params = params;
    await this.initWasm();
  }

  private async initWasm(): Promise<void> {
    this.buildMemViews();
    await this.loadWasmModules();
  }

  protected buildMemViews(): void {
    const {
      wasmMem: mem,
      wasmMemRegionsOffsets: memOffsets,
      wasmMemRegionsSizes: memSizes,
    } = this.params;

    this.wasmViews = buildWasmMemViews(
      mem,
      memOffsets,
      memSizes,
    );

    const { workerIdx } = this.params;
    syncStore(this.wasmViews.syncArr, workerIdx, 0);
    syncStore(this.wasmViews.sleepArr, workerIdx, 0);
  }

  private buildWasmImports(): WasmImports {
    const {
      wasmMem: memory,
      wasmMemRegionsSizes: memSizes,
      wasmMemRegionsOffsets: memOffsets,
      wasmWorkerHeapSize: workerHeapSize,
    } = this.params;

    const { frameWidth, frameHeight, mainWorkerIdx, numWorkers, numImages, workerIdx } = this.params;

    const logf = (f: number) =>
      console.log(`[wasm] Worker [${workerIdx}]: ${f}`);
    const logi = (i: number) => {
      // console.trace();
      console.log(`[wasm] Worker [${workerIdx}]: ${i}`);
    };

    return {
      memory,
      frameWidth,
      frameHeight,
      frameBufferPtr: memOffsets[WasmUtils.MemRegionsEnum.FRAMEBUFFER_RGBA],
      syncArrayPtr: memOffsets[WasmUtils.MemRegionsEnum.SYNC_ARRAY],
      sleepArrayPtr: memOffsets[WasmUtils.MemRegionsEnum.SLEEP_ARRAY],
      mainWorkerIdx,
      workerIdx,
      numWorkers,
      workersHeapPtr: memOffsets[WasmUtils.MemRegionsEnum.WORKERS_HEAPS],
      workerHeapSize,
      heapPtr: memOffsets[WasmUtils.MemRegionsEnum.HEAP],
      bgColor: 0xff_00_00_00, // randColor(),
      // usePalette: this._config.usePalette ? 1 : 0,
      usePalette: 0,
      fontCharsPtr: memOffsets[WasmUtils.MemRegionsEnum.FONT_CHARS],
      fontCharsSize: memSizes[WasmUtils.MemRegionsEnum.FONT_CHARS],
      numImages,
      imagesIndexSize: memSizes[WasmUtils.MemRegionsEnum.IMAGES_INDEX],
      imagesIndexPtr: memOffsets[WasmUtils.MemRegionsEnum.IMAGES_INDEX],
      imagesDataPtr: memOffsets[WasmUtils.MemRegionsEnum.IMAGES],
      imagesDataSize: memSizes[WasmUtils.MemRegionsEnum.IMAGES],
      stringsDataPtr: memOffsets[WasmUtils.MemRegionsEnum.STRINGS],
      stringsDataSize: memSizes[WasmUtils.MemRegionsEnum.STRINGS],
      workersMemCountersPtr: memOffsets[WasmUtils.MemRegionsEnum.MEM_COUNTERS],
      workersMemCountersSize: memSizes[WasmUtils.MemRegionsEnum.MEM_COUNTERS],
      inputKeysPtr: memOffsets[WasmUtils.MemRegionsEnum.INPUT_KEYS],
      inputKeysSize: memSizes[WasmUtils.MemRegionsEnum.INPUT_KEYS],
      hrTimerPtr: memOffsets[WasmUtils.MemRegionsEnum.HR_TIMER],

      FONT_X_SIZE,
      FONT_Y_SIZE,
      FONT_SPACING,

      logi,
      logf,
    };
  }

  private async loadWasmModules(): Promise<void> {
    const wasmImports = this.buildWasmImports();
    this.wasmModules = await loadWasmModules(wasmImports);
  }

  get WasmViews(): WasmViews {
    return this.wasmViews;
  }

  get WasmModules(): WasmModules {
    return this.wasmModules;
  }
}

export type { WasmRunParams };
export { WasmRun };
