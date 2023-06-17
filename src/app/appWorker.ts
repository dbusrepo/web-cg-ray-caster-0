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
import type { InputEvent } from './events';
import { AppCommandEnum } from '../app/appTypes';
// import type { KeyHandler, Key } from '../input/inputManager';
// import { InputManager, keys } from '../input/inputManager';
import type { EngineWorkerParams } from '../engine/engineWorker';
import { EngineWorkerCommandEnum, EngineWorkerDesc } from '../engine/engineWorker';
import * as utils from '../engine/utils';
import { RayCaster, RayCasterParams } from '../engine/rayCaster/rayCaster';

type AppWorkerParams = {
  engineCanvas: OffscreenCanvas;
};

const MAIN_WORKER_IDX = 0;

class AppWorker {
  private static readonly RENDER_PERIOD_MS = MILLI_IN_SEC / mainConfig.targetRPS;
  private static readonly UPDATE_PERIOD_MS =
    (mainConfig.multiplier * MILLI_IN_SEC) / mainConfig.targetUPS;

  private static readonly UPDATE_TIME_MAX = AppWorker.UPDATE_PERIOD_MS * 8;

  private static readonly STATS_LEN = 10; // fps, rps, ups
  private static readonly FRAME_TIMES_LEN = 20; // used for ufps
  private static readonly TIMES_SINCE_LAST_FRAME_LEN = 10; // update, render

  private static readonly STATS_PERIOD_MS = 100; // MILLI_IN_SEC;

  private params: AppWorkerParams;
  private assetManager: AssetManager;

  private engineWorkers: EngineWorkerDesc[];
  private syncArray: Int32Array;
  private sleepArray: Int32Array;

  private rayCaster: RayCaster;

  public async init(params: AppWorkerParams): Promise<void> {
    this.params = params;
    await this.initAssetManager();
    const numEngineWorkers = mainConfig.numEngineWorkers;
    console.log(`Using 1 main worker and ${numEngineWorkers} aux workers`);
    const numTotalWorkers = numEngineWorkers + 1;
    this.syncArray = new Int32Array(new SharedArrayBuffer(numTotalWorkers * Int32Array.BYTES_PER_ELEMENT));
    this.sleepArray = new Int32Array(new SharedArrayBuffer(numTotalWorkers * Int32Array.BYTES_PER_ELEMENT));
    this.engineWorkers = [];
    if (numEngineWorkers) {
      await this.initEngineWorkers(numEngineWorkers);
    }
    await this.initRayCaster();
  }
  
  private async initRayCaster() {
    this.rayCaster = new RayCaster();
    const rayCasterParams: RayCasterParams = {
      engineCanvas: this.params.engineCanvas,
      assetManager: this.assetManager,
      engineWorkers: [],
      mainWorkerIdx: MAIN_WORKER_IDX,
    };
    await this.rayCaster.init(rayCasterParams);
  }

  private async initAssetManager() {
    this.assetManager = new AssetManager();
    await this.assetManager.init();
  }

  private async initEngineWorkers(numEngineWorkers: number) {
    assert(numEngineWorkers > 0);
    const initStart = Date.now();
    try {
      let nextWorkerIdx = 0;
      const getWorkerIdx = () => {
        if (nextWorkerIdx === MAIN_WORKER_IDX) {
          nextWorkerIdx++;
        }
        return nextWorkerIdx++;
      };
      let remWorkers = numEngineWorkers;
      await new Promise<void>((resolve, reject) => {
        for (let i = 0; i < numEngineWorkers; ++i) {
          const workerIndex = getWorkerIdx();
          const engineWorker = {
            index: workerIndex,
            worker: new Worker(
              new URL('../engine/engineWorker.ts', import.meta.url),
              {
                name: `engine-worker-${workerIndex}`,
                type: 'module',
              },
            )
          };
          this.engineWorkers.push(engineWorker);
          const workerParams: EngineWorkerParams = {
            workerIndex,
            numWorkers: numEngineWorkers,
            syncArray: this.syncArray,
            sleepArray: this.sleepArray,
          };
          engineWorker.worker.postMessage({
            command: EngineWorkerCommandEnum.INIT,
            params: workerParams,
          });
          engineWorker.worker.onmessage = ({ data }) => {
            --remWorkers;
            console.log(
              `Worker id=${workerIndex} init, left count=${remWorkers}, time=${
Date.now() - initStart
}ms with data = ${JSON.stringify(data)}`,
            );
            if (remWorkers === 0) {
              console.log(
                `Workers init done. After ${Date.now() - initStart}ms`,
              );
              resolve();
            }
          };
          engineWorker.worker.onerror = (error) => {
            console.log(`Worker id=${workerIndex} error: ${error.message}\n`);
            reject(error);
          };
        }
      });
    } catch (error) {
      console.error(`Error during workers init: ${JSON.stringify(error)}`);
    }
  }

