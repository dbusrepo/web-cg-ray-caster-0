import assert from 'assert';
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
import { EngineWorkerCommandEnum } from '../engineWorker';
import { EngineWorkerDesc } from '../engineWorker';
import * as utils from './../utils';
import { mainConfig } from '../../config/mainConfig';
import {
  // BPP_PAL,
  // PAL_ENTRY_SIZE,
  // PALETTE_SIZE,
  PAGE_SIZE_BYTES,
} from '../../common';

type WasmEngineParams = {
  engineCanvas: OffscreenCanvas;
  assetManager: AssetManager;
  inputManager: InputManager;
  engineWorkers: EngineWorkerDesc[];
  mainWorkerIdx: number;
  runLoopInWorker: boolean;
};

class WasmEngine {
  private params: WasmEngineParams;
  private ctx2d: OffscreenCanvasRenderingContext2D;
  private engineImageData: ImageData;
  private wasmMem: WebAssembly.Memory;
  private wasmMemParams: WasmMemParams;
  private wasmRegionsSizes: WasmMemRegionsData;
  private wasmRegionsOffsets: WasmMemRegionsData;
  private wasmViews: WasmViews;
  private wasmRunParams: WasmRunParams;
  private wasmRun: WasmRun;
  private wasmModules: WasmModules;

  public async init(params: WasmEngineParams) {
    this.params = params;
    this.initGfx();
    await this.initWasm();
    this.initInputHandlers();
  }

  private get2dCtxFromCanvas(canvas: OffscreenCanvas) {
    const ctx = <OffscreenCanvasRenderingContext2D>(
      canvas.getContext('2d', {
        alpha: false,
        desynchronized: true,
      })
    );
    ctx.imageSmoothingEnabled = false; // no blur, keep the pixels sharpness
    return ctx;
  }

  private initGfx() {
    this.ctx2d = this.get2dCtxFromCanvas(this.params.engineCanvas);
    this.engineImageData = this.ctx2d.createImageData(
      this.params.engineCanvas.width,
      this.params.engineCanvas.height);
  }

