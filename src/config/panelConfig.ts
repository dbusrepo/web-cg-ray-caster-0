import { eventLogConfig } from './eventLogConfig';
import { consoleConfig } from './consoleConfig';
import type { PanelId } from '../app/appTypes';

const enum StartViewMode {
  WIN = 'win',
  FULL_WIN = 'fullwin',
}

const panelConfig = {
  title: 'Panel',

  startViewMode: StartViewMode.WIN as StartViewMode,

  // canvasWidth: 320,
  // canvasHeight: 200,

  // canvasWidth: 400,
  // canvasHeight: 300,

  // canvasWidth: 512,
  // canvasHeight: 384,

  // canvasWidth: 640,
  // canvasHeight: 480,

  // canvasWidth: 800,
  // canvasHeight: 600,

  canvasWidth: 1024,
  canvasHeight: 768,

  // canvasWidth: 1280,
  // canvasHeight: 1024,

  // canvasWidth: 1366,
  // canvasHeight: 768,

  // canvasWidth: 1600,
  // canvasHeight: 900,

  // canvasDisplayWidthWinMode: 320,
  // canvasDisplayHeightWinMode: 200,

  // canvasDisplayWidthWinMode: 512,
  // canvasDisplayHeightWinMode: 384,

  // canvasDisplayWidthWinMode: 640,
  // canvasDisplayHeightWinMode: 480,

  // canvasDisplayWidthWinMode: 800,
  // canvasDisplayHeightWinMode: 600,

  canvasDisplayWidthWinMode: 1024,
  canvasDisplayHeightWinMode: 768,

  // canvasDisplayWidthWinMode: 1280,
  // canvasDisplayHeightWinMode: 1024,

  // canvasDisplayWidthWinMode: 1366,
  // canvasDisplayHeightWinMode: 768,

  // FULL_WIN_KEY: 'F1',
  // FULL_SCREEN_KEY: 'F2',

  eventLogConfig,
  consoleConfig,

  focusOnStart: false,
};

type PanelConfig = typeof panelConfig & {
  id: PanelId;
};

export { StartViewMode, PanelConfig, panelConfig };
