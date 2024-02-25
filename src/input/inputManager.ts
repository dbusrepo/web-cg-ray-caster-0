import type { KeyCode } from '../app/keyCodes';
import type {
  KeyInputEvent,
  MouseMoveEvent,
  // CanvasDisplayResizeEvent,
} from '../app/events';
import { EnginePanelInputKeyCodeEnum } from '../app/keyCodes';
import { InputAction, InputActionBehavior } from './inputAction';

type KeyHandler = () => void;

type KeyHandlersMap = Partial<Record<KeyCode, KeyHandler[]>>;

enum MouseCodeEnum {
  MOVE_LEFT = 0,
  MOVE_RIGHT = 1,
  MOVE_UP = 2,
  MOVE_DOWN = 3,
}

class InputManager {
  private keyActions: Partial<Record<KeyCode, InputAction>> = {};
  private mouseActions: Partial<Record<MouseCodeEnum, InputAction>> = {};

  public mapToKey(key: KeyCode, action: InputAction) {
    this.keyActions[key] = action;
  }

  public mapToMouse(code: MouseCodeEnum, action: InputAction) {
    this.mouseActions[code] = action;
  }

  public onKeyDown({ code: key }: KeyInputEvent) {
    this.keyActions[key]?.press();
  }

  public onKeyUp({ code: key }: KeyInputEvent) {
    this.keyActions[key]?.release();
  }

  public onMouseMove({ dx, dy }: MouseMoveEvent) {
    this.mouseMoveHelper(MouseCodeEnum.MOVE_LEFT, MouseCodeEnum.MOVE_RIGHT, dx);
    this.mouseMoveHelper(MouseCodeEnum.MOVE_UP, MouseCodeEnum.MOVE_DOWN, dy);
  }

  private mouseMoveHelper(
    codeNeg: MouseCodeEnum,
    codePos: MouseCodeEnum,
    amount: number,
  ) {
    const codeAction = amount < 0 ? codeNeg : codePos;
    const action = this.mouseActions[codeAction];
    if (action) {
      action.press(Math.abs(amount));
      action.release();
    }
  }
}

// export type { KeyHandler, Key };
export { InputManager, MouseCodeEnum, EnginePanelInputKeyCodeEnum };
