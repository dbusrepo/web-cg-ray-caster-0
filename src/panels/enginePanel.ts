import assert from 'assert';
import { EnginePanelConfig } from '../config/mainConfig';
import { Stats, StatsNames, StatsValues } from '../ui/stats/stats';
import { StatsPanel } from '../ui/stats/statsPanel';
// import { MemoryStats } from '../ui/stats/memoryStats';
import { Panel } from './panel';
import { EnginePanelGui } from './enginePanelGui';
import { EngineParams, EngineCommands } from '../engine/engine';
import EnginePanelCommands from './enginePanelCommands';

class EnginePanel extends Panel {
  protected menuGui: EnginePanelGui;
  private mainEngineWorker: Worker;
  private inputKeys: Set<string> = new Set();

  async init(config: EnginePanelConfig, stats: Stats) {
    super.init({ ...config }, stats);
    this.initInputListeners();
    await this.initMainEngineWorker();
  }

  private ignoreInputKey(key: string): boolean {
    return this.isConsoleOpen;
  }

  initInputListeners(): void {
    const key2cmd = {
      'keydown': EngineCommands.KEY_DOWN,
      'keyup': EngineCommands.KEY_UP,
    };
    type KeyEvents = keyof typeof key2cmd;

    const addKeyListener = (keyEvent: KeyEvents) => (
      this.canvasContainerEl.addEventListener(keyEvent, (event) => {
        if (!this.inputKeys.has(event.code) || this.ignoreInputKey(event.code)) {
          return;
        }
        this.mainEngineWorker.postMessage({
          command: key2cmd[keyEvent],
          params: event.code,
        });
      })
    );

    (Object.keys(key2cmd) as KeyEvents[]).forEach(addKeyListener);
  }

  async initMainEngineWorker() {
    this.mainEngineWorker = new Worker(new URL('../engine/engine.ts', import.meta.url));

    const offscreenCanvas = this.canvasEl.transferControlToOffscreen();

    const engineParams: EngineParams = {
      canvas: offscreenCanvas,
    };

    let resolveInit: (value: void | PromiseLike<void>) => void;

    const initPromise =  new Promise<void>((resolve) => {
      resolveInit = resolve;
    });

    this.setMainWorkerMessageHandlers(resolveInit!);

    this.mainEngineWorker.postMessage(
      {
        command: EngineCommands.INIT,
        params: engineParams,
      },
      [offscreenCanvas],
    );

    await initPromise;
  }

  private setMainWorkerMessageHandlers(resolveInit: (value: void | PromiseLike<void>) => void): void {
    let enginePanel = this;

    const commands = {
      [EnginePanelCommands.INIT]: () => {
        resolveInit();
      },
      [EnginePanelCommands.REGISTER_KEY_HANDLER]: (key: string) => {
        this.inputKeys.add(key);
      },
      [EnginePanelCommands.UPDATE_STATS]: (values: StatsValues) => {
        enginePanel.stats.update(values);
        enginePanel.menuGui.updateFps(values[StatsNames.UFPS]);
      },
      [EnginePanelCommands.EVENT]: (msg: string) => {
        enginePanel.eventLog?.log('event ' + msg, 'Hello ' + msg);
      },
    };

    this.mainEngineWorker.onmessage = ({ data: { command, params } }) => {
      if (commands.hasOwnProperty(command)) {
        try {
          commands[command as keyof typeof commands]!(params);
        } catch (err) {
          console.error('error in engine panel message handler');
          console.error(err);
        }
      }
    };
  }

  get config(): EnginePanelConfig {
    return super.config as EnginePanelConfig;
  }

  protected createPanelGui(): EnginePanelGui {
    return new EnginePanelGui();
  }

  private runMainEngineWorker(): void {
    this.mainEngineWorker.postMessage({
      command: EngineCommands.RUN
    });
  }

  protected destroy() {
    super.destroy();
  }

  run() {
    super.run();
    this.runMainEngineWorker();
  }
}

export { EnginePanel };
