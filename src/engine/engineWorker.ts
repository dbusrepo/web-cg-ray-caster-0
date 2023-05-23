import assert from 'assert';
import { WasmRun, WasmRunParams } from './wasmEngine/wasmRun';

const enum EngineWorkerCommands {
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
    console.log(`Engine worker ${workerIndex} running!`);
    try {
      while (true) {
        Atomics.wait(syncArray, workerIndex, 0);
        // TODO:
        Atomics.store(syncArray, workerIndex, 0);
        Atomics.notify(syncArray, workerIndex);
      }
    } catch (e) {
      console.log(`Error while running engine worker ${this.params.workerIndex}`);
      console.error(e);
    }
  }

  async initWasm(params: WasmRunParams) {
    this.wasmRun = new WasmRun();
    await this.wasmRun.init(params);
  }

  async runWasm() {
    assert(this.wasmRun);
    const { workerIndex } = this.params;
    console.log(`Engine worker ${workerIndex} running wasm!`);
    try {
      this.wasmRun.WasmModules.engine.run();
    } catch (e) {
      console.log(`Error while running engine worker ${this.params.workerIndex} in wasm run`);
      console.error(e);
    }
  }

  get Index(): number {
    return this.params.workerIndex;
  }
}

let engineWorker: EngineWorker;

const commands = {
  [EngineWorkerCommands.INIT]: async (params: EngineWorkerParams) => {
    engineWorker = new EngineWorker();
    await engineWorker.init(params);
    postMessage({ status: `engine worker ${engineWorker.Index} init completed` });
  },
  [EngineWorkerCommands.RUN]: async () => {
    await engineWorker.run();
  },
  [EngineWorkerCommands.INIT_WASM]: async (params: WasmRunParams) => {
    await engineWorker.initWasm(params);
    postMessage({ status: `engine worker ${engineWorker.Index} wasm init completed` });
  },
  [EngineWorkerCommands.RUN_WASM]: async () => {
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

export { EngineWorkerParams, EngineWorkerCommands };
