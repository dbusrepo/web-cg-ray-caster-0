import assert from 'assert';
import type { WasmMemParams, WasmMemRegionsData } from './wasmMemUtils';
import type { WasmModules } from './wasmLoader';
import * as WasmUtils from './wasmMemUtils';
import * as initImages from './wasmMemInitImages';
import * as initStrings from './wasmMemInitStrings';
import * as initFontChars from './wasmMemInitFontChars';
import { AssetManager } from '../assets/assetManager';
import { InputManager } from '../input/inputManager';
import { BPP_RGBA } from '../assets/images/bitImageRGBA';
import type { WasmRunParams } from './wasmRun';
import { WasmRun } from './wasmRun';
import { FONT_Y_SIZE, fontChars } from '../../assets/fonts/font';
import { stringsArrayData } from '../../assets/build/strings';
import { EngineWorkerCommandsEnum } from '../engineWorker';
import { AuxWorker } from '../auxWorker';
import * as utils from './../utils';
import { KeysEnum } from '../input/keys';
import {
  // BPP_PAL,
  // PAL_ENTRY_SIZE,
  // PALETTE_SIZE,
  PAGE_SIZE_BYTES,
} from '../../common';
import { mainConfig } from '../../config/mainConfig';

type WasmEngineParams = {
  canvas: OffscreenCanvas;
  assetManager: AssetManager;
  inputManager: InputManager;
  mainWorkerIdx: number;
  auxWorkers: AuxWorker[];
  runLoopInWorker: boolean;
};

class WasmEngine {
  private params: WasmEngineParams;
  private ctx: OffscreenCanvasRenderingContext2D;
  private wasmMem: WebAssembly.Memory;
  private wasmMemParams: WasmMemParams;
  private wasmRegionsSizes: WasmMemRegionsData;
  private wasmRegionsOffsets: WasmMemRegionsData;
  private wasmRunParams: WasmRunParams;
  private wasmRun: WasmRun;
  private wasmModules: WasmModules;
  private imageData: ImageData;

  public async init(params: WasmEngineParams) {
    this.params = params;
    this.initGfx();
    await this.initWasm();
    this.initInputHandlers();
  }

  private initGfx() {
    this.ctx = <OffscreenCanvasRenderingContext2D>(
      this.params.canvas.getContext('2d', {
        alpha: false,
        desynchronized: true, // TODO:
      })
    );
    this.ctx.imageSmoothingEnabled = false; // no blur, keep the pixels sharpness
    // this.ctx.imageSmoothingQuality = "low"; // for this, imageSmoothingEnabled must be true
    const { canvas } = this.ctx;
    this.imageData = this.ctx.createImageData(canvas.width, canvas.height);
  }

  private initInputHandlers() {
    let key2idx: Partial<Record<KeysEnum, number>> = {};
    Object.values(KeysEnum).forEach((key: KeysEnum, idx) => {
      key2idx[key] = idx;
    });
    const { inputKeys } = this.wasmRun.WasmViews;
    const keyHandler = (keyOffset: number, state: number) => () => {
      inputKeys[keyOffset] = state;
    };
    Object.values(KeysEnum).forEach((key: KeysEnum) => {
      const keyOffset = key2idx[key]!;
      const keyDownHandler = keyHandler(keyOffset, 1);
      const keyUpHandler = keyHandler(keyOffset, 0);
      this.params.inputManager.addKeyHandlers(key, keyDownHandler, keyUpHandler);
    });
  }

  private async initWasm(): Promise<void> {
    this.initWasmMemConfig();
    this.allocWasmMem();
    await this.initWasmRun();
    this.initWasmAssets();
    await this.initAuxWorkers();
    if (this.params.runLoopInWorker) {
      this.runWorkersWasmLoop();
    }
  }

  private allocWasmMem(): void {
    const startSize = this.wasmRegionsSizes[WasmUtils.MemRegionsEnum.START_MEM];
    const startOffset =
      this.wasmRegionsOffsets[WasmUtils.MemRegionsEnum.START_MEM];
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
    console.log(`wasm mem start pages: ${initial}`);
  }

