import assert from 'assert';
import { MILLI_IN_SEC } from '../common';
import { mainConfig } from '../config/mainConfig';
import type { StatsValues } from '../ui/stats/stats';
import { StatsNameEnum } from '../ui/stats/stats';
import { AssetManager } from '../engine/assets/assetManager';
import type { InputEvent, CanvasDisplayResizeEvent } from './events';
import {
  AppPostInitParams,
  AppCommandEnum,
  PanelIdEnum,
  KeyEventsEnum,
} from './appTypes';
import type { KeyHandler, Key } from '../input/inputManager';
import { InputManager, keys, keyOffsets } from '../input/inputManager';
import type { AuxAppWorkerParams, AuxAppWorkerDesc } from './auxAppWorker';
import { AuxAppWorkerCommandEnum } from './auxAppWorker';
import type {
  WasmModules,
  WasmEngineModule,
} from '../engine/wasmEngine/wasmLoader';
import { WasmRun } from '../engine/wasmEngine/wasmRun';
import type { WasmEngineParams } from '../engine/wasmEngine/wasmEngine';
import { WasmEngine } from '../engine/wasmEngine/wasmEngine';
import type { WasmViews } from '../engine/wasmEngine/wasmViews';
import {
  FrameColorRGBAWasm,
  getFrameColorRGBAWasmView,
} from '../engine/wasmEngine/frameColorRGBAWasm';
import { arrAvg, sleep } from '../engine/utils';
import { Raycaster, RaycasterParams } from '../engine/raycaster/raycaster';

type AppWorkerParams = {
  engineCanvas: OffscreenCanvas;
};

class AppWorker {
  private static readonly UPDATE_PERIOD_MS =
    (mainConfig.multiplier * MILLI_IN_SEC) / mainConfig.targetUPS;

  private static readonly UPDATE_TIME_MAX = AppWorker.UPDATE_PERIOD_MS * 8;

  private static readonly STATS_ARR_LEN = 10; // fps, rps, ups
  private static readonly FRAME_TIMES_ARR_LEN = 10; // used for ufps
  private static readonly TIMES_SINCE_LAST_FRAME_ARR_LEN = 5; // update, render

  private static readonly STATS_PERIOD_MS = 100; // MILLI_IN_SEC;

  private params: AppWorkerParams;

  private inputManager: InputManager;
  private assetManager: AssetManager;

  private wasmEngine: WasmEngine;
  private wasmRun: WasmRun;
  private wasmEngineModule: WasmEngineModule;
  private wasmViews: WasmViews;

  private raycasterPtr: number;

  private numWorkers: number; // 1 main + N aux
  private auxWorkers: AuxAppWorkerDesc[];

  private ctx2d: OffscreenCanvasRenderingContext2D;
  private imageData: ImageData;

  private frameColorRGBAWasm: FrameColorRGBAWasm;
  private frameBuf32: Uint32Array;
  private frameStrideBytes: number;

  private raycaster: Raycaster;

  public async init(params: AppWorkerParams): Promise<void> {
    this.params = params;
    this.initGfx();
    this.initInputManager();
    await this.initAssetManager();
    await this.initWasmEngine();
    await this.initAuxWorkers();
    await this.initRaycaster();
    this.initFrameBuf();
    // this.clearBg();
    // this.wasmEngineModule.render();
    // this.raycaster.render();
  }

  private initFrameBuf() {
    const { rgbaSurface0: frameBuf8 } = this.wasmViews;
    this.frameBuf32 = new Uint32Array(
      frameBuf8.buffer,
      0,
      frameBuf8.byteLength / Uint32Array.BYTES_PER_ELEMENT,
    );
    this.frameStrideBytes = this.wasmRun.FrameStrideBytes;
  }

  private initGfx() {
    const { engineCanvas } = this.params;
    this.ctx2d = this.get2dCtxFromCanvas(engineCanvas);
    const { width, height } = engineCanvas;
    this.imageData = this.ctx2d.createImageData(width, height);
  }

