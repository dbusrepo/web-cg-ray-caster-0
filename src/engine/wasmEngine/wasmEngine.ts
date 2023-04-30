import assert from 'assert';
import * as WasmUtils from './wasmMemUtils';
import { AssetManager } from '../assets/assetManager';
import { WasmRun, WasmRunConfig } from './wasmRun';
import WasmWorkerCommands from './wasmWorkerCommands';
import { WasmWorkerConfig } from './wasmWorker';
import { FONT_Y_SIZE, fontChars } from '../../assets/fonts/font';
import { stringsArrayData } from '../../assets/strings/strings';
import { InputManager, KeyCode } from '../input/inputManager';
import * as utils from './../utils';
import {
  // BPP_PAL,
  BPP_RGBA,
  // PAL_ENTRY_SIZE,
  // PALETTE_SIZE,
  PAGE_SIZE_BYTES,
} from '../../common';
import { mainConfig } from '../../config/mainConfig';

// type WasmViews = WasmUtils.views.WasmViews;

type WasmEngineConfig = {
  canvas: OffscreenCanvas;
  numAuxWorkers: number;
};

class WasmEngine {
  private cfg: WasmEngineConfig;
  private ctx: OffscreenCanvasRenderingContext2D;
  private assetManager: AssetManager;
  private inputManager: InputManager;
  private wasmRunCfg: WasmRunConfig;
  private wasmMem: WebAssembly.Memory;
  private wasmMemConfig: WasmUtils.MemConfig;
  private wasmRegionsSizes: WasmUtils.MemRegionsData;
  private wasmRegionsOffsets: WasmUtils.MemRegionsData;
  private wasmRun: WasmRun;
  private workers: Worker[];
  private imageData: ImageData;

  public async init(cfg: WasmEngineConfig) {
    this.cfg = cfg;
    this.initGfx();
    await this.initAssetManager();
    await this.initWasm();
    await this.initWorkers();
    this.initInputManager();
  }

  private initGfx() {
    this.ctx = <OffscreenCanvasRenderingContext2D>(
      this.cfg.canvas.getContext('2d', { 
        alpha: false,
        desynchronized: true, // TODO:
      })
    );
    this.ctx.imageSmoothingEnabled = false; // no blur, keep the pixels sharpness
    // this.ctx.imageSmoothingQuality = "low"; // for this, imageSmoothingEnabled must be true
    const canvas = this.ctx.canvas;
    this.imageData = this.ctx.createImageData(canvas.width, canvas.height);
  }

  private async initAssetManager() {
    this.assetManager = new AssetManager();
    await this.assetManager.init();
  }

  private initInputManager() {
    this.inputManager = new InputManager();
    this.inputManager.init();
    this.initInputHandlers();
  }

  private initInputHandlers() {
    const key2Idx = {
      KeyA: 0,
      // KeyB: 1,
    };
    type MappedKey = keyof typeof key2Idx;
    const inputArr = this.wasmRun.WasmViews.inputKeys;
    const keyHandler = (key: MappedKey, dir: number) => () => {
      // console.log(`key ${key} ${dir}`);
      inputArr[key2Idx[key]] = dir;
    };
    const keyA = 'KeyA';
    this.inputManager.addKeyDownHandler(keyA, keyHandler(keyA, 1));
    this.inputManager.addKeyUpHandler(keyA, keyHandler(keyA, 0));
    // const keyB = 'KeyB';
    // this.inputManager.addKeyDownHandler(keyB, keyHandler(keyB, 1));
    // this.inputManager.addKeyUpHandler(keyB, keyHandler(keyB, 0));
  }

  private async initWorkers() {
    console.log('#workers: ', 1 + this.cfg.numAuxWorkers);
    this.workers = [];
    if (this.cfg.numAuxWorkers >= 1) {
      await this.launchWorkers();
    }
  }

  private async initWasm(): Promise<void> {
    this.initWasmMemConfig();
    this.allocWasmMem();
    await this.initWasmRun();
    this.initWasmAssets();
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
    const numWorkers = this.getNumWorkers();

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
      imagesSize: this.assetManager.ImagesTotalSize,
      // TODO use 64bit/8 byte counter for mem counters? see wasm workerHeapManager
      workersMemCountersSize: numWorkers * Uint32Array.BYTES_PER_ELEMENT,
      inputKeysSize: 4 * Uint8Array.BYTES_PER_ELEMENT,
      hrTimerSize: BigUint64Array.BYTES_PER_ELEMENT,
    };

