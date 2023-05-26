import { KeysEnum } from './keys';

type KeyHandler = () => void;

type KeyHandlers = Partial<Record<KeysEnum, KeyHandler[]>>;

class InputManager {
  private keyDownHandlers: KeyHandlers = {};
  private keyUpHandlers: KeyHandlers = {};

  public addKeyHandlers(key: KeysEnum, keyDownHandler: KeyHandler, keyUpHandler: KeyHandler) {
    this.addKeyDownHandler(key, keyDownHandler);
    this.addKeyUpHandler(key, keyUpHandler);
  }

  private addKeyDownHandler(key: KeysEnum, keyHandler: KeyHandler) {
    (this.keyDownHandlers[key] = this.keyDownHandlers[key] ?? []).push(keyHandler);
  }

  private addKeyUpHandler(key: KeysEnum, keyHandler: KeyHandler) {
    (this.keyUpHandlers[key] = this.keyUpHandlers[key] ?? []).push(keyHandler);
  }

  public onKeyDown(key: KeysEnum) {
    this.keyDownHandlers[key]?.forEach((h) => h());
  }

  public onKeyUp(key: KeysEnum) {
    this.keyUpHandlers[key]?.forEach((h) => h());
  }
}

export type { KeyHandler };
export { InputManager };
