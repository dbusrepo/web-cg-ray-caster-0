import { StartViewMode, panelConfig } from './panelConfig';
import { enginePanelConfig } from './enginePanelConfig';
import { viewPanelConfig } from './viewPanelConfig';

const mainConfig = {

  numWorkers: 0,

  wasmMemStartOffset: 0,
  wasmMemStartPages: 64,
  wasmWorkerHeapPages: 1,
  // 0 -> it can expand freely after the previous mem regions
  // TODO case != 0 not supported for now
  wasmSharedHeapSize: 0,
  wasmMemMaxPages: 1000,

  targetRPS: 60,
  targetUPS: 60,

  multiplier: 1,

  panelConfig,
  enginePanelConfig,
  viewPanelConfig,
};

type Config = typeof mainConfig;

export { Config, StartViewMode, mainConfig };

export type { PanelConfig } from './panelConfig';
export type { EnginePanelConfig } from './enginePanelConfig';
export type { ViewPanelConfig } from './viewPanelConfig';
export type { EventLogConfig } from './eventLogConfig';
export type { ConsoleConfig } from './consoleConfig';
