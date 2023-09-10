import assert from 'assert';
// import { sleep } from '../utils';
import type { WasmMemParams, WasmMemRegionsData } from './wasmMemUtils';
import type { WasmModules } from './wasmLoader';
import * as wasmUtils from './wasmMemUtils';
import * as wasmImages from './wasmMemInitImages';
import * as wasmStrings from './wasmMemInitStrings';
import * as wasmFontChars from './wasmMemInitFontChars';
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
import { AuxAppWorkerDesc } from '../../app/auxAppWorker';
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
  numWorkers: number;
};

class WasmEngine {
  private params: WasmEngineParams;
  private wasmMem: WebAssembly.Memory;
  private wasmRegionsSizes: WasmMemRegionsData;
  private wasmRegionsOffsets: WasmMemRegionsData;
  private wasmViews: WasmViews;
  private wasmRunParams: WasmRunParams;
  private wasmRun: WasmRun;
  private wasmModules: WasmModules;

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

    (Object.entries(keyOffsets) as [Key, number][]).forEach(
      ([key, keyOffset]) => {
        const keyDownHandler = keyHandler(keyOffset, 1);
        const keyUpHandler = keyHandler(keyOffset, 0);
        this.params.inputManager.addKeyHandlers(
          key,
          keyDownHandler,
          keyUpHandler,
        );
      },
    );
  }

  private async initWasm(): Promise<void> {
    this.initWasmMemRegions();
    this.allocWasmMem();
    this.initMemViews();
    this.initWasmAssets();
    await this.initWasmRun();
  }

  private allocWasmMem(): void {
    const startSize = this.wasmRegionsSizes[wasmUtils.MemRegionsEnum.START_MEM];
    const startOffset =
      this.wasmRegionsOffsets[wasmUtils.MemRegionsEnum.START_MEM];
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

  private get NumTotalWorkers() {
    return 1 + this.params.numWorkers;
  }

  private initWasmMemRegions(): void {
    const { imageWidth, imageHeight } = this.params;
    const numTotalWorkers = this.NumTotalWorkers;

    // set wasm mem regions sizes
    const wasmMemParams: WasmMemParams = {
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
      texturesPixelsSize: this.params.assetManager.PixelsDataSize,
      texturesIndexSize: wasmImages.calcWasmTexturesIndexSize(
        this.params.assetManager.Textures,
      ),
      // TODO use 64bit/8 byte counter for mem counters? see wasm workerHeapManager
      workersMemCountersSize: numTotalWorkers * Uint32Array.BYTES_PER_ELEMENT,
      inputKeysSize: Object.values(keys).length * Uint8Array.BYTES_PER_ELEMENT,
      hrTimerSize: BigUint64Array.BYTES_PER_ELEMENT,
    };

    const [sizes, offsets] =
      wasmUtils.getMemRegionsSizesAndOffsets(wasmMemParams);
    this.wasmRegionsSizes = sizes;
    this.wasmRegionsOffsets = offsets;

    console.log(
      'wasm mem regions sizes: ',
      JSON.stringify(this.wasmRegionsSizes),
    );
    console.log(
      'wasm mem regions offsets: ',
      JSON.stringify(this.wasmRegionsOffsets),
    );
    console.log(
      `wasm mem start offset: ${
        this.wasmRegionsOffsets[wasmUtils.MemRegionsEnum.START_MEM]
      }`,
    );
    console.log(
      `wasm mem start size: ${
        this.wasmRegionsSizes[wasmUtils.MemRegionsEnum.START_MEM]
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
    this.initWasmTextures();
  }

  private initWasmFontChars() {
    wasmFontChars.copyFontChars2WasmMem(this.wasmViews.fontChars);
  }

  private initWasmStrings() {
    wasmStrings.copyStrings2WasmMem(this.wasmViews.strings);
  }

  private initWasmTextures(): void {
    wasmImages.copyTextures2WasmMem(
      this.params.assetManager.Textures,
      this.wasmViews.texturesIndex,
      this.wasmViews.texels,
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
      numWorkers: this.NumTotalWorkers,
      numTextures: this.params.assetManager.NumTextures, // TODO: rename
      surface0sizes: [imageWidth, imageHeight],
      surface1sizes: [0, 0], // not used
      // main thread init this vars here in wasm engine
      frameColorRGBAPtr: 0,
      texturesPtr: 0,
      mipmapsPtr: 0,
      raycasterPtr: 0,
    };

    await this.wasmRun.init(this.wasmRunParams, this.wasmViews);
    this.wasmModules = this.wasmRun.WasmModules;

    Atomics.store(this.wasmViews.sleepArr, 0, 0); // main worker idx 0
    Atomics.store(this.wasmViews.syncArr, 0, 0);
  }

  // public render() {
  //   this.syncWorkers();
  //   try {
  //     this.wasmModules.engine.render();
  //   } catch (ex) {
  //     console.error(ex);
  //     throw ex;
  //   }
  //   this.waitWorkers();
  //   // const views = this.wasmRun.WasmViews;
  //   // console.log(views.hrTimer[0]);
  // }

  public syncWorkers(auxWorkers: AuxAppWorkerDesc[]) {
    for (let i = 0; i < auxWorkers.length; ++i) {
      const { index: workerIdx } = auxWorkers[i];
      Atomics.store(this.wasmViews.syncArr, workerIdx, 1);
      Atomics.notify(this.wasmViews.syncArr, workerIdx);
    }
  }

  public waitWorkers(auxWorkers: AuxAppWorkerDesc[]) {
    for (let i = 0; i < auxWorkers.length; ++i) {
      const { index: workerIdx } = auxWorkers[i];
      Atomics.wait(this.wasmViews.syncArr, workerIdx, 1);
    }
  }

  public get WasmRun(): WasmRun {
    return this.wasmRun;
  }

  public get WasmMem(): WebAssembly.Memory {
    return this.wasmMem;
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