  private initInputHandlers() {
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
    this.initWasmMemConfig();
    this.allocWasmMem();
    this.initMemViews();
    this.initWasmAssets();
    await this.initWasmRun();
    if (this.params.engineWorkers.length) {
      await this.initEngineWorkers();
      if (this.params.runLoopInWorker) {
        this.runWorkersWasmLoop();
      }
    }
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

  private initWasmMemConfig(): void {

    const { width: engineImageWidth, height: engineImageHeight } = this.engineImageData

    const numWorkers = this.params.engineWorkers.length + 1;

    // set wasm mem regions sizes
    const wasmMemParams: WasmMemParams = {
      // frameBufferPalSize: 0, // this._cfg.usePalette ? numPixels : 0,
      // paletteSize: 0, // this._cfg.usePalette ? PALETTE_SIZE * PAL_ENTRY_SIZE : 0,
      startOffset: mainConfig.wasmMemStartOffset,
      rgbaSurface0size: engineImageWidth * engineImageHeight * BPP_RGBA,
      rgbaSurface1size: 0,
      syncArraySize: numWorkers * Int32Array.BYTES_PER_ELEMENT,
      sleepArraySize: numWorkers * Int32Array.BYTES_PER_ELEMENT,
      numWorkers,
      workerHeapSize: PAGE_SIZE_BYTES * mainConfig.wasmWorkerHeapPages,
      sharedHeapSize: mainConfig.wasmSharedHeapSize,
      fontCharsSize: fontChars.length * FONT_Y_SIZE,
      stringsSize: stringsArrayData.length,
      imagesIndexSize: initImages.getImagesIndexSize(),
      imagesSize: this.params.assetManager.ImagesTotalSize,
      // TODO use 64bit/8 byte counter for mem counters? see wasm workerHeapManager
      workersMemCountersSize: numWorkers * Uint32Array.BYTES_PER_ELEMENT,
      inputKeysSize: Object.values(keys).length * Uint8Array.BYTES_PER_ELEMENT,
      hrTimerSize: BigUint64Array.BYTES_PER_ELEMENT,
    };

    this.wasmMemParams = wasmMemParams;
    const [sizes, offsets] = WasmUtils.getMemRegionsSizesAndOffsets(this.wasmMemParams);
    this.wasmRegionsSizes = sizes;
    this.wasmRegionsOffsets = offsets;

    console.log('SIZES: ', JSON.stringify(this.wasmRegionsSizes));
    console.log('OFFSETS: ', JSON.stringify(this.wasmRegionsOffsets));
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

    const { width: engineImageWidth, height: engineImageHeight } = this.engineImageData;

    this.wasmRun = new WasmRun();

    this.wasmRunParams = {
      wasmMem: this.wasmMem,
      wasmMemRegionsSizes: this.wasmRegionsSizes,
      wasmMemRegionsOffsets: this.wasmRegionsOffsets,
      wasmWorkerHeapSize: mainConfig.wasmWorkerHeapPages * PAGE_SIZE_BYTES,
      mainWorkerIdx: this.params.mainWorkerIdx,
      workerIdx: this.params.mainWorkerIdx, // main worker here
      numWorkers: this.params.engineWorkers.length + 1,
      numImages: this.params.assetManager.Images.length,
      surface0sizes: [engineImageWidth, engineImageHeight],
      surface1sizes: [0, 0], // not used
    };

    await this.wasmRun.init(this.wasmRunParams, this.wasmViews);
    this.wasmModules = this.wasmRun.WasmModules;
  }

  private async initEngineWorkers() {
    try {
      await Promise.all(this.params.engineWorkers.map((engineWorker) => {
        engineWorker.worker.postMessage({
          command: EngineWorkerCommandEnum.INIT_WASM,
          params: {
            ...this.wasmRunParams,
            workerIdx: engineWorker.index,
          },
        });
        return new Promise<void>((resolve/*, reject*/) => {
          // remap onmessage
          engineWorker.worker.onmessage = ({ data: _ }) => {
            // TODO: no check for data.status
            resolve();
          };
        });
      }));
    } catch (e) {
      console.log('error initializing wasm in engine workers');
      console.error(e);
    }
  }

  private runWorkersWasmLoop() {
    assert(this.params.runLoopInWorker);
    this.params.engineWorkers.forEach(({ worker }) => {
      worker.postMessage({
        command: EngineWorkerCommandEnum.RUN_WASM,
      });
    });
  }

  public render() {
    this.syncWorkers();
    try {
      this.wasmModules.engine.render();
    } catch (e) {
      console.error(e);
    }
    this.waitWorkers();
    this.drawFrame();
    // const views = this.wasmRun.WasmViews;
    // console.log(views.hrTimer[0]);
  }

  public syncWorkers() {
    for (let i = 1; i <= this.params.engineWorkers.length; ++i) {
      utils.syncStore(this.wasmViews.syncArr, i, 1);
      utils.syncNotify(this.wasmViews.syncArr, i);
    }
  }

  public waitWorkers() {
    for (let i = 1; i <= this.params.engineWorkers.length; ++i) {
      utils.syncWait(this.wasmViews.syncArr, i, 1);
    }
  }

  public drawFrame() {
    this.engineImageData.data.set(this.wasmViews.rgbaSurface0);
    this.ctx2d.putImageData(this.engineImageData, 0, 0);
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

  public get WasmRegionsSizes(): WasmMemRegionsData {
    return this.wasmRegionsSizes;
  }

  public get WasmRegionsOffsets(): WasmMemRegionsData {
    return this.wasmRegionsOffsets;
  }

  public get WasmModules(): WasmModules {
    return this.wasmModules;
  }
  
  get WasmViews(): WasmViews {
    return this.wasmViews;
  }

  // public get ImageData(): ImageData {
  //   // TODO:
  // }
}

export type { WasmEngineParams };
export { WasmEngine };
