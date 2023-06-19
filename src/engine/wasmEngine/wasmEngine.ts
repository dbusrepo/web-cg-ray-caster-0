import assert from 'assert';
// import * as utils from './../utils';
import { randColor, sleep } from '../utils';
import type { WasmMemParams, WasmMemRegionsData } from './wasmMemUtils';
import type { WasmModules } from './wasmLoader';
import * as WasmUtils from './wasmMemUtils';
import * as initImages from './wasmMemInitImages';
import * as initStrings from './wasmMemInitStrings';
import * as initFontChars from './wasmMemInitFontChars';
import { AssetManager } from '../assets/assetManager';
import type { Key } from '../../input/inputManager';
import { InputManager, keys, keyOffsets } from '../../input/inputManager';
import { BPP_RGBA } from '../assets/images/bitImageRGBA';
import type { WasmRunParams } from './wasmRun';
import { WasmRun } from './wasmRun';
import type { WasmViews } from './wasmViews';
import { buildWasmMemViews } from './wasmViews';
import { FONT_Y_SIZE, fontChars } from '../../../assets/fonts/font';
import { stringsArrayData } from '../../../assets/build/strings';
import { AuxWasmWorkerDesc, AuxWasmWorkerCommandEnum } from './auxWasmWorker';
import { mainConfig } from '../../config/mainConfig';
import {
  // BPP_PAL,
  // PAL_ENTRY_SIZE,
  // PALETTE_SIZE,
  PAGE_SIZE_BYTES,
} from '../../common';

type WasmEngineParams = {
  imageWidth: number;
  imageHeight: number;
  assetManager: AssetManager;
  inputManager: InputManager;
  numAuxWasmWorkers: number;
};

class WasmEngine {
  private params: WasmEngineParams;
  private wasmMem: WebAssembly.Memory;
  private wasmMemParams: WasmMemParams;
  private wasmRegionsSizes: WasmMemRegionsData;
  private wasmRegionsOffsets: WasmMemRegionsData;
  private wasmViews: WasmViews;
  private wasmRunParams: WasmRunParams;
  private wasmRun: WasmRun;
  private wasmModules: WasmModules;
  private auxWasmWorkers: AuxWasmWorkerDesc[];

  public async init(params: WasmEngineParams) {
    this.params = params;
    await this.initWasm();
    this.addWasmInputKeyHandlers();
  }

  private addWasmInputKeyHandlers() {
    const { inputKeys } = this.wasmViews;
    const keyHandler = (keyOffset: number, state: number) => () => {
      inputKeys[keyOffset] = state;
    };

    (Object.entries(keyOffsets) as [Key, number][]).forEach(([key, keyOffset]) => {
      const keyDownHandler = keyHandler(keyOffset, 1);
      const keyUpHandler = keyHandler(keyOffset, 0);
      this.params.inputManager.addKeyHandlers(key, keyDownHandler, keyUpHandler);
    });
  }

  private async initWasm(): Promise<void> {
    this.initWasmMemParams();
    this.initWasmMemRegions();
    this.allocWasmMem();
    this.initMemViews();
    this.initWasmAssets();
    await this.initWasmRun();
    await this.runAuxWasmWorkers();
  }

  private allocWasmMem(): void {
    const startSize = this.wasmRegionsSizes[WasmUtils.MemRegionsEnum.START_MEM];
    const startOffset = this.wasmRegionsOffsets[WasmUtils.MemRegionsEnum.START_MEM];
    const wasmMemStartTotalSize = startOffset + startSize;
    const { wasmMemStartPages: initial, wasmMemMaxPages: maximum } = mainConfig;
    assert(initial * PAGE_SIZE_BYTES >= wasmMemStartTotalSize);
    const memory = new WebAssembly.Memory({
      initial,
      maximum,
      shared: true,
    });
    this.wasmMem = memory;
    console.log(
      `wasm mem pages required: ${Math.ceil(
        wasmMemStartTotalSize / PAGE_SIZE_BYTES,
      )}`,
    );
    console.log(`wasm mem config start pages: ${initial}`);
  }

