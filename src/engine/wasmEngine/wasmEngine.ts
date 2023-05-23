import assert from 'assert';
import * as WasmUtils from './wasmMemUtils';
import { AssetManager } from '../assets/assetManager';
import { BPP_RGBA } from '../assets/images/bitImageRGBA';
import { WasmRun, WasmRunParams } from './wasmRun';
import { FONT_Y_SIZE, fontChars } from '../../assets/fonts/font';
import { stringsArrayData } from '../../assets/build/strings';
import { InputManager, KeyCode } from '../input/inputManager';
import { EngineWorkerCommands } from '../engineWorker';
import * as utils from './../utils';
import {
  // BPP_PAL,
  // PAL_ENTRY_SIZE,
  // PALETTE_SIZE,
  PAGE_SIZE_BYTES,
} from '../../common';
import { mainConfig } from '../../config/mainConfig';

// type WasmViews = WasmUtils.views.WasmViews;

type WasmEngineParams = {
  canvas: OffscreenCanvas;
  assetManager: AssetManager;
  auxWorkers: Worker[];
  runLoopInWorker: boolean;
};

const Key2Idx = {
  KeyA: 0,
  KeyB: 1,
};

class WasmEngine {
  private params: WasmEngineParams;
  private ctx: OffscreenCanvasRenderingContext2D;
  private inputManager: InputManager;
  private wasmMem: WebAssembly.Memory;
  private wasmMemConfig: WasmUtils.MemConfig;
  private wasmRegionsSizes: WasmUtils.MemRegionsData;
  private wasmRegionsOffsets: WasmUtils.MemRegionsData;
  private wasmRun: WasmRun;
  private imageData: ImageData;

