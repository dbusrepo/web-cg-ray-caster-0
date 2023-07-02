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
import { InputManager, keys } from '../input/inputManager';
import type { AuxAppWorkerParams } from './auxAppWorker';
import { AuxAppWorkerCommandEnum, AuxAppWorkerDesc } from './auxAppWorker';
import type { WasmEngineParams } from '../engine/wasmEngine/wasmEngine';
import { WasmEngine } from '../engine/wasmEngine/wasmEngine';
import * as utils from '../engine/utils';
import { Raycaster, RaycasterParams } from '../engine/raycaster/raycaster';

type AppWorkerParams = {
  engineCanvas: OffscreenCanvas;
};

class AppWorker {
  private static readonly RENDER_PERIOD_MS = MILLI_IN_SEC / mainConfig.targetRPS;
  private static readonly UPDATE_PERIOD_MS =
    (mainConfig.multiplier * MILLI_IN_SEC) / mainConfig.targetUPS;

  private static readonly UPDATE_TIME_MAX = AppWorker.UPDATE_PERIOD_MS * 8;

  private static readonly STATS_LEN = 10; // fps, rps, ups
  private static readonly FRAME_TIMES_LEN = 10; // used for ufps
  private static readonly TIMES_SINCE_LAST_FRAME_LEN = 10; // update, render

  private static readonly STATS_PERIOD_MS = 100; // MILLI_IN_SEC;

  private ctx2d: OffscreenCanvasRenderingContext2D;
  private imageData: ImageData;

  private params: AppWorkerParams;

  private raycaster: Raycaster;

  public async init(params: AppWorkerParams): Promise<void> {
    this.params = params;
    await this.initRaycaster();
  }
  
  private async initRaycaster() {
    this.raycaster = new Raycaster();
    const raycasterParams: RaycasterParams = {
      engineCanvas: this.params.engineCanvas,
    };
    await this.raycaster.init(raycasterParams);
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
      timeSinceLastFrameArr[timeLastFrameCnt++ % timeSinceLastFrameArr.length] = timeSinceLastFrame;
      // avgTimeSinceLastFrame = timeSinceLastFrame;
      // console.log(`avgTimeSinceLastFrame = ${avgTimeSinceLastFrame}`);
      avgTimeSinceLastFrame = utils.arrAvg(timeSinceLastFrameArr, timeLastFrameCnt,);
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
        this.raycaster.update(AppWorker.UPDATE_PERIOD_MS / 2); // TODO:
        updTimeAcc -= AppWorker.UPDATE_PERIOD_MS;
        updateCnt++;
      }
    };

    const render = () => {
      renderTimeAcc += avgTimeSinceLastFrame;
      if (renderTimeAcc >= AppWorker.RENDER_PERIOD_MS) {
        renderTimeAcc %= AppWorker.RENDER_PERIOD_MS;
        this.raycaster.render();
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
        const avgFps = utils.arrAvg(fpsArr, statsCnt);
        const avgRps = utils.arrAvg(rpsArr, statsCnt);
        const avgUps = utils.arrAvg(upsArr, statsCnt);
        const avgFrameTime = utils.arrAvg(frameTimeArr, renderCnt);
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

  public onKeyDown(inputEvent: InputEvent) {
    this.raycaster.onKeyDown(inputEvent);
  }

  public onKeyUp(inputEvent: InputEvent) {
    this.raycaster.onKeyUp(inputEvent);
  }

  public onCanvasDisplayResize(displayWidth: number, displayHeight: number) {
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
