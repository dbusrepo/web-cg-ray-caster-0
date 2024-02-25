import type { KeyCode } from './keyCodes';
import { PanelId } from './appTypes';

type KeyInputEvent = {
  code: KeyCode;
  panelId: PanelId;
};

type MouseMoveEvent = {
  dx: number;
  dy: number;
};

type CanvasDisplayResizeEvent = {
  width: number;
  height: number;
};

export type {
  KeyCode,
  KeyInputEvent,
  MouseMoveEvent,
  CanvasDisplayResizeEvent,
};
