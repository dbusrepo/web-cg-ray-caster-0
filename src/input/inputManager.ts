import type { Key } from '../app/keys';
import { keys, keyOffsets } from '../app/keys';

type KeyHandler = () => void;

type KeyHandlers = Partial<Record<Key, KeyHandler[]>>;

class InputManager {
  private keyDownHandlers: KeyHandlers = {};
  private keyUpHandlers: KeyHandlers = {};

  public addKeyHandlers(
    key: Key,
    keyDownHandler: KeyHandler,
    keyUpHandler: KeyHandler,
  ) {
    this.addKeyDownHandler(key, keyDownHandler);
    this.addKeyUpHandler(key, keyUpHandler);
  }

  private addKeyDownHandler(key: Key, keyHandler: KeyHandler) {
    (this.keyDownHandlers[key] = this.keyDownHandlers[key] ?? []).push(
      keyHandler,
    );
  }

  private addKeyUpHandler(key: Key, keyHandler: KeyHandler) {
    (this.keyUpHandlers[key] = this.keyUpHandlers[key] ?? []).push(keyHandler);
  }

  public onKeyDown(key: Key) {
    this.keyDownHandlers[key]?.forEach((h) => h());
  }

  public onKeyUp(key: Key) {
    this.keyUpHandlers[key]?.forEach((h) => h());
  }
}

export type { KeyHandler, Key };
export { InputManager, keys, keyOffsets };