  public async init(params: WasmEngineParams) {
    this.params = params;
    this.initGfx();
    await this.initWasm();
    this.initInputManager();
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

  private initInputManager() {
    this.inputManager = new InputManager();
    this.initInputHandlers();
  }

  private initInputHandlers() {
    type MappedKey = keyof typeof Key2Idx;
    const { inputKeys } = this.wasmRun.WasmViews;
    const keyHandler = (key: MappedKey, dir: number) => () => {
      inputKeys[Key2Idx[key]] = dir;
    };
    (Object.keys(Key2Idx) as MappedKey[]).forEach((key) => {
      this.inputManager.addKeyHandlers(key, keyHandler(key, 1), keyHandler(key, 0));
    });
  }

  private async initWasm(): Promise<void> {
    this.initWasmMemConfig();
    this.allocWasmMem();
    await this.initWasmRun();
    this.initWasmAssets();
    if (this.params.runLoopInWorker) {
      this.runWorkersWasmLoop();
    }
  }

  private allocWasmMem(): void {
    const startSize = this.wasmRegionsSizes[WasmUtils.MemRegions.START_MEM];
    const startOffset =
      this.wasmRegionsOffsets[WasmUtils.MemRegions.START_MEM];
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
    const wasmMemConfig: WasmUtils.MemConfig = {
      startOffset: mainConfig.wasmMemStartOffset,
      frameBufferRGBASize: numPixels * BPP_RGBA,
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
      imagesIndexSize: WasmUtils.initImages.getImagesIndexSize(),
      imagesSize: this.params.assetManager.ImagesTotalSize,
      // TODO use 64bit/8 byte counter for mem counters? see wasm workerHeapManager
      workersMemCountersSize: numWorkers * Uint32Array.BYTES_PER_ELEMENT,
      inputKeysSize: Object.keys(Key2Idx).length * Uint8Array.BYTES_PER_ELEMENT,
      hrTimerSize: BigUint64Array.BYTES_PER_ELEMENT,
    };

    this.wasmMemConfig = wasmMemConfig;
    const [sizes, offsets] = WasmUtils.getMemRegionsSizesAndOffsets(this.wasmMemConfig);
    this.wasmRegionsSizes = sizes;
    this.wasmRegionsOffsets = offsets;

    console.log('SIZES: ', JSON.stringify(this.wasmRegionsSizes));
    console.log('OFFSETS: ', JSON.stringify(this.wasmRegionsOffsets));
    console.log(
      `wasm mem start offset: ${
        this.wasmRegionsOffsets[WasmUtils.MemRegions.START_MEM]
      }`,
    );
    console.log(
      `wasm mem start size: ${
        this.wasmRegionsSizes[WasmUtils.MemRegions.START_MEM]
      }`,
    );
  }

  private initWasmAssets(): void {
    this.initWasmFontChars();
    this.initWasmStrings();
    this.initWasmImages();
  }

  private initWasmFontChars() {
    WasmUtils.initFontChars.copyFontChars2WasmMem(this.wasmRun.WasmViews.fontChars);
  }

  private initWasmStrings() {
    WasmUtils.initStrings.copyStrings2WasmMem(this.wasmRun.WasmViews.strings);
  }

  private initWasmImages(): void {
    WasmUtils.initImages.copyImages2WasmMem(
      this.params.assetManager.Images,
      this.wasmRun.WasmViews.imagesIndex,
      this.wasmRun.WasmViews.imagesPixels,
    );
  }

  private async initWasmRun() {
    this.wasmRun = new WasmRun();
    const params: WasmRunParams = {
      wasmMem: this.wasmMem,
      wasmMemRegionsSizes: this.wasmRegionsSizes,
      wasmMemRegionsOffsets: this.wasmRegionsOffsets,
      wasmWorkerHeapSize: mainConfig.wasmWorkerHeapPages * PAGE_SIZE_BYTES,
      numImages: this.params.assetManager.Images.length,
      mainWorkerIdx: 0,
      workerIdx: 0, // main thread is 0, aux workers starts from 1
      numWorkers: 1 + this.params.auxWorkers.length,
      frameWidth: this.imageData.width,
      frameHeight: this.imageData.height,
    };
    await this.wasmRun.init(params);
    // now init wasm run for aux workers
    if (this.params.auxWorkers.length > 0) {
      try {
        await Promise.all(this.params.auxWorkers.map((worker, index) => {
          params.workerIdx = index + 1;
          worker.postMessage({
            command: EngineWorkerCommands.INIT_WASM,
            params,
          });
          return new Promise<void>((resolve, reject) => {
            worker.onmessage = ({ data }) => {
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
  }

  private runWorkersWasmLoop() {
    assert(this.params.runLoopInWorker);
    this.params.auxWorkers.forEach((worker) => {
      worker.postMessage({
        command: EngineWorkerCommands.RUN_WASM,
      });
    });
  }

  public render() {
    this.syncWorkers();
    try {
      this.wasmRun.WasmModules.engine.render();
    } catch (e) {
      console.error(e);
    }
    this.waitWorkers();
    this.drawFrame();
    // const views = this.wasmRun.WasmViews;
    // console.log(views.hrTimer[0]);
  }

  private syncWorkers() {
    for (let i = 1; i <= this.params.auxWorkers.length; ++i) {
      utils.syncStore(this.wasmRun.WasmViews.syncArr, i, 1);
      utils.syncNotify(this.wasmRun.WasmViews.syncArr, i);
    }
  }

  private waitWorkers() {
    for (let i = 1; i <= this.params.auxWorkers.length; ++i) {
      utils.syncWait(this.wasmRun.WasmViews.syncArr, i, 1);
    }
  }

  private drawFrame() {
    this.imageData.data.set(this.wasmRun.WasmViews.frameBufferRGBA);
    this.ctx.putImageData(this.imageData, 0, 0);
  }

  public onKeyDown(key: KeyCode) {
    this.inputManager.onKeyDown(key);
  }

  public onKeyUp(key: KeyCode) {
    this.inputManager.onKeyUp(key);
  }
}

export { WasmEngine, WasmEngineParams };
