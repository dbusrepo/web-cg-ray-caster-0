import assert from 'assert';
import type { WasmViews } from './wasmViews';
import { buildWasmMemViews } from './wasmViews';
import type { WasmRunParams } from './wasmRun';
import { WasmRun } from './wasmRun';

const enum AuxWasmWorkerCommandEnum {
  INIT = 'aux_wasm_worker_init',
  RUN = 'aux_wasm_worker_run',
}

class AuxWasmWorker {
  private params: WasmRunParams;
  private wasmRun: WasmRun;

  async init(params: WasmRunParams) {
    const { workerIdx } = params;
    console.log(`Aux wasm worker ${workerIdx} initializing...`);
    this.params = params;
    this.wasmRun = new WasmRun();
    const wasmViews = buildWasmMemViews(
      params.wasmMem,
      params.wasmMemRegionsOffsets,
      params.wasmMemRegionsSizes);
    await this.wasmRun.init(params, wasmViews);
  }

  async run() {
    const { workerIdx } = this.params;
    console.log(`Aux wasm worker ${workerIdx} running wasm`);
    assert(this.wasmRun);
    try {
      this.wasmRun.WasmModules.engine.run();
    } catch (ex) {
      console.log(`Error while running aux wasm worker ${workerIdx}`);
      console.error(ex);
    }
  }
}

let auxWasmWorker: AuxWasmWorker;

const commands = {
  [AuxWasmWorkerCommandEnum.INIT]: async (params: WasmRunParams) => {
    auxWasmWorker = new AuxWasmWorker();
    await auxWasmWorker.init(params);
    postMessage({ status: `aux wasm worker ${params.workerIdx} init completed` });
  },
  [AuxWasmWorkerCommandEnum.RUN]: async () => {
    auxWasmWorker.run();
  },
};

self.addEventListener('message', async ({ data: { command, params } }) => {
  if (commands.hasOwnProperty(command)) {
    try {
      commands[command as keyof typeof commands](params);
    } catch (err) {}
  }
});

class AuxWasmWorkerDesc {
  index: number;
  worker: Worker;
}

export { AuxWasmWorker, AuxWasmWorkerDesc, AuxWasmWorkerCommandEnum };
