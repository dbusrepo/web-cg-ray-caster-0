import assert from 'assert';
import {
  // BPP_PAL,
  // BPP_RGBA,
  MILLI_IN_SEC,
} from '../common';
import { mainConfig } from '../config/mainConfig';
import type { StatsValues } from '../ui/stats/stats';
import { StatsNameEnum } from '../ui/stats/stats';
import { AssetManager } from '../engine/assets/assetManager';
import type { InputEvent, CanvasDisplayResizeEvent } from './events';
import { AppCommandEnum, PanelIdEnum, KeyEventsEnum } from '../app/appTypes';
import type { KeyHandler, Key } from '../input/inputManager';
import { InputManager, keys, keyOffsets } from '../input/inputManager';
import type { AuxAppWorkerParams } from './auxAppWorker';
import { AuxAppWorkerCommandEnum, AuxAppWorkerDesc } from './auxAppWorker';
import type { WasmModules, WasmEngineModule } from '../engine/wasmEngine/wasmLoader';
import { WasmRun } from '../engine/wasmEngine/wasmRun';
import type { WasmEngineParams } from '../engine/wasmEngine/wasmEngine';
import { WasmEngine } from '../engine/wasmEngine/wasmEngine';
import { arrAvg, randColor, makeColor, sleep } from '../engine/utils';
import { Raycaster, RaycasterParams } from '../engine/raycaster/raycaster';
import type { AuxWorkerParams } from '../engine/auxWorker';
import { AuxWorkerCommandEnum } from '../engine/auxWorker';
import { Viewport, getWasmViewportView } from '../engine/raycaster/viewport';
import { Player, getWasmPlayerView } from '../engine/raycaster/player';
import { drawBorders } from '../engine/raycaster/draw';

type AppWorkerParams = {
  engineCanvas: OffscreenCanvas;
};

class AppWorker {
  private static readonly RENDER_PERIOD_MS = MILLI_IN_SEC / mainConfig.targetRPS;
  private static readonly UPDATE_PERIOD_MS =
    (mainConfig.multiplier * MILLI_IN_SEC) / mainConfig.targetUPS;

  private static readonly UPDATE_TIME_MAX = AppWorker.UPDATE_PERIOD_MS * 8;

  private static readonly STATS_ARR_LEN = 10; // fps, rps, ups
  private static readonly FRAME_TIMES_ARR_LEN = 1; // used for ufps
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

  private wasmBorderColorPtr: number;

  public async init(params: AppWorkerParams): Promise<void> {
    this.params = params;
    this.initGfx();
    this.initInputManager();
    await this.initAssetManager();
    await this.initWasmEngine();
    await this.initRaycaster();
    this.initMap();
    // this.raycaster.castScene();
    drawBorders(this.BorderColor);
    await this.runAuxWorkers();
  }
  
  private async initWasmRaycaster() {
    this.initViewport();
    this.initPlayer();
    this.initBorder();
    this.wasmEngineModule.allocBuffers(this.wasmRaycasterPtr);
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
    const ctx = <OffscreenCanvasRenderingContext2D>(
      canvas.getContext('2d', {
        alpha: false,
        desynchronized: true, // TODO:
      })
    );
    ctx.imageSmoothingEnabled = false; // no blur, keep the pixels sharpness
    return ctx;
  }

  private initBorder() {
    this.wasmBorderColorPtr = this.wasmEngineModule.getBorderColorPtr(this.wasmRaycasterPtr);
    this.BorderColor = makeColor(0xffff00ff);
  }

  private initViewport() {
    const viewport = getWasmViewportView(this.wasmEngineModule, this.wasmRaycasterPtr);
    const VIEWPORT_BORDER = 0;
    viewport.StartX = VIEWPORT_BORDER;
    viewport.StartY = VIEWPORT_BORDER;
    viewport.Width = this.params.engineCanvas.width - VIEWPORT_BORDER * 2;
    viewport.Height = this.params.engineCanvas.height - VIEWPORT_BORDER * 2;
    // console.log('main worker viewport.startX', this.viewport.StartX);
    // console.log('main worker viewport.startY', this.viewport.StartY);
    // console.log('main worker player.posX', this.player.PosX);
    // console.log('main worker player.posY', this.player.PosY);
  }

  private initPlayer() {
    const player = getWasmPlayerView(this.wasmEngineModule, this.wasmRaycasterPtr);
    player.PosX = 0.5;
    player.PosY = 0.5;
    player.DirX = 1;
    player.DirY = 0;
    player.PlaneX = 0;
    player.PlaneY = 0.66;
    player.Pitch = 0;
    player.PosZ = 0.0;
  }

  private async initRaycaster() {
    this.initWasmRaycaster();

    this.raycaster = new Raycaster();
    const raycasterParams: RaycasterParams = {
      wasmRun: this.wasmRun,
      frameStride: this.imageData.width,
    };
    await this.raycaster.init(raycasterParams);
  }

