import assert from 'assert';
import {
  // BPP_PAL,
  // BPP_RGBA,
  MILLI_IN_SEC,
} from '../common';

import { StatsNames, StatsValues } from '../ui/stats/stats';

import { mainConfig } from '../config/mainConfig';
import * as utils from './utils';

import Commands from './commands';
import PanelCommands from '../panels/enginePanelCommands';
import { KeyCode } from './input/inputManager';

import { RayCaster } from './rayCaster/rayCaster';

type EngineConfig = {
  canvas: OffscreenCanvas;
};

class Engine {
  private static readonly RENDER_PERIOD_MS = MILLI_IN_SEC / mainConfig.targetRPS;
  private static readonly UPDATE_PERIOD_MS =
    (mainConfig.multiplier * MILLI_IN_SEC) / mainConfig.targetUPS;

  private static readonly UPDATE_TIME_MAX = Engine.UPDATE_PERIOD_MS * 8;

  private static readonly STATS_LEN = 10; // fps, rps, ups
  private static readonly FRAME_TIMES_LEN = 20; // used for ufps
  private static readonly TIMES_SINCE_LAST_FRAME_LEN = 10; // update, render

  private static readonly STATS_PERIOD_MS = 100; // MILLI_IN_SEC;

  private cfg: EngineConfig;
  private rayCaster: RayCaster;

  public async init(config: EngineConfig): Promise<void> {
    this.cfg = config;
    this.rayCaster = new RayCaster();
    await this.rayCaster.init({
      canvas: this.cfg.canvas,
      numAuxWorkers: mainConfig.numWorkers,
    });
  }

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
      frameTimeArr = new Float64Array(Engine.FRAME_TIMES_LEN);
      updTimeAcc = 0;
      renderTimeAcc = 0;
      elapsedTimeMs = 0;
      timeSinceLastFrameArr = new Float64Array(
        Engine.TIMES_SINCE_LAST_FRAME_LEN,
      );
      frameCnt = 0;
      timeLastFrameCnt = 0;
      statsTimeAcc = 0;
      fpsArr = new Float32Array(Engine.STATS_LEN);
      rpsArr = new Float32Array(Engine.STATS_LEN);
      upsArr = new Float32Array(Engine.STATS_LEN);
      statsCnt = 0;
      resync = false;
      updateCnt = 0;
      renderCnt  = 0;
      isRunning = true;
      isPaused = false;
      requestAnimationFrame(frame);
    };

    const begin = () => {
      frameStartTime = performance.now();
      timeSinceLastFrame = frameStartTime - lastFrameStartTime;
      lastFrameStartTime = frameStartTime;
      timeSinceLastFrame = Math.min(timeSinceLastFrame, Engine.UPDATE_TIME_MAX);
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
      if (updTimeAcc > Engine.UPDATE_TIME_MAX) {
        resync = true;
      }
      // timer resync if requested
      if (resync) {
        updTimeAcc = 0; // TODO
        // delta_time = App.UPD_PERIOD;
      }
      while (updTimeAcc >= Engine.UPDATE_PERIOD_MS) {
        // TODO: see multiplier in update_period def
        // update state with UPDATE_PERIOD_MS
        // updateState(STEP, t / MULTIPLIER);
        this.rayCaster.update(Engine.UPDATE_PERIOD_MS / 2);
        updTimeAcc -= Engine.UPDATE_PERIOD_MS;
        updateCnt++;
      }
    };

    const saveFrameTime = () => {
      const frameTime = performance.now() - frameStartTime;
      frameTimeArr[renderCnt++ % frameTimeArr.length] = frameTime;
    };  

    const render = () => {
      renderTimeAcc += avgTimeLastFrame;
      if (renderTimeAcc >= Engine.RENDER_PERIOD_MS) {
        renderTimeAcc %= Engine.RENDER_PERIOD_MS;
        this.rayCaster.render();
        saveFrameTime();
      }
    };

    const stats = () => {
      ++frameCnt;
      statsTimeAcc += timeSinceLastFrame;
      if (statsTimeAcc >= Engine.STATS_PERIOD_MS) {
        statsTimeAcc = 0;
        // const tspent = (tnow - start_time) / App.MILLI_IN_SEC;
        const now = performance.now();
        const elapsed = now - lastStatsTime;
        lastStatsTime = now;
        elapsedTimeMs += elapsed;
        const oneOverElapsed = MILLI_IN_SEC / elapsedTimeMs;
        const fps = frameCnt * oneOverElapsed;
        const rps = renderCnt * oneOverElapsed;
        const ups = updateCnt * oneOverElapsed;
        // console.log(`${fps} - ${rps} - ${ups}`);
        const st_idx = statsCnt++ % fpsArr.length;
        fpsArr[st_idx] = fps;
        rpsArr[st_idx] = rps;
        upsArr[st_idx] = ups;
        const avgFps = utils.arrAvg(fpsArr, statsCnt);
        const avgRps = utils.arrAvg(rpsArr, statsCnt);
        const avgUps = utils.arrAvg(upsArr, statsCnt);
        const avgFrameTime = utils.arrAvg(frameTimeArr, renderCnt);
        let avgUFps = avgFrameTime === 0 ? 0 : MILLI_IN_SEC / avgFrameTime;
        // const workersHeapMem = this._wasmMemViews.workersMemCounters.reduce(
        //   (tot, cnt) => tot + cnt,
        //   0,
        // );
        const stats: StatsValues = {
          [StatsNames.FPS]: avgFps,
          [StatsNames.RPS]: avgRps,
          [StatsNames.UPS]: avgUps,
          [StatsNames.UFPS]: avgUFps,
          // [StatsNames.WASM_HEAP]: workersHeapMem,
        };
        postMessage({
          command: PanelCommands.UPDATE_STATS,
          params: stats,
        });
      }
    };

    // setInterval(() => {
    //   // console.log('sending...');
    //   postMessage({
    //     command: PanelCommands.EVENT,
    //     params: Math.floor(Math.random() * 100),
    //   });
    // }, 2000);

    requestAnimationFrame(mainLoopInit);
  }

  public onKeyDown(key: KeyCode) {
    this.rayCaster.onKeyDown(key);
  }

  public onKeyUp(key: KeyCode) {
    this.rayCaster.onKeyUp(key);
  }
}

let engine: Engine;

const commands = {
  [Commands.RUN]: (config: EngineConfig) => {
    engine = new Engine();
    (async () => {
      await engine.init(config);
      engine.run();
    })();
  },
  [Commands.KEYDOWN]: (key: KeyCode) => {
    engine.onKeyDown(key);
  },
  [Commands.KEYUP]: (key: KeyCode) => {
    engine.onKeyUp(key);
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

export { EngineConfig, Engine };
