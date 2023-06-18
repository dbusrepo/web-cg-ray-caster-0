import assert from 'assert';
import type { WasmViews } from './wasmEngine/wasmViews';
import { buildWasmMemViews } from './wasmEngine/wasmViews';
import type { WasmRunParams } from './wasmEngine/wasmRun';
import { WasmRun } from './wasmEngine/wasmRun';
import type { Viewport } from './rayCaster/viewport';
import { getWasmViewport } from './rayCaster/viewport';

const enum EngineWorkerCommandEnum {
  INIT = 'worker_init',
  INIT_WASM = 'worker_init_wasm',
  RUN = 'worker_run',
  RUN_WASM = 'worker_run_wasm',
}

type EngineWorkerParams = {
  workerIndex: number,
  numWorkers: number,
  syncArray: Int32Array;
  sleepArray: Int32Array;
};

class EngineWorker {
  private params: EngineWorkerParams;
  private wasmRun: WasmRun | null;

  async init(params: EngineWorkerParams): Promise<void> {
    this.params = params;
    this.wasmRun = null;
  }

  async run() {
    const { syncArray, workerIndex } = this.params;
    console.log(`Worker ${workerIndex} running`);

    // assert(this.wasmRun);
    // const wasmModules = this.wasmRun.WasmModules;
    // const viewport = getWasmViewport(wasmModules, this.wasmRun.WasmMem.buffer);
    // console.log('this.viewport.startX', viewport.startX);
    // console.log('this.viewport.startY', viewport.startY);

    try {
      while (true) {
        console.log('worker rendering...', workerIndex)
        console.log(Atomics.load(syncArray, workerIndex));
        Atomics.wait(syncArray, workerIndex, 0);
        // TODO:
        Atomics.store(syncArray, workerIndex, 0);
        Atomics.notify(syncArray, workerIndex);
      }
    } catch (ex) {
      console.log(`Error while running engine worker ${this.params.workerIndex}`);
      console.error(ex);
    }
  }

  async initWasm(params: WasmRunParams) {
    const { workerIndex } = this.params;
    console.log(`Worker ${workerIndex} init wasm`);
    this.wasmRun = new WasmRun();
    const wasmViews = buildWasmMemViews(
      params.wasmMem,
      params.wasmMemRegionsOffsets,
      params.wasmMemRegionsSizes);
    await this.wasmRun.init(params, wasmViews);
  }

  async runWasm() {
    const { workerIndex } = this.params;
    console.log(`Worker ${workerIndex} running wasm`);
    assert(this.wasmRun);
    try {
      this.wasmRun.WasmModules.engine.run();
    } catch (ex) {
      console.log(`Error while running engine worker ${this.params.workerIndex} in wasm run`);
      console.error(ex);
    }
  }

  get Index(): number {
    return this.params.workerIndex;
  }
}

let engineWorker: EngineWorker;

const commands = {
  [EngineWorkerCommandEnum.INIT]: async (params: EngineWorkerParams) => {
    engineWorker = new EngineWorker();
    await engineWorker.init(params);
    postMessage({ status: `engine worker ${engineWorker.Index} init completed` });
  },
  [EngineWorkerCommandEnum.RUN]: async () => {
    await engineWorker.run();
  },
  [EngineWorkerCommandEnum.INIT_WASM]: async (params: WasmRunParams) => {
    await engineWorker.initWasm(params);
    postMessage({ status: `engine worker ${engineWorker.Index} wasm init completed` });
  },
  [EngineWorkerCommandEnum.RUN_WASM]: async () => {
    await engineWorker.runWasm();
  },
};

self.addEventListener('message', async ({ data: { command, params } }) => {
  if (commands.hasOwnProperty(command)) {
    try {
      commands[command as keyof typeof commands](params);
    } catch (err) {}
  }
});

class EngineWorkerDesc {
  index: number;
  worker: Worker;
}

export type { EngineWorkerParams };
export { EngineWorkerDesc, EngineWorkerCommandEnum };
