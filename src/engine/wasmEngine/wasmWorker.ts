// import assert from 'assert';
import * as WasmUtils from './wasmMemUtils';
import { WasmRun, WasmRunConfig } from './wasmRun';
import Commands from './wasmWorkerCommands';

type WasmWorkerConfig = {
  wasmRunCfg: WasmRunConfig;
};

// type WasmViews = WasmUtils.views.WasmViews;

class WasmWorker {
  private cfg: WasmWorkerConfig;
  private wasmRun: WasmRun; // get the views with this.wasmRun.WasmViews

  public async init(config: WasmWorkerConfig): Promise<void> {
    this.cfg = config;
    await this.initWasmRun();
  }

  private async initWasmRun() {
    this.wasmRun = new WasmRun();
    await this.wasmRun.init(this.cfg.wasmRunCfg);
  }

  run(): void {
    console.log(`Worker ${this.cfg.wasmRunCfg.workerIdx} running!`);
    try {
      this.wasmRun.WasmModules.engine.run();
    } catch (e) {
      console.error(e);
    }
  }
}

let wasmWorker: WasmWorker;

const commands = {
  [Commands.INIT]: async (config: WasmWorkerConfig): Promise<void> => {
    wasmWorker = new WasmWorker();
    await wasmWorker.init(config);
    postMessage({ status: 'init completed' });
  },
  [Commands.RUN]: async (): Promise<void> => {
    wasmWorker.run();
  },
};

self.addEventListener('message', async ({ data: { command, params } }) => {
  if (commands.hasOwnProperty(command)) {
    try {
      commands[command as keyof typeof commands](params);
    } catch (err) {}
  }
});

export { WasmWorkerConfig };