  private get2dCtxFromCanvas(canvas: OffscreenCanvas) {
    const ctx = <OffscreenCanvasRenderingContext2D>canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
    });
    ctx.imageSmoothingEnabled = false; // no blur, keep the pixels sharpness
    return ctx;
  }

  private initInputManager() {
    this.inputManager = new InputManager();
    // no key handlers added here, we use the wasm engine key handlers
    // and we check for key status with wasm view
    this.addKeyHandlers();
  }

  private addKeyHandlers() {
    // this.inputManager.addKeyHandlers(keys.KEY_A, () => {}, () => {});
    // this.inputManager.addKeyHandlers(keys.KEY_S, () => {}, () => {});
    // this.inputManager.addKeyHandlers(keys.KEY_D, () => {}, () => {});
  }

  private async initAssetManager() {
    this.assetManager = new AssetManager();
    await this.assetManager.init({
      generateMipmaps: true,
      rotateTextures: true,
    });
  }

  private async initWasmEngine() {
    this.wasmEngine = new WasmEngine();
    const wasmEngineParams: WasmEngineParams = {
      imageWidth: this.imageData.width,
      imageHeight: this.imageData.height,
      assetManager: this.assetManager,
      inputManager: this.inputManager,
      numWorkers: mainConfig.numAuxWorkers,
    };
    await this.wasmEngine.init(wasmEngineParams);
    this.wasmRun = this.wasmEngine.WasmRun;
    this.wasmEngineModule = this.wasmRun.WasmModules.engine;
    this.wasmViews = this.wasmRun.WasmViews;
    this.raycasterPtr = this.wasmEngineModule.getRaycasterPtr();
    this.frameColorRGBAWasm = getFrameColorRGBAWasmView(this.wasmEngineModule);
  }

  private async initRaycaster() {
    this.raycaster = new Raycaster();
    const raycasterParams: RaycasterParams = {
      wasmRun: this.wasmRun,
      frameColorRGBAWasm: this.frameColorRGBAWasm,
    };
    await this.raycaster.init(raycasterParams);
  }

  private async initAuxWorkers() {
    try {
      const numAuxAppWorkers = mainConfig.numAuxWorkers;
      this.numWorkers = 1 + numAuxAppWorkers;
      console.log(`num total workers: ${this.numWorkers}`);
      const genWorkerIdx = (() => {
        let nextWorkerIdx = 1;
        return () => nextWorkerIdx++;
      })();
      this.auxWorkers = new Array<AuxAppWorkerDesc>(numAuxAppWorkers);
      let remWorkers = numAuxAppWorkers;
      const initStart = Date.now();
      await new Promise<void>((resolve, reject) => {
        if (numAuxAppWorkers === 0) {
          resolve();
          return;
        }
        for (let i = 0; i < numAuxAppWorkers; ++i) {
          const workerIdx = genWorkerIdx();
          const engineWorker = {
            workerIdx,
            worker: new Worker(new URL('./auxAppWorker.ts', import.meta.url), {
              name: `aux-app-worker-${workerIdx}`,
              type: 'module',
            }),
          };
          this.auxWorkers[i] = engineWorker;
          const workerParams: AuxAppWorkerParams = {
            workerIdx,
            numWorkers: numAuxAppWorkers,
            wasmRunParams: {
              ...this.wasmEngine.WasmRunParams,
              workerIdx,
              frameColorRGBAPtr: this.wasmEngineModule.getFrameColorRGBAPtr(),
              texturesPtr: this.wasmEngineModule.getTexturesPtr(),
              mipmapsPtr: this.wasmEngineModule.getMipMapsPtr(),
              raycasterPtr: this.raycasterPtr,
            },
          };
          engineWorker.worker.postMessage({
            command: AuxAppWorkerCommandEnum.INIT,
            params: workerParams,
          });
          engineWorker.worker.onmessage = ({ data }) => {
            --remWorkers;
            console.log(
              `Aux app worker id=${workerIdx} initd,
               left count=${remWorkers}, time=${
                 Date.now() - initStart
               }ms with data = ${JSON.stringify(data)}`,
            );
            if (remWorkers === 0) {
              console.log(
                `Aux app workers init done. After ${Date.now() - initStart}ms`,
              );
              resolve();
            }
          };
          engineWorker.worker.onerror = (error) => {
            console.log(
              `Aux app worker id=${workerIdx} error: ${error.message}\n`,
            );
            reject(error);
          };
        }
      });
    } catch (error) {
      console.error(
        `Error during aux app workers init: ${JSON.stringify(error)}`,
      );
    }
  }

  private async runAuxWorkers() {
    this.auxWorkers.forEach(({ worker }) => {
      worker.postMessage({
        command: AuxAppWorkerCommandEnum.RUN,
      });
    });
  }

  public async run(): Promise<void> {
    let lastFrameStartTime: number;
    // let last_render_t: number;
    let updTimeAcc: number;
    let elapsedTimeMs: number;
    let renderThen: number;
    let timeSinceLastFrame: number;
    let avgTimeSinceLastFrame: number;
    let frameStartTime: number;

    let timeLastFrameCnt: number;
    let frameCnt: number;
    let frameTimeCnt: number;
    let renderCnt: number;
    let updateCnt: number;
    let statsCnt: number;

    let lastStatsTime: number;
    let statsTimeAcc: number;

    let frameTimeArr: Float64Array;
    let timeSinceLastFrameArr: Float64Array;
    let fpsArr: Float32Array;
    let upsArr: Float32Array;

    let resync: boolean;
    let isRunning: boolean;
    let isPaused: boolean;

    const mainLoopInit = () => {
      lastFrameStartTime = lastStatsTime = renderThen = performance.now();
      frameTimeArr = new Float64Array(AppWorker.FRAME_TIMES_ARR_LEN);
      updTimeAcc = 0;
      elapsedTimeMs = 0;
      timeSinceLastFrameArr = new Float64Array(
        AppWorker.TIMES_SINCE_LAST_FRAME_ARR_LEN,
      );
      frameCnt = 0;
      frameTimeCnt = 0;
      timeLastFrameCnt = 0;
      statsTimeAcc = 0;
      fpsArr = new Float32Array(AppWorker.STATS_ARR_LEN);
      upsArr = new Float32Array(AppWorker.STATS_ARR_LEN);
      statsCnt = 0;
      resync = false;
      updateCnt = 0;
      renderCnt = 0;
      isRunning = true;
      isPaused = false;
      requestAnimationFrame(frame);
    };

    const begin = () => {
      frameStartTime = performance.now();
      timeSinceLastFrame = frameStartTime - lastFrameStartTime;
      lastFrameStartTime = frameStartTime;
      timeSinceLastFrame = Math.min(
        timeSinceLastFrame,
        AppWorker.UPDATE_TIME_MAX,
      );
      timeSinceLastFrame = Math.max(timeSinceLastFrame, 0);
      timeSinceLastFrameArr[timeLastFrameCnt++ % timeSinceLastFrameArr.length] =
        timeSinceLastFrame;
      // avgTimeSinceLastFrame = timeSinceLastFrame;
      // console.log(`avgTimeSinceLastFrame = ${avgTimeSinceLastFrame}`);
      avgTimeSinceLastFrame = arrAvg(timeSinceLastFrameArr, timeLastFrameCnt);
    };

    const frame = () => {
      requestAnimationFrame(frame);
      begin();
      update();
      render();
      stats();
    };

    const update = () => {
      // if (is_paused) return; // TODO
      updTimeAcc += avgTimeSinceLastFrame;
      // handle timer anomalies
      // spiral of death protection
      if (updTimeAcc > AppWorker.UPDATE_TIME_MAX) {
        resync = true;
      }
      // timer resync if requested
      if (resync) {
        updTimeAcc = 0; // TODO
        // delta_time = App.UPD_PERIOD;
      }
      while (updTimeAcc >= AppWorker.UPDATE_PERIOD_MS) {
        // TODO: see multiplier in update_period def
        // update state with UPDATE_PERIOD_MS
        // this.updateState(STEP, t / MULTIPLIER);
        this.updateState(0, AppWorker.UPDATE_PERIOD_MS / 2);
        updTimeAcc -= AppWorker.UPDATE_PERIOD_MS;
        updateCnt++;
      }
    };

    const render = () => {
      this.syncWorkers();
      // this.clearBg();
      // this.wasmEngineModule.render();
      this.raycaster.render();
      this.waitWorkers();
      this.drawWasmFrame();
      saveFrameTime();
      renderCnt++;
    };

    const saveFrameTime = () => {
      const frameTime = performance.now() - frameStartTime;
      frameTimeArr[frameTimeCnt++ % frameTimeArr.length] = frameTime;
    };

    const stats = () => {
      ++frameCnt;
      statsTimeAcc += timeSinceLastFrame;
      if (statsTimeAcc >= AppWorker.STATS_PERIOD_MS) {
        statsTimeAcc %= AppWorker.STATS_PERIOD_MS;
        // const tspent = (tnow - start_time) / App.MILLI_IN_SEC;
        const now = performance.now();
        const elapsed = now - lastStatsTime;
        lastStatsTime = now;
        elapsedTimeMs += elapsed;
        const oneOverElapsed = MILLI_IN_SEC / elapsedTimeMs;
        const fps = frameCnt * oneOverElapsed;
        const ups = updateCnt * oneOverElapsed;
        const stat_idx = statsCnt++ % fpsArr.length;
        fpsArr[stat_idx] = fps;
        upsArr[stat_idx] = ups;
        const avgFps = arrAvg(fpsArr, statsCnt);
        const avgUps = arrAvg(upsArr, statsCnt);
        const avgFrameTime = arrAvg(frameTimeArr, frameTimeCnt);
        const avgUfps = MILLI_IN_SEC / avgFrameTime;
        const statsValues: StatsValues = {
          [StatsNameEnum.FPS]: avgFps,
          [StatsNameEnum.UPS]: avgUps,
          [StatsNameEnum.UFPS]: avgUfps,
        };
        postMessage({
          command: AppCommandEnum.UPDATE_STATS,
          params: statsValues,
        });
      }
    };

    await this.runAuxWorkers();
    requestAnimationFrame(mainLoopInit);

    // TODO: test events
    // setInterval(() => {
    //   // console.log('sending...');
    //   postMessage({
    //     command: PanelCommands.EVENT,
    //     params: Math.floor(Math.random() * 100),
    //   });
    // }, 2000);
  }

  private syncWorkers() {
    for (let i = 0; i < this.auxWorkers.length; ++i) {
      const { workerIdx } = this.auxWorkers[i];
      Atomics.store(this.wasmViews.syncArr, workerIdx, 1);
      Atomics.notify(this.wasmViews.syncArr, workerIdx);
    }
  }

  private waitWorkers() {
    for (let i = 0; i < this.auxWorkers.length; ++i) {
      Atomics.wait(this.wasmViews.syncArr, this.auxWorkers[i].workerIdx, 1);
    }
  }

  // private clearBg() {
  //   this.frameBuf32.fill(0xff_00_00_00);
  //   // for (let i = 0; i < this.frameBuf32.length; ++i) {
  //   //   this.frameBuf32[i] = 0xff_00_00_00;
  //   // }
  // }

  public drawWasmFrame() {
    this.imageData.data.set(this.wasmViews.rgbaSurface0);
    this.ctx2d.putImageData(this.imageData, 0, 0);
  }

  updateState(step: number, time: number) {
    this.raycaster.update(time);
  }

  // not used
  // onKeyDown(inputEvent: InputEvent) {
  //   this.inputManager.onKeyDown(inputEvent.code);
  // }

  // not used
  // onKeyUp(inputEvent: InputEvent) {
  //   this.inputManager.onKeyUp(inputEvent.code);
  // }

  onMouseMove(mouseEvent: MouseEvent) {
    // console.log('on mouse move dx = ', mouseEvent.dx, ' dy = ', mouseEvent.dy);
    if (mouseEvent.dx) {
      // const rotspeed = 0.005;
      const rotspeed = 0.009;
      this.raycaster.rotatePlayer(mouseEvent.dx > 0 ? rotspeed : -rotspeed);
      // this.raycaster.rotatePlayer(mouseEvent.dx * rotspeed);
    }
    // if (mouseEvent.dy) {
    //   this.raycaster.rotateCamera(mouseEvent.dy);
    // }
  }

  onCanvasDisplayResize(displayWidth: number, displayHeight: number) {
    // TODO:
    // console.log('onCanvasDisplayResize', displayWidth, displayHeight);
  }

  get WasmEngine(): WasmEngine {
    return this.wasmEngine;
  }
}

