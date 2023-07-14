import assert from 'assert';
import type { WasmViews } from './wasmEngine/wasmViews';
import type {
  WasmModules,
  WasmEngineModule,
} from '../engine/wasmEngine/wasmLoader';
import { buildWasmMemViews } from './wasmEngine/wasmViews';
import type { WasmRunParams } from './wasmEngine/wasmRun';
import { WasmRun } from './wasmEngine/wasmRun';
import { Viewport, getWasmViewportView } from './raycaster/viewport';
import { Player, getWasmPlayerView } from './raycaster/player';
import { Raycaster, RaycasterParams } from './raycaster/raycaster';

const enum AuxWorkerCommandEnum {
  INIT = 'aux_worker_init',
  RUN = 'aux_worker_run',
}

type AuxWorkerParams = {
  workerIndex: number;
  numWorkers: number;
  frameStride: number;
  wasmRunParams: WasmRunParams;
};

class AuxWorker {
  private params: AuxWorkerParams;
  private wasmRun: WasmRun;
  private wasmEngineModule: WasmEngineModule;

  private player: Player;
  private viewport: Viewport;
  private raycaster: Raycaster;

  private wasmRaycasterPtr: number;

  async init(params: AuxWorkerParams): Promise<void> {
    console.log(`Aux worker ${params.workerIndex} initializing...`);
    this.params = params;

    await this.initWasmRun();

    this.player = getWasmPlayerView(
      this.wasmEngineModule,
      this.wasmRaycasterPtr,
    );
    this.viewport = getWasmViewportView(
      this.wasmEngineModule,
      this.wasmRaycasterPtr,
    );

    this.raycaster = new Raycaster();
    const raycasterParams: RaycasterParams = {
      wasmRun: this.wasmRun,
      frameStride: this.params.frameStride,
    };
    await this.raycaster.init(raycasterParams);

    // console.log('worker viewport.startX', this.viewport.StartX);
    // console.log('worker viewport.startY', this.viewport.StartY);
    // console.log('worker player.posX', this.player.PosX);
    // console.log('worker player.posY', this.player.PosY);
  }

  private async initWasmRun() {
    const { wasmRunParams } = this.params;
    this.wasmRun = new WasmRun();
    const wasmViews = buildWasmMemViews(
      wasmRunParams.wasmMem,
      wasmRunParams.wasmMemRegionsOffsets,
      wasmRunParams.wasmMemRegionsSizes,
    );
    await this.wasmRun.init(wasmRunParams, wasmViews);
    this.wasmEngineModule = this.wasmRun.WasmModules.engine;
    this.wasmRaycasterPtr = this.wasmEngineModule.getRaycasterPtr();
  }

  async run() {
    console.log(`Aux worker ${this.params.workerIndex} running`);

    const { workerIndex } = this.params;
    const wasmViews = this.wasmRun.WasmViews;

    try {
      while (true) {
        Atomics.wait(wasmViews.syncArr, this.params.workerIndex, 0);

        // this.wasmEngineModule.render();

        Atomics.store(wasmViews.syncArr, workerIndex, 0);
        Atomics.notify(wasmViews.syncArr, workerIndex);
      }
    } catch (ex) {
      console.log(
        `Error while running aux app worker ${this.params.workerIndex}`,
      );
      console.error(ex);
    }
  }
}

let auxWorker: AuxWorker;

const commands = {
  [AuxWorkerCommandEnum.INIT]: async (params: AuxWorkerParams) => {
    auxWorker = new AuxWorker();
    await auxWorker.init(params);
    postMessage({
      status: `aux app worker ${params.workerIndex} init completed`,
    });
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

export type { AuxWorkerParams };
export { AuxWorker, AuxWorkerCommandEnum };
