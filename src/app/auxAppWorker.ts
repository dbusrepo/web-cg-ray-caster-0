import assert from 'assert';
import type { WasmViews } from '../engine/wasmEngine/wasmViews';
import { buildWasmMemViews } from '../engine/wasmEngine/wasmViews';
import type { WasmRunParams } from '../engine/wasmEngine/wasmRun';
import { WasmRun, gWasmRun } from '../engine/wasmEngine/wasmRun';
import { getWasmViewport } from '../engine/rayCaster/viewport';

const enum AuxAppWorkerCommandEnum {
  INIT = 'aux_app_worker_init',
  RUN = 'aux_app_worker_run',
}

type AuxAppWorkerParams = {
  workerIndex: number,
  numWorkers: number,
  wasmRunParams: WasmRunParams,
  syncArray: Int32Array;
  sleepArray: Int32Array;
};

class AuxAppWorker {
  private params: AuxAppWorkerParams;
  private wasmRun: WasmRun;

  async init(params: AuxAppWorkerParams): Promise<void> {
    const { workerIndex, wasmRunParams } = params;
    console.log(`Aux app worker ${workerIndex} initializing...`);
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
    console.log(`Aux app worker ${workerIndex} running`);

    try {
      while (true) {
        Atomics.wait(syncArray, workerIndex, 0);
        // TODO:
        Atomics.store(syncArray, workerIndex, 0);
        Atomics.notify(syncArray, workerIndex);
      }
    } catch (ex) {
      console.log(`Error while running aux app worker ${this.params.workerIndex}`);
      console.error(ex);
    }
  }
}

let auxAppWorker: AuxAppWorker;

const commands = {
  [AuxAppWorkerCommandEnum.INIT]: async (params: AuxAppWorkerParams) => {
    auxAppWorker = new AuxAppWorker();
    await auxAppWorker.init(params);
    postMessage({ status: `Aux app worker ${params.workerIndex} init completed` });
  },
  [AuxAppWorkerCommandEnum.RUN]: async () => {
    await auxAppWorker.run();
  },
};

self.addEventListener('message', async ({ data: { command, params } }) => {
  if (commands.hasOwnProperty(command)) {
    try {
      commands[command as keyof typeof commands](params);
    } catch (err) {}
  }
});

class AuxAppWorkerDesc {
  index: number;
  worker: Worker;
}

export type { AuxAppWorkerParams };
export { AuxAppWorker, AuxAppWorkerDesc, AuxAppWorkerCommandEnum };
