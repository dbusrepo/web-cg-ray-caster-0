import { eventLogConfig } from './eventLogConfig';
import { consoleConfig } from './consoleConfig';

const enum StartViewMode {
  WIN = 'win',
  FULL_WIN = 'fullwin',
}

const panelConfig = {
  title: 'Panel',

  canvasWidth: 320,
  canvasHeight: 200,

  canvasDisplayWidthWinMode: 640,
  canvasDisplayHeightWinMode: 480,

  // canvasDisplayWidthWinMode: 512,
  // canvasDisplayHeightWinMode: 384,
  // canvasDisplayWidthWinMode: 320,
  // canvasDisplayHeightWinMode: 200,

  startViewMode: StartViewMode.WIN as StartViewMode,

  // FULL_WIN_KEY: 'F1',
  // FULL_SCREEN_KEY: 'F2',

  eventLogConfig,
  consoleConfig,

  focusOnStart: false,
};

type PanelConfig = typeof panelConfig;

export { StartViewMode, PanelConfig, panelConfig };
