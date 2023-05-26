import Keys from './keys';

type KeyHandler = () => void;

type KeyHandlers = Partial<Record<Keys, KeyHandler[]>>;

class InputManager {
  private keyDownHandlers: KeyHandlers = {};
  private keyUpHandlers: KeyHandlers = {};

  public addKeyHandlers(key: Keys, keyDownHandler: KeyHandler, keyUpHandler: KeyHandler) {
    this.addKeyDownHandler(key, keyDownHandler);
    this.addKeyUpHandler(key, keyUpHandler);
  }

  private addKeyDownHandler(key: Keys, keyHandler: KeyHandler) {
    (this.keyDownHandlers[key] = this.keyDownHandlers[key] ?? []).push(keyHandler);
  }

  private addKeyUpHandler(key: Keys, keyHandler: KeyHandler) {
    (this.keyUpHandlers[key] = this.keyUpHandlers[key] ?? []).push(keyHandler);
  }

  public onKeyDown(key: Keys) {
    this.keyDownHandlers[key]?.forEach((h) => h());
  }

  public onKeyUp(key: Keys) {
    this.keyUpHandlers[key]?.forEach((h) => h());
  }
}

export { InputManager, KeyHandler };