  private initWasmMemParams(): void {

    const { imageWidth, imageHeight } = this.params;
    const numTotalWorkers = 1 + this.params.numAuxWasmWorkers;

    // set wasm mem regions sizes
    this.wasmMemParams = {
      // frameBufferPalSize: 0, // this._cfg.usePalette ? numPixels : 0,
      // paletteSize: 0, // this._cfg.usePalette ? PALETTE_SIZE * PAL_ENTRY_SIZE : 0,
      startOffset: mainConfig.wasmMemStartOffset,
      rgbaSurface0size: imageWidth * imageHeight * BPP_RGBA,
      rgbaSurface1size: 0,
      syncArraySize: numTotalWorkers * Int32Array.BYTES_PER_ELEMENT,
      sleepArraySize: numTotalWorkers * Int32Array.BYTES_PER_ELEMENT,
      numWorkers: numTotalWorkers,
      workerHeapSize: PAGE_SIZE_BYTES * mainConfig.wasmWorkerHeapPages,
      sharedHeapSize: mainConfig.wasmSharedHeapSize,
      fontCharsSize: fontChars.length * FONT_Y_SIZE,
      stringsSize: stringsArrayData.length,
      imagesIndexSize: initImages.getImagesIndexSize(),
      imagesSize: this.params.assetManager.ImagesTotalSize,
      // TODO use 64bit/8 byte counter for mem counters? see wasm workerHeapManager
      workersMemCountersSize: numTotalWorkers * Uint32Array.BYTES_PER_ELEMENT,
      inputKeysSize: Object.values(keys).length * Uint8Array.BYTES_PER_ELEMENT,
      hrTimerSize: BigUint64Array.BYTES_PER_ELEMENT,
    };

  }

  private initWasmMemRegions(): void {
    const [sizes, offsets] = WasmUtils.getMemRegionsSizesAndOffsets(this.wasmMemParams);
    this.wasmRegionsSizes = sizes;
    this.wasmRegionsOffsets = offsets;

    console.log('wasm mem regions sizes: ', JSON.stringify(this.wasmRegionsSizes));
    console.log('wasm mem regions offsets: ', JSON.stringify(this.wasmRegionsOffsets));
    console.log(
      `wasm mem start offset: ${
        this.wasmRegionsOffsets[WasmUtils.MemRegionsEnum.START_MEM]
      }`,
    );
    console.log(
      `wasm mem start size: ${
        this.wasmRegionsSizes[WasmUtils.MemRegionsEnum.START_MEM]
      }`,
    );
  }

  private initMemViews(): void {
    this.wasmViews = buildWasmMemViews(
      this.wasmMem,
      this.wasmRegionsOffsets,
      this.wasmRegionsSizes,
    );
  }

  private initWasmAssets(): void {
    this.initWasmFontChars();
    this.initWasmStrings();
    this.initWasmImages();
  }

  private initWasmFontChars() {
    initFontChars.copyFontChars2WasmMem(this.wasmViews.fontChars);
  }

  private initWasmStrings() {
    initStrings.copyStrings2WasmMem(this.wasmViews.strings);
  }

  private initWasmImages(): void {
    initImages.copyImages2WasmMem(
      this.params.assetManager.Images,
      this.wasmViews.imagesIndex,
      this.wasmViews.imagesPixels,
    );
  }

  private async initWasmRun() {

    this.wasmRun = new WasmRun();

    const { imageWidth, imageHeight } = this.params;

    this.wasmRunParams = {
      wasmMem: this.wasmMem,
      wasmMemRegionsSizes: this.wasmRegionsSizes,
      wasmMemRegionsOffsets: this.wasmRegionsOffsets,
      wasmWorkerHeapSize: mainConfig.wasmWorkerHeapPages * PAGE_SIZE_BYTES,
      mainWorkerIdx: 0, // main worker idx 0
      workerIdx: 0,
      numWorkers: this.wasmMemParams.numWorkers,
      numImages: this.params.assetManager.Images.length,
      surface0sizes: [imageWidth, imageHeight],
      surface1sizes: [0, 0], // not used
    };

    await this.wasmRun.init(this.wasmRunParams, this.wasmViews);
    this.wasmModules = this.wasmRun.WasmModules;

    Atomics.store(this.wasmViews.sleepArr, 0, 0); // main worker idx 0
    Atomics.store(this.wasmViews.syncArr, 0, 0);
  }

