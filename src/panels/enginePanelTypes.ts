enum EnginePanelInputKeyCodeEnum {
  KEY_W = 'KeyW',
  KEY_A = 'KeyA',
  KEY_S = 'KeyS',
  KEY_D = 'KeyD',
  KEY_Q = 'KeyQ',
  KEY_E = 'KeyE',
  KEY_Z = 'KeyZ',
  KEY_X = 'KeyX',
  KEY_C = 'KeyC',
  ARROW_LEFT = 'ArrowLeft',
  ARROW_RIGHT = 'ArrowRight',
  ARROW_UP = 'ArrowUp',
  ARROW_DOWN = 'ArrowDown',
}

type EnginePanelInputKeyCode = `${EnginePanelInputKeyCodeEnum}`;

export type { EnginePanelInputKeyCode };
export { EnginePanelInputKeyCodeEnum };
