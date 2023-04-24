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

  public addKeyDownHandler(key: KeyCode, keyHandler: KeyHandler) {
    this.keyDownHandlers[key] = this.keyDownHandlers[key] ?? [];
    this.keyDownHandlers[key].push(keyHandler);
    postMessage({
      command: Commands.REGISTER_KEYDOWN_HANDLER,
      params: key,
    });
  }

  public addKeyUpHandler(key: KeyCode, keyHandler: KeyHandler) {
    this.keyUpHandlers[key] = this.keyUpHandlers[key] ?? [];
    this.keyUpHandlers[key].push(keyHandler);
    postMessage({
      command: Commands.REGISTER_KEYUP_HANDLER,
      params: key,
    });
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
