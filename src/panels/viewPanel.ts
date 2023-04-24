// import assert from 'assert';
import { ViewPanelConfig } from '../config/mainConfig';
import { Panel } from './panel';
import { Stats } from '../ui/stats/stats';
import { ViewPanelGui } from './viewPanelGui';
import { PanelGui } from './panelGui';
// import { Console, ConsoleHandlersObjInit } from '../ui/console/console';

class ViewPanel extends Panel {
  protected menuGui: ViewPanelGui;
  // constructor(board: HTMLDivElement, parentNode: HTMLDivElement) {
  //   super(board, parentNode);
  // }

  init(config: ViewPanelConfig, stats: Stats) {
    super.init(config, stats);
    return this;
  }

  get config(): ViewPanelConfig {
    return super.config as ViewPanelConfig;
  }

  protected initKeyHandlers(): void {
    super.initKeyHandlers();
  }

  protected onConsoleOpening(): void {
    super.onConsoleOpening();
  }

  protected onConsoleClosing(): void {
    super.onConsoleClosing();
  }

  protected onConsoleHidden(): void {
    super.onConsoleHidden();
  }

  // protected buildConsoleHandlers(): ConsoleHandlersObjInit {
  //   const consoleHandlers = super.buildConsoleHandlers();
  //   return { ...consoleHandlers }; // TODO augment ?
  // }

  // async setFullScreen(enable: boolean): Promise<void> {
  //   await super.setFullScreen(enable);
  // }

  protected setFullStyle(): void {
    super.setFullStyle();
  }

  protected setWinStyle(): void {
    super.setWinStyle();
  }

  protected createPanelGui(): ViewPanelGui {
    return new ViewPanelGui();
  }

  run() {
    super.run();
  }

  protected destroy() {
    super.destroy();
  }
}

export { ViewPanel };
