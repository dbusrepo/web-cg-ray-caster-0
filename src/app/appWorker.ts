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
import type { AuxAppWorkerParams } from './auxAppWorker';
import { AuxAppWorkerCommandEnum, AuxAppWorkerDesc } from './auxAppWorker';
import type {
  WasmModules,
  WasmEngineModule,
} from '../engine/wasmEngine/wasmLoader';
import { WasmRun } from '../engine/wasmEngine/wasmRun';
import type { WasmEngineParams } from '../engine/wasmEngine/wasmEngine';
import { WasmEngine } from '../engine/wasmEngine/wasmEngine';
import { arrAvg, sleep } from '../engine/utils';
import { AuxWorkerCommandEnum } from '../engine/auxWorker';
import { Raycaster, RaycasterParams } from '../engine/raycaster/raycaster';
import type { AuxWorkerParams } from '../engine/auxWorker';

type AppWorkerParams = {
  engineCanvas: OffscreenCanvas;
};

class AppWorker {
  private static readonly UPDATE_PERIOD_MS =
    (mainConfig.multiplier * MILLI_IN_SEC) / mainConfig.targetUPS;

  private static readonly UPDATE_TIME_MAX = AppWorker.UPDATE_PERIOD_MS * 8;

  private static readonly STATS_ARR_LEN = 15; // fps, rps, ups
  private static readonly FRAME_TIMES_ARR_LEN = 15; // used for ufps
  private static readonly TIMES_SINCE_LAST_FRAME_ARR_LEN = 5; // update, render

  private static readonly STATS_PERIOD_MS = 100; // MILLI_IN_SEC;

  private params: AppWorkerParams;

  private inputManager: InputManager;
  private assetManager: AssetManager;

  private wasmEngine: WasmEngine;
  private wasmRun: WasmRun;
  private wasmEngineModule: WasmEngineModule;

  private wasmRaycasterPtr: number;

  private auxWorkers: AuxAppWorkerDesc[];

  private ctx2d: OffscreenCanvasRenderingContext2D;
  private imageData: ImageData;

  private raycaster: Raycaster;

  public async init(params: AppWorkerParams): Promise<void> {
    this.params = params;
    this.initGfx();
    this.initInputManager();
    await this.initAssetManager();
    await this.initWasmEngine();
    await this.initRaycaster();
    // this.raycaster.renderView();
    await this.runAuxWorkers();
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
    this.wasmRaycasterPtr = this.wasmEngineModule.getRaycasterPtr();
  }

  private initGfx() {
    this.ctx2d = this.get2dCtxFromCanvas(this.params.engineCanvas);
    const { width, height } = this.params.engineCanvas;
    this.imageData = this.ctx2d.createImageData(width, height);
  }

  private get2dCtxFromCanvas(canvas: OffscreenCanvas) {
    const ctx = <OffscreenCanvasRenderingContext2D>canvas.getContext('2d', {
      alpha: false,
      desynchronized: true, // TODO:
    });
    ctx.imageSmoothingEnabled = false; // no blur, keep the pixels sharpness
    return ctx;
  }

  private async initRaycaster() {
    this.raycaster = new Raycaster();
    const raycasterParams: RaycasterParams = {
      wasmRun: this.wasmRun,
    };
    await this.raycaster.init(raycasterParams);
  }

  private async runAuxWorkers() {
    const numWorkers = mainConfig.numAuxWorkers;
    console.log(`num aux workers: ${numWorkers}`);
    this.auxWorkers = [];
    if (numWorkers) {
      await this.initAuxWorkers(numWorkers);
      this.auxWorkers.forEach(({ worker }) => {
        worker.postMessage({
          command: AuxWorkerCommandEnum.RUN,
        });
      });
    }
  }

  private async initAuxWorkers(numAuxWorkers: number) {
    assert(numAuxWorkers > 0);
    assert(this.wasmEngine);
    assert(this.wasmRaycasterPtr);
    const initStart = Date.now();
    try {
      let nextWorkerIdx = 1; // start from 1, 0 is for the main worker
      const genWorkerIdx = () => nextWorkerIdx++;
      let remWorkers = numAuxWorkers;
      await new Promise<void>((resolve, reject) => {
        for (let i = 0; i < numAuxWorkers; ++i) {
          const workerIndex = genWorkerIdx();
          const engineWorker = {
            index: workerIndex,
            worker: new Worker(
              // new URL('../../app/appWorker.ts', import.meta.url),
              new URL('../engine/auxWorker.ts', import.meta.url),
              {
                name: `aux-app-worker-${workerIndex}`,
                type: 'module',
              },
            ),
          };
          this.auxWorkers.push(engineWorker);
          const workerParams: AuxWorkerParams = {
            workerIndex,
            numWorkers: numAuxWorkers,
            wasmRunParams: {
              ...this.wasmEngine.WasmRunParams,
              workerIdx: workerIndex,
              raycasterPtr: this.wasmRaycasterPtr,
              frameColorRGBAPtr: this.wasmEngineModule.getFrameColorRGBAPtr(),
            },
          };
          engineWorker.worker.postMessage({
            command: AuxWorkerCommandEnum.INIT,
            params: workerParams,
          });
          engineWorker.worker.onmessage = ({ data }) => {
            --remWorkers;
            console.log(
              `Aux app worker id=${workerIndex} init,
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
              `Aux app worker id=${workerIndex} error: ${error.message}\n`,
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

  public run(): void {
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

    requestAnimationFrame(mainLoopInit);

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
      this.wasmEngine.syncWorkers(this.auxWorkers);
      // this.wasmEngineModule.render();
      this.raycaster.renderView();
      this.wasmEngine.waitWorkers(this.auxWorkers);
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

    // TODO: test events
    // setInterval(() => {
    //   // console.log('sending...');
    //   postMessage({
    //     command: PanelCommands.EVENT,
    //     params: Math.floor(Math.random() * 100),
    //   });
    // }, 2000);
  }

  private drawWasmFrame() {
    this.imageData.data.set(this.wasmEngine.WasmRun.WasmViews.rgbaSurface0);
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
  [AppWorkerCommandEnum.RUN]: () => {
    appWorker.run();
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
export { AppWorkerCommandEnum };