let appWorker: AppWorker;

const enum AppWorkerCommandEnum {
  INIT = 'app_worker_init',
  RUN = 'app_worker_run',
  KEY_DOWN = 'app_worker_key_down',
  KEY_UP = 'app_worker_key_up',
  MOUSE_MOVE = 'app_worker_mouse_move',
  RESIZE_CANVAS_DISPLAY_SIZE = 'app_worker_resize_canvas_display_size',
}

type MouseEvent = {
  dx: number;
  dy: number;
};

const commands = {
  [AppWorkerCommandEnum.INIT]: async (params: AppWorkerParams) => {
    appWorker = new AppWorker();
    await appWorker.init(params);
    postMessage({
      command: AppCommandEnum.APP_WORKER_INITD,
      params: {
        wasmMem: appWorker.WasmEngine.WasmMem,
        wasmMemRegionsOffsets: appWorker.WasmEngine.WasmRegionsOffsets,
        wasmMemRegionsSizes: appWorker.WasmEngine.WasmRegionsSizes,
      },
    });
  },
  [AppWorkerCommandEnum.RUN]: async () => {
    await appWorker.run();
  },
  // not used
  // [AppWorkerCommandEnum.KEY_DOWN]: (inputEvent: InputEvent) => {
  //   appWorker.onKeyDown(inputEvent);
  // },
  // [AppWorkerCommandEnum.KEY_UP]: (inputEvent: InputEvent) => {
  //   appWorker.onKeyUp(inputEvent);
  // },
  [AppWorkerCommandEnum.MOUSE_MOVE]: (mouseEvent: MouseEvent) => {
    appWorker.onMouseMove(mouseEvent);
  },
  [AppWorkerCommandEnum.RESIZE_CANVAS_DISPLAY_SIZE]: (
    resizeEvent: CanvasDisplayResizeEvent,
  ) => {
    const { width, height } = resizeEvent;
    appWorker.onCanvasDisplayResize(width, height);
  },
};

self.onmessage = ({ data: { command, params } }) => {
  if (commands.hasOwnProperty(command)) {
    try {
      commands[command as keyof typeof commands](params);
    } catch (err) {
      console.error(err);
    }
  }
};

export type { AppWorkerParams };
export { AppWorker, AppWorkerCommandEnum };
