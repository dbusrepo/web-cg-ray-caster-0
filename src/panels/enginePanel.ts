import assert from 'assert';
import { EnginePanelConfig } from '../config/mainConfig';
import { Stats, StatsNames, StatsValues } from '../ui/stats/stats';
import { StatsPanel } from '../ui/stats/statsPanel';
// import { MemoryStats } from '../ui/stats/memoryStats';
import { Panel } from './panel';
import { EnginePanelGui } from './enginePanelGui';
import { EngineConfig } from '../engine/engine';
import EnginePanelCommands from './enginePanelCommands';
import EngineCommands from '../engine/commands';

class EnginePanel extends Panel {
  protected menuGui: EnginePanelGui;
  private engineWorker: Worker;
  private inputKeys: Set<string> = new Set();

  init(config: EnginePanelConfig, stats: Stats): EnginePanel {
    super.init(
      {
        ...config,
      },
      stats,
    );
    return this;
  }

  initInputListeners(): void {
    type EngineInputEvents = EngineCommands.KEYUP | EngineCommands.KEYDOWN;

    const ignoreKeys = () => {
      return this.isConsoleOpen;
    };

    const addKeyListener = (type: EngineInputEvents) => (
      this.canvasContainerEl.addEventListener(type, (event) => {
        if (ignoreKeys() || !this.inputKeys.has(event.code)) {
          return;
        }
        this.engineWorker.postMessage({
          command: type,
          params: event.code,
        });
      })
    );

    addKeyListener(EngineCommands.KEYDOWN);
    addKeyListener(EngineCommands.KEYUP);
  }

  initEngineWorker(): void {
    this.engineWorker = new Worker(new URL('../engine/engine.ts', import.meta.url));

    let enginePanel = this;

    const commands = {
      [EnginePanelCommands.UPDATE_STATS]: (values: StatsValues) => {
        enginePanel.stats.update(values);
        enginePanel.menuGui.updateFps(values[StatsNames.UFPS]);
      },
      [EnginePanelCommands.EVENT]: (msg: string) => {
        // console.log(msg);
        enginePanel.eventLog?.log('event ' + msg, 'Hello ' + msg);
      },
      [EnginePanelCommands.REGISTER_KEY_HANDLER]: (key: string) => {
        this.inputKeys.add(key);
      },
    };

    this.engineWorker.onmessage = ({ data: { command, params } }) => {
      if (commands.hasOwnProperty(command)) {
        try {
          commands[command as keyof typeof commands]!(params);
        } catch (err) {
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

  private runEngineWorker(): void {
    const offCanvas = this.canvasEl.transferControlToOffscreen();
    const engineConfig: EngineConfig = {
      canvas: offCanvas,
      sendStats: !!this.stats,
      // usePalette: false,
    };
    this.engineWorker.postMessage(
      {
        command: 'run',
        params: engineConfig,
      },
      [offCanvas],
    );
  }

  protected destroy() {
    super.destroy();
  }

  run() {
    super.run();
    this.initEngineWorker();
    this.initInputListeners();
    this.runEngineWorker();
  }
}

export { EnginePanel };
