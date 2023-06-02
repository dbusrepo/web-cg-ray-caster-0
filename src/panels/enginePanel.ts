// import assert from 'assert';
import { EnginePanelConfig } from '../config/mainConfig';
import { Stats, StatsNameEnum, StatsValues } from '../ui/stats/stats';
import { Panel } from './panel';
import { EnginePanelGui } from './enginePanelGui';
import type { EnginePanelInputKey } from './enginePanelTypes';
import { EnginePanelInputKeysEnum } from './enginePanelTypes';

class EnginePanel extends Panel {
  protected menuGui: EnginePanelGui;

  init(config: EnginePanelConfig, stats: Stats) {
    super.init(config, stats);
    this.initInput();
  }

  private initInput() {
    this.inputKeys = new Set(Object.values(EnginePanelInputKeysEnum));
  }

  get config(): EnginePanelConfig {
    return super.config as EnginePanelConfig;
  }

  protected createPanelGui(): EnginePanelGui {
    return new EnginePanelGui();
  }

  get MenuGui(): EnginePanelGui {
    return this.menuGui;
  }

  protected destroy() {
    super.destroy();
  }
}

export { EnginePanel };