    this.wasmMemConfig = wasmMemConfig;
    const [sizes, offsets] = WasmUtils.getMemRegionsSizesAndOffsets(
      this.wasmMemConfig,
    );
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
    WasmUtils.initFontChars.writeFontCharsData(this.wasmRun.WasmViews.fontChars);
  }

  private initWasmStrings() {
    WasmUtils.initStrings.writeStringsData(this.wasmRun.WasmViews.strings);
  }

  private initWasmImages(): void {
    WasmUtils.initImages.writeImages(
      this.assetManager.Images,
      this.wasmRun.WasmViews.imagesPixels,
      this.wasmRun.WasmViews.imagesIndex,
    );
  }

  private getNumWorkers(): number {
    return this.cfg.numAuxWorkers + 1; // #auxiliary workers + main
  }

  private async initWasmRun() {
    this.wasmRun = new WasmRun();
    const wasmRunCfg: WasmRunConfig = {
      wasmMem: this.wasmMem,
      wasmMemRegionsSizes: this.wasmRegionsSizes,
      wasmMemRegionsOffsets: this.wasmRegionsOffsets,
      wasmWorkerHeapSize: mainConfig.wasmWorkerHeapPages * PAGE_SIZE_BYTES,
      numImages: this.assetManager.Images.length,
      mainWorkerIdx: 0,
      workerIdx: 0, // main thread is 0, aux workers starts from 1
      numWorkers: this.getNumWorkers(),
      frameWidth: this.imageData.width,
      frameHeight: this.imageData.height,
    };
    await this.wasmRun.init(wasmRunCfg);
    this.wasmRunCfg = wasmRunCfg;
  }

  private async launchWorkers() {
    assert(this.cfg.numAuxWorkers >= 1);
    console.log('Launching workers...');
    let workerCount = this.cfg.numAuxWorkers;
    const initStart = Date.now();
    try {
      await new Promise<void>((resolve, reject) => {
        for (
          let workerIdx = 1;
          workerIdx <= this.cfg.numAuxWorkers;
          ++workerIdx
        ) {
          const worker = new Worker(
            new URL('./wasmWorker.ts', import.meta.url),
            {
              name: `wasm-worker-${workerIdx}`,
              type: 'module',
            },
          );
          this.workers.push(worker);
          const workerWasmRunConfig: WasmRunConfig = {
            ...this.wasmRunCfg,
            workerIdx,
          };
          const workerConfig: WasmWorkerConfig = {
            wasmRunCfg: workerWasmRunConfig,
          };
          worker.postMessage({
            command: WasmWorkerCommands.INIT,
            params: workerConfig,
          });
          worker.onmessage = ({ data }) => {
            --workerCount;
            console.log(
              `Worker id=${workerIdx} init, left count=${workerCount}, time=${
                Date.now() - initStart
              }ms with data = ${JSON.stringify(data)}`,
            );
            if (workerCount === 0) {
              console.log(
                `Workers init done. After ${Date.now() - initStart}ms`,
              );
              resolve();
            }
          };
          worker.onerror = (error) => {
            console.log(`Worker id=${workerIdx} error: ${error.message}\n`);
            reject(error);
          };
        }
      });
      console.log('Workers initialized. Launching...');
      this.workers.forEach((worker) => {
        worker.postMessage({
          command: WasmWorkerCommands.RUN,
        });
      });
    } catch (error) {
      console.error(`Error during workers init: ${JSON.stringify(error)}`);
    }
  }

  private syncWorkers() {
    for (let i = 1; i <= this.cfg.numAuxWorkers; ++i) {
      utils.syncStore(this.wasmRun.WasmViews.syncArr, i, 1);
      utils.syncNotify(this.wasmRun.WasmViews.syncArr, i);
    }
  }

  private waitWorkers() {
    for (let i = 1; i <= this.cfg.numAuxWorkers; ++i) {
      utils.syncWait(this.wasmRun.WasmViews.syncArr, i, 1);
    }
  }

  private drawFrame() {
    this.imageData.data.set(this.wasmRun.WasmViews.frameBufferRGBA);
    this.ctx.putImageData(this.imageData, 0, 0);
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

  public onKeyDown(key: KeyCode) {
    this.inputManager.onKeyDown(key);
  }

  public onKeyUp(key: KeyCode) {
    this.inputManager.onKeyUp(key);
  }
}

export { WasmEngine, WasmEngineConfig };