  private initMap() {
    this.raycaster.initMap();
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
      const genWorkerIdx = () => {
        return nextWorkerIdx++;
      };
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
            )
          };
          this.auxWorkers.push(engineWorker);
          const workerParams: AuxWorkerParams = {
            workerIndex,
            numWorkers: numAuxWorkers,
            frameStride: this.imageData.width,
            wasmRunParams: {
              ...this.wasmEngine.WasmRunParams,
              workerIdx: workerIndex,
              raycasterPtr: this.wasmRaycasterPtr,
            },
          };
          engineWorker.worker.postMessage({
            command: AuxWorkerCommandEnum.INIT,
            params: workerParams,
          });
          engineWorker.worker.onmessage = ({ data }) => {
            --remWorkers;
            console.log(
              `Aux app worker id=${workerIndex} init, left count=${remWorkers}, time=${
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
            console.log(`Aux app worker id=${workerIndex} error: ${error.message}\n`);
            reject(error);
          };
        }
      });
    } catch (error) {
      console.error(`Error during aux app workers init: ${JSON.stringify(error)}`);
    }
  }

  public run(): void {
    let lastFrameStartTime: number;
    // let last_render_t: number;
    let updTimeAcc: number;
    let renderTimeAcc: number;
    let elapsedTimeMs: number;
    let renderThen: number;
    let timeSinceLastFrame: number;
    let avgTimeSinceLastFrame: number;
    let frameStartTime: number;

    let timeLastFrameCnt: number;
    let frameCnt: number;
    let renderCnt: number;
    let updateCnt: number;
    let statsCnt: number;

    let lastStatsTime: number;
    let statsTimeAcc: number;

    let frameTimeArr: Float64Array;
    let timeSinceLastFrameArr: Float64Array;
    let fpsArr: Float32Array;
    let rpsArr: Float32Array;
    let upsArr: Float32Array;

    let resync: boolean;
    let isRunning: boolean;
    let isPaused: boolean;

    const mainLoopInit = () => {
      lastFrameStartTime = lastStatsTime = renderThen = performance.now();
      frameTimeArr = new Float64Array(AppWorker.FRAME_TIMES_ARR_LEN);
      updTimeAcc = 0;
      renderTimeAcc = 0;
      elapsedTimeMs = 0;
      timeSinceLastFrameArr = new Float64Array(
        AppWorker.TIMES_SINCE_LAST_FRAME_ARR_LEN,
      );
      frameCnt = 0;
      timeLastFrameCnt = 0;
      statsTimeAcc = 0;
      fpsArr = new Float32Array(AppWorker.STATS_ARR_LEN);
      rpsArr = new Float32Array(AppWorker.STATS_ARR_LEN);
      upsArr = new Float32Array(AppWorker.STATS_ARR_LEN);
      statsCnt = 0;
      resync = false;
      updateCnt = 0;
      renderCnt  = 0;
      isRunning = true;
      isPaused = false;
      requestAnimationFrame(frame);
    };

    requestAnimationFrame(mainLoopInit);

    const begin = () => {
      frameStartTime = performance.now();
      timeSinceLastFrame = frameStartTime - lastFrameStartTime;
      lastFrameStartTime = frameStartTime;
      timeSinceLastFrame = Math.min(timeSinceLastFrame, AppWorker.UPDATE_TIME_MAX);
      timeSinceLastFrame = Math.max(timeSinceLastFrame, 0);
      timeSinceLastFrameArr[timeLastFrameCnt++ % timeSinceLastFrameArr.length] = timeSinceLastFrame;
      // avgTimeSinceLastFrame = timeSinceLastFrame;
      // console.log(`avgTimeSinceLastFrame = ${avgTimeSinceLastFrame}`);
      avgTimeSinceLastFrame = arrAvg(timeSinceLastFrameArr, timeLastFrameCnt,);
    }

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
        // updateState(STEP, t / MULTIPLIER);
        this.updatePlayer(AppWorker.UPDATE_PERIOD_MS / 2);
        updTimeAcc -= AppWorker.UPDATE_PERIOD_MS;
        updateCnt++;
      }
    };

    const render = () => {
      renderTimeAcc += avgTimeSinceLastFrame;
      if (renderTimeAcc >= AppWorker.RENDER_PERIOD_MS) {
        renderTimeAcc %= AppWorker.RENDER_PERIOD_MS;
        this.wasmEngine.syncWorkers(this.auxWorkers);
        try {
          // this.wasmEngineModule.render();
          this.raycaster.castScene();
        }
        catch (e) {
          console.error(e);
        }
        this.wasmEngine.waitWorkers(this.auxWorkers);
        this.drawWasmFrame();
        saveFrameTime();
        renderCnt++;
      }
    };

    const saveFrameTime = () => {
      const frameTime = performance.now() - frameStartTime;
      frameTimeArr[renderCnt % frameTimeArr.length] = frameTime;
    };

    const stats = () => {
      ++frameCnt;
      statsTimeAcc += timeSinceLastFrame;
      if (statsTimeAcc >= AppWorker.STATS_PERIOD_MS) {
        statsTimeAcc = statsTimeAcc % AppWorker.STATS_PERIOD_MS;
        // const tspent = (tnow - start_time) / App.MILLI_IN_SEC;
        const now = performance.now();
        const elapsed = now - lastStatsTime;
        lastStatsTime = now;
        elapsedTimeMs += elapsed;
        const oneOverElapsed = MILLI_IN_SEC / elapsedTimeMs;
        const fps = frameCnt * oneOverElapsed;
        const rps = renderCnt * oneOverElapsed;
        const ups = updateCnt * oneOverElapsed;
        const stat_idx = statsCnt++ % fpsArr.length;
        fpsArr[stat_idx] = fps;
        rpsArr[stat_idx] = rps;
        upsArr[stat_idx] = ups;
        const avgFps = arrAvg(fpsArr, statsCnt);
        const avgRps = arrAvg(rpsArr, statsCnt);
        const avgUps = arrAvg(upsArr, statsCnt);
        const avgFrameTime = arrAvg(frameTimeArr, renderCnt);
        const avgUfps = MILLI_IN_SEC / avgFrameTime;
        // console.log(`avgUfps = ${avgUfps}, avgFrameTime = ${avgFrameTime}`);
        const stats: StatsValues = {
          [StatsNameEnum.FPS]: avgFps,
          [StatsNameEnum.RPS]: avgRps,
          [StatsNameEnum.UPS]: avgUps,
          [StatsNameEnum.UFPS]: avgUfps,
        };
        postMessage({
          command: AppCommandEnum.UPDATE_STATS,
          params: stats,
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

  private get BorderColor(): number {
    return this.wasmRun.WasmViews.view.getUint32(this.wasmBorderColorPtr, true);
  }

  private set BorderColor(value: number) {
    this.wasmRun.WasmViews.view.setUint32(this.wasmBorderColorPtr, value, true);
  }

  updateState(step: number, time: number) {}

  updatePlayer(time: number) {
    const { inputKeys } = this.wasmEngine.WasmViews;
    const moveSpeed = time * 0.009;
    const rotSpeed = time * 0.006;

    if (inputKeys[keyOffsets[keys.KEY_W]] !== 0) {
      this.moveForward(moveSpeed, 1);
    }
    if (inputKeys[keyOffsets[keys.KEY_S]] !== 0) {
      this.moveForward(moveSpeed, -1);
    }
    if (inputKeys[keyOffsets[keys.KEY_A]] !== 0) {
      this.rotate(-rotSpeed);
    }
    if (inputKeys[keyOffsets[keys.KEY_D]] !== 0) {
      this.rotate(rotSpeed);
    }
  }

  private rotate(moveSpeed: number) {
    const player = this.raycaster.Player;
    const oldDirX = player.DirX;
    player.DirX = player.DirX * Math.cos(moveSpeed) - player.DirY * Math.sin(moveSpeed);
    player.DirY = oldDirX * Math.sin(moveSpeed) + player.DirY * Math.cos(moveSpeed);
    const oldPlaneX = player.PlaneX;
    player.PlaneX = player.PlaneX * Math.cos(moveSpeed) - player.PlaneY * Math.sin(moveSpeed);
    player.PlaneY = oldPlaneX * Math.sin(moveSpeed) + player.PlaneY * Math.cos(moveSpeed);
  }

  private moveForward(moveSpeed: number, dir: number) {
    const player = this.raycaster.Player;
    player.PosX += dir * player.DirX * moveSpeed;
    player.PosY += dir * player.DirY * moveSpeed;
  }

  onKeyDown(inputEvent: InputEvent) {
    this.inputManager.onKeyDown(inputEvent.code);
  }

  onKeyUp(inputEvent: InputEvent) {
    this.inputManager.onKeyUp(inputEvent.code);
  }

  // onMouseMove(inputEvent: InputEvent) {
  // }

  onCanvasDisplayResize(displayWidth: number, displayHeight: number) {
    // console.log('onCanvasDisplayResize', displayWidth, displayHeight);
  }
}

let appWorker: AppWorker;

const enum AppWorkerCommandEnum {
  INIT = 'app_worker_init',
  RUN = 'app_worker_run',
  KEY_DOWN = 'app_worker_key_down',
  KEY_UP = 'app_worker_key_up',
  RESIZE_CANVAS_DISPLAY_SIZE = 'app_worker_resize_canvas_display_size',
}

const commands = {
  [AppWorkerCommandEnum.INIT]: async (params: AppWorkerParams) => {
    appWorker = new AppWorker();
    await appWorker.init(params);
    postMessage({
      command: AppCommandEnum.INIT,
    });
  },
  [AppWorkerCommandEnum.RUN]: () => {
    appWorker.run();
  },
  [AppWorkerCommandEnum.KEY_DOWN]: (inputEvent: InputEvent) => {
    appWorker.onKeyDown(inputEvent);
  },
  [AppWorkerCommandEnum.KEY_UP]: (inputEvent: InputEvent) => {
    appWorker.onKeyUp(inputEvent);
  },
  [AppWorkerCommandEnum.RESIZE_CANVAS_DISPLAY_SIZE]: (resizeEvent: CanvasDisplayResizeEvent) => {
    const { width, height } = resizeEvent;
    appWorker.onCanvasDisplayResize(width, height);
  }
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