  private initWasmMemConfig(): void {
    const numPixels = this.imageData.width * this.imageData.height;
    const numWorkers = this.params.auxWorkers.length + 1;

    // set wasm mem regions sizes
    const wasmMemParams: WasmMemParams = {
      startOffset: mainConfig.wasmMemStartOffset,
      frameBufferRGBASize: numPixels * BPP_RGBA, // TODO:
      frameBufferPalSize: 0, // this._cfg.usePalette ? numPixels : 0,
      // eslint-disable-next-line max-len
      paletteSize: 0, // this._cfg.usePalette ? PALETTE_SIZE * PAL_ENTRY_SIZE : 0,
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
      inputKeysSize: Object.keys(KeysEnum).length * Uint8Array.BYTES_PER_ELEMENT,
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

  private initWasmAssets(): void {
    this.initWasmFontChars();
    this.initWasmStrings();
    this.initWasmImages();
  }

  private initWasmFontChars() {
    initFontChars.copyFontChars2WasmMem(this.wasmRun.WasmViews.fontChars);
  }

  private initWasmStrings() {
    initStrings.copyStrings2WasmMem(this.wasmRun.WasmViews.strings);
  }

  private initWasmImages(): void {
    initImages.copyImages2WasmMem(
      this.params.assetManager.Images,
      this.wasmRun.WasmViews.imagesIndex,
      this.wasmRun.WasmViews.imagesPixels,
    );
  }

  private async initWasmRun() {
    this.wasmRun = new WasmRun();
    this.wasmRunParams ={
      wasmMem: this.wasmMem,
      wasmMemRegionsSizes: this.wasmRegionsSizes,
      wasmMemRegionsOffsets: this.wasmRegionsOffsets,
      wasmWorkerHeapSize: mainConfig.wasmWorkerHeapPages * PAGE_SIZE_BYTES,
      numImages: this.params.assetManager.Images.length,
      mainWorkerIdx: this.params.mainWorkerIdx,
      workerIdx: this.params.mainWorkerIdx, // main worker here
      numWorkers: this.params.auxWorkers.length + 1,
      frameWidth: this.imageData.width,
      frameHeight: this.imageData.height,
    };
    await this.wasmRun.init(this.wasmRunParams);
    this.wasmModules = this.wasmRun.WasmModules;
  }

  private async initAuxWorkers() {
    try {
      await Promise.all(this.params.auxWorkers.map((auxWorker) => {
        auxWorker.worker.postMessage({
          command: EngineWorkerCommandsEnum.INIT_WASM,
          params: {
            ...this.wasmRunParams,
            workerIdx: auxWorker.index,
          },
        });
        return new Promise<void>((resolve/*, reject*/) => {
          auxWorker.worker.onmessage = ({ data: _ }) => {
            // TODO: no check for data.status
            resolve();
          };
        });
      }));
    } catch (e) {
      console.log('error initializing wasm in aux workers');
      console.error(e);
    }
  }

  private runWorkersWasmLoop() {
    assert(this.params.runLoopInWorker);
    this.params.auxWorkers.forEach(({ worker }) => {
      worker.postMessage({
        command: EngineWorkerCommandsEnum.RUN_WASM,
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
    for (let i = 1; i <= this.params.auxWorkers.length; ++i) {
      utils.syncStore(this.wasmRun.WasmViews.syncArr, i, 1);
      utils.syncNotify(this.wasmRun.WasmViews.syncArr, i);
    }
  }

  public waitWorkers() {
    for (let i = 1; i <= this.params.auxWorkers.length; ++i) {
      utils.syncWait(this.wasmRun.WasmViews.syncArr, i, 1);
    }
  }

  public drawFrame() {
    this.imageData.data.set(this.wasmRun.WasmViews.frameBufferRGBA);
    this.ctx.putImageData(this.imageData, 0, 0);
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
  
  public get ImageData(): ImageData {
    return this.imageData;
  }
}

export type { WasmEngineParams };
export { WasmEngine };
