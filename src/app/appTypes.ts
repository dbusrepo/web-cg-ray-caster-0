import * as WasmUtils from '../engine/wasmEngine/wasmMemUtils';

enum AppCommandEnum {
  APP_WORKER_INITD = 'app_worker_initd',
  UPDATE_STATS = 'updateStats',
  EVENT = 'event',
  REGISTER_KEY_HANDLER = 'register_handler',
}

enum PanelIdEnum {
  ENGINE = 0,
}

type PanelId = `${PanelIdEnum}`;

enum KeyEventsEnum {
  KEY_DOWN = 'keydown',
  KEY_UP = 'keyup',
}

type KeyEvent = `${KeyEventsEnum}`;

type AppPostInitParams = {
  wasmMem: WebAssembly.Memory;
  wasmMemRegionsOffsets: WasmUtils.WasmMemRegionsData;
  wasmMemRegionsSizes: WasmUtils.WasmMemRegionsData;
};

export type { AppPostInitParams };
export type { KeyEvent, PanelId };
export { AppCommandEnum, PanelIdEnum, KeyEventsEnum };