  private async runAuxWasmWorkers() {
    console.log(`num aux wasm workers: ${this.params.numAuxWasmWorkers}`);
    this.auxWasmWorkers = [];
    if (this.params.numAuxWasmWorkers > 0) {
      await this.initAuxWasmWorkers();
      for (let i = 0; i < this.auxWasmWorkers.length; ++i) {
        const { index: workerIdx } = this.auxWasmWorkers[i];
        Atomics.store(this.wasmViews.sleepArr, workerIdx, 0);
        Atomics.store(this.wasmViews.syncArr, workerIdx, 0);
      }
      this.auxWasmWorkers.forEach(({ worker }) => {
        worker.postMessage({
          command: AuxWasmWorkerCommandEnum.RUN,
        });
      });
    }
  }

  private async initAuxWasmWorkers() {
    assert(this.params.numAuxWasmWorkers > 0);
    const initStart = Date.now();
    try {
      let nextWorkerIdx = 1; // start from 1, main worker idx is 0
      const genWorkerIdx = () => {
        return nextWorkerIdx++;
      };
      let remWorkers = this.params.numAuxWasmWorkers;
      await new Promise<void>((resolve, reject) => {
        for (let i = 0; i < this.params.numAuxWasmWorkers; ++i) {
          const workerIndex = genWorkerIdx();
          const wasmWorker: AuxWasmWorkerDesc = {
            index: workerIndex,
            worker: new Worker(
              new URL('./auxWasmWorker.ts', import.meta.url),
              {
                name: `aux-wasm-worker-${workerIndex}`,
                type: 'module',
              },
            )
          };
          this.auxWasmWorkers.push(wasmWorker);
          const workerParams: WasmRunParams = {
            ...this.wasmRunParams,
            workerIdx: workerIndex,
          };
          wasmWorker.worker.postMessage({
            command: AuxWasmWorkerCommandEnum.INIT,
            params: workerParams,
          });
          wasmWorker.worker.onmessage = ({ data }) => {
            --remWorkers;
            console.log(
              `Aux wasm worker id=${workerIndex} init, left count=${remWorkers}, time=${
Date.now() - initStart
}ms with data = ${JSON.stringify(data)}`,
            );
            if (remWorkers === 0) {
              console.log(`Aux wasm workers init done. After ${Date.now() - initStart}ms`);
              resolve();
            }
          };
          wasmWorker.worker.onerror = (error) => {
            console.log(`Aux wasm worker id=${workerIndex} error: ${error.message}\n`);
            reject(error);
          };
        }
      });
    } catch (error) {
      console.error(`Error during aux wasm workers init: ${JSON.stringify(error)}`);
    }
  }

  public render() {
    this.syncWorkers();
    try {
      this.wasmModules.engine.render();
    } catch (ex) {
      console.error(ex);
      throw ex;
    }
    this.waitWorkers();
    // const views = this.wasmRun.WasmViews;
    // console.log(views.hrTimer[0]);
  }

  private syncWorkers() {
    for (let i = 0; i < this.auxWasmWorkers.length; ++i) {
      const { index: workerIdx } = this.auxWasmWorkers[i];
      Atomics.store(this.wasmViews.syncArr, workerIdx, 1);
      Atomics.notify(this.wasmViews.syncArr, workerIdx);
    }
  }

  private waitWorkers() {
    for (let i = 0; i < this.auxWasmWorkers.length; ++i) {
      const { index: workerIdx } = this.auxWasmWorkers[i];
      Atomics.wait(this.wasmViews.syncArr, workerIdx, 1);
    }
  }

  public get WasmRun(): WasmRun {
    return this.wasmRun;
  }

  public get WasmMem(): WebAssembly.Memory {
    return this.wasmMem;
  }

  public get WasmMemParams(): WasmMemParams {
    return this.wasmMemParams;
  }

  public get WasmRunParams(): WasmRunParams {
    return this.wasmRunParams;
  }

  public get WasmRegionsSizes(): WasmMemRegionsData {
    return this.wasmRegionsSizes;
  }

  public get WasmRegionsOffsets(): WasmMemRegionsData {
    return this.wasmRegionsOffsets;
  }

  public get WasmModules(): WasmModules {
    return this.wasmModules;
  }
  
  public get WasmViews(): WasmViews {
    return this.wasmViews;
  }
}

export type { WasmEngineParams };
export { WasmEngine };
