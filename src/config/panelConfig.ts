import { eventLogConfig } from './eventLogConfig';
import { consoleConfig } from './consoleConfig';

const enum StartViewMode {
  WIN = 'win',
  FULL_WIN = 'fullwin',
}

const panelConfig = {
  title: 'Panel',

  canvasWidth: 800,
  canvasHeight: 600,

  canvasDisplayWidthWinMode: 800,
  canvasDisplayHeightWinMode: 600,

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
