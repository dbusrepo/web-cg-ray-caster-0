import assert from 'assert';
import type { WasmViews } from '../wasmEngine/wasmViews';
import { buildWasmMemViews } from '../wasmEngine/wasmViews';
import type { WasmRunParams } from '../wasmEngine/wasmRun';
import { WasmRun } from '../wasmEngine/wasmRun';
import type { Viewport } from './viewport';
import { getWasmViewport } from '../raycaster/viewport';
import type { Player } from './player';
import { getWasmPlayer } from './player';

const enum AuxWorkerCommandEnum {
  INIT = 'aux_worker_init',
  RUN = 'aux_worker_run',
}

type AuxWorkerParams = {
  workerIndex: number,
  numWorkers: number,
  wasmRunParams: WasmRunParams,
  syncArray: Int32Array;
  sleepArray: Int32Array;
};

class AuxWorker {
  private params: AuxWorkerParams;
  private wasmRun: WasmRun;

  async init(params: AuxWorkerParams): Promise<void> {
    const { workerIndex, wasmRunParams } = params;
    console.log(`Aux worker ${workerIndex} initializing...`);
    this.params = params;
    this.wasmRun = new WasmRun();
    const wasmViews = buildWasmMemViews(
      wasmRunParams.wasmMem,
      wasmRunParams.wasmMemRegionsOffsets,
      wasmRunParams.wasmMemRegionsSizes);
    await this.wasmRun.init(wasmRunParams, wasmViews);
  }

  async run() {
    const { syncArray, workerIndex } = this.params;
    console.log(`Aux worker ${workerIndex} running`);

    // const viewport = getWasmViewport();
    // // viewport.StartX = 12;
    // // viewport.StartY = 11;
    // console.log('worker viewport.startX', viewport.StartX);
    // console.log('worker viewport.startY', viewport.StartY);

    const player = getWasmPlayer();
    // console.log(player.PosX);
    // console.log(player.PosY);

    try {
      while (true) {
        Atomics.wait(syncArray, workerIndex, 0);

        Atomics.store(syncArray, workerIndex, 0);
        Atomics.notify(syncArray, workerIndex);
      }
    } catch (ex) {
      console.log(`Error while running aux app worker ${this.params.workerIndex}`);
      console.error(ex);
    }
  }
}

let auxWorker: AuxWorker;

const commands = {
  [AuxWorkerCommandEnum.INIT]: async (params: AuxWorkerParams) => {
    auxWorker = new AuxWorker();
    await auxWorker.init(params);
    postMessage({ status: `aux app worker ${params.workerIndex} init completed` });
  },
  [AuxWorkerCommandEnum.RUN]: async () => {
    await auxWorker.run();
  },
};

self.addEventListener('message', async ({ data: { command, params } }) => {
  if (commands.hasOwnProperty(command)) {
    try {
      commands[command as keyof typeof commands](params);
    } catch (err) {}
  }
});

class AuxWorkerDesc {
  index: number;
  worker: Worker;
}

export type { AuxWorkerParams };
export { AuxWorker, AuxWorkerDesc, AuxWorkerCommandEnum };
