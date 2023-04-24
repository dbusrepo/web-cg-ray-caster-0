import assert from 'assert';
import { EnginePanelConfig } from '../config/mainConfig';
import { Stats, StatsNames, StatsValues } from '../ui/stats/stats';
import { StatsPanel } from '../ui/stats/statsPanel';
// import { MemoryStats } from '../ui/stats/memoryStats';
import { Panel } from './panel';
import { EnginePanelGui } from './enginePanelGui';
import { EngineConfig } from '../engine/engine';
import Commands from './enginePanelCommands';

const buildEngineWorker = () =>
  new Worker(new URL('../engine/engine.ts', import.meta.url));

class EnginePanel extends Panel {
  protected menuGui: EnginePanelGui;
  private engineWorker: Worker;

  init(config: EnginePanelConfig, stats: Stats): EnginePanel {
    super.init(
      {
        ...config,
      },
      stats,
    );
    return this;
  }

  initEngineWorker(): void {
    this.engineWorker = buildEngineWorker();

    let enginePanel = this;

    const commands = {
      [Commands.UPDATE_STATS]: (values: StatsValues) => {
        enginePanel.stats.update(values);
        enginePanel.menuGui.updateFps(values[StatsNames.UFPS]);
      },
      [Commands.EVENT]: (msg: string) => {
        // console.log(msg);
        enginePanel.eventLog?.log('event ' + msg, 'Hello ' + msg);
      },
      [Commands.REGISTER_KEYDOWN_HANDLER]: (key: string) => {
        enginePanel.canvasContainerEl.addEventListener('keydown', (event) => {
          if (event.code !== key) {
            return;
          }
          enginePanel.engineWorker.postMessage({
            command: 'keydown',
            params: key,
          });
        });
      },
      [Commands.REGISTER_KEYUP_HANDLER]: (key: string) => {
        enginePanel.canvasContainerEl.addEventListener('keyup', (event) => {
          if (event.code !== key) {
            return;
          }
          enginePanel.engineWorker.postMessage({
            command: 'keyup',
            params: key,
          });
        });
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
    this.runEngineWorker();
  }
}

export { EnginePanel };
