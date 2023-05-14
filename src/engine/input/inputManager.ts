import Commands from '../../panels/enginePanelCommands';

type KeyCode = string;

type KeyHandler = () => void;

type KeyHandlersMap = {
  [k: KeyCode]: KeyHandler[];
};

class InputManager {
  private keyDownHandlers: KeyHandlersMap = {};
  private keyUpHandlers: KeyHandlersMap = {};

  public init() {}

  public addKeyHandlers(key: KeyCode, keyDownHandler: KeyHandler, keyUpHandler: KeyHandler) {
    this.addKeyDownHandler(key, keyDownHandler);
    this.addKeyUpHandler(key, keyUpHandler);
    postMessage({
      command: Commands.REGISTER_KEY_HANDLER,
      params: key,
    });
  }

  private addKeyDownHandler(key: KeyCode, keyHandler: KeyHandler) {
    this.keyDownHandlers[key] = this.keyDownHandlers[key] ?? [];
    this.keyDownHandlers[key].push(keyHandler);
  }

  private addKeyUpHandler(key: KeyCode, keyHandler: KeyHandler) {
    this.keyUpHandlers[key] = this.keyUpHandlers[key] ?? [];
    this.keyUpHandlers[key].push(keyHandler);
  }

  public onKeyDown(key: KeyCode) {
    const hs = this.keyDownHandlers[key] ?? [];
    hs.forEach((h) => h());
  }

  public onKeyUp(key: KeyCode) {
    const hs = this.keyUpHandlers[key] ?? [];
    hs.forEach((h) => h());
  }
}

export { InputManager, KeyCode };