  // private async initWasmEngine() {
  //   this.wasmEngine = new WasmEngine();
  //   const wasmEngineParams: WasmEngineParams = {
  //     engineCanvas: this.params.engineCanvas,
  //     assetManager: this.assetManager,
  //     inputManager: this.inputManager,
  //     engineWorkers: this.engineWorkers,
  //     mainWorkerIdx: MAIN_WORKER_IDX,
  //     runEngineWorkersLoop: true,
  //   };
  //   await this.wasmEngine.init(wasmEngineParams);
  // }

  public run(): void {
    let lastFrameStartTime: number;
    // let last_render_t: number;
    let updTimeAcc: number;
    let renderTimeAcc: number;
    let elapsedTimeMs: number;
    let renderThen: number;
    let timeSinceLastFrame: number;
    let avgTimeLastFrame: number;
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
      frameTimeArr = new Float64Array(AppWorker.FRAME_TIMES_LEN);
      updTimeAcc = 0;
      renderTimeAcc = 0;
      elapsedTimeMs = 0;
      timeSinceLastFrameArr = new Float64Array(
        AppWorker.TIMES_SINCE_LAST_FRAME_LEN,
      );
      frameCnt = 0;
      timeLastFrameCnt = 0;
      statsTimeAcc = 0;
      fpsArr = new Float32Array(AppWorker.STATS_LEN);
      rpsArr = new Float32Array(AppWorker.STATS_LEN);
      upsArr = new Float32Array(AppWorker.STATS_LEN);
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
      timeSinceLastFrameArr[timeLastFrameCnt++ % timeSinceLastFrameArr.length] =
        timeSinceLastFrame;
      avgTimeLastFrame= utils.arrAvg(
        timeSinceLastFrameArr,
        timeLastFrameCnt,
      );
    }

    const next = () => {
      requestAnimationFrame(frame);
    }

    const frame = () => {
      begin();
      update();
      render();
      stats();
      next();
    };

    const update = () => {
      // if (is_paused) return; // TODO
      updTimeAcc += avgTimeLastFrame;
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
        this.rayCaster.update(AppWorker.UPDATE_PERIOD_MS / 2); // TODO:
        updTimeAcc -= AppWorker.UPDATE_PERIOD_MS;
        updateCnt++;
      }
    };

    const saveFrameTime = () => {
      const frameTime = performance.now() - frameStartTime;
      frameTimeArr[renderCnt++ % frameTimeArr.length] = frameTime;
    };  

    const render = () => {
      renderTimeAcc += avgTimeLastFrame;
      if (renderTimeAcc >= AppWorker.RENDER_PERIOD_MS) {
        renderTimeAcc %= AppWorker.RENDER_PERIOD_MS;
        // this.syncWorkers();
        // this.waitWorkers();
        this.rayCaster.render();
        saveFrameTime();
      }
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
        const avgFps = utils.arrAvg(fpsArr, statsCnt);
        const avgRps = utils.arrAvg(rpsArr, statsCnt);
        const avgUps = utils.arrAvg(upsArr, statsCnt);
        const avgFrameTime = utils.arrAvg(frameTimeArr, renderCnt);
        const avgUfps = MILLI_IN_SEC / avgFrameTime;
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

  private syncWorkers() {
    for (let i = 1; i <= this.engineWorkers.length; ++i) {
      Atomics.store(this.syncArray, i, 1);
      Atomics.notify(this.syncArray, i);
    }
  }

  private waitWorkers() {
    for (let i = 1; i <= this.engineWorkers.length; ++i) {
      Atomics.wait(this.syncArray, i, 1);
    }
  }

  public onKeyDown(inputEvent: InputEvent) {
    this.rayCaster.onKeyDown(inputEvent);
  }

  public onKeyUp(inputEvent: InputEvent) {
    this.rayCaster.onKeyUp(inputEvent);
  }
}

let appWorker: AppWorker;

const enum AppWorkerCommandEnum {
  INIT = 'app_worker_init',
  RUN = 'app_worker_run',
  KEY_DOWN = 'app_worker_key_down',
  KEY_UP = 'app_worker_key_up',
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
