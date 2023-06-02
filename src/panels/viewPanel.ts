// import assert from 'assert';
import { ViewPanelConfig } from '../config/mainConfig';
import { Panel } from './panel';
import { Stats } from '../ui/stats/stats';
import { ViewPanelGui } from './viewPanelGui';
import type { ViewPanelInputKey } from './viewPanelTypes';
import { ViewPanelInputKeysEnum } from './viewPanelTypes';

class ViewPanel extends Panel {
  protected menuGui: ViewPanelGui;

  init(config: ViewPanelConfig, stats: Stats) {
    super.init(config, stats);
    this.initInput();
  }

  private initInput() {
    this.inputKeys = new Set(Object.values(ViewPanelInputKeysEnum));
  }

  get config(): ViewPanelConfig {
    return super.config as ViewPanelConfig;
  }

  // protected buildConsoleHandlers(): ConsoleHandlersObjInit {
  //   const consoleHandlers = super.buildConsoleHandlers();
  //   return { ...consoleHandlers }; // TODO augment ?
  // }

  // async setFullScreen(enable: boolean): Promise<void> {
  //   await super.setFullScreen(enable);
  // }

  protected createPanelGui(): ViewPanelGui {
    return new ViewPanelGui();
  }
}

export { ViewPanel };
