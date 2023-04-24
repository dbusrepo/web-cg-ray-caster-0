import { MonitorBindingApi } from 'tweakpane';
import { PanelGui, PanelTweakOptions, PanelTweakOptionsKeys } from './panelGui';
import { EnginePanel } from './enginePanel';
import MaxDeque from '../ds/maxDeque';

enum EnginePanelTweakOptionsKeys {
  FPS = 'fps',
}

type EnginePanelTweakOptions = PanelTweakOptions & {
  [EnginePanelTweakOptionsKeys.FPS]: number;
};

class EnginePanelGui extends PanelGui {
  protected panel: EnginePanel;
  protected tweakOptions: EnginePanelTweakOptions;
  private fpsMonitor: MonitorBindingApi<number>;
  private maxDeque: MaxDeque;

  init(panel: EnginePanel) {
    super.init(panel);
  }

  protected initTweakPaneOptionsObj(): void {
    super.initTweakPaneOptionsObj();
    this.tweakOptions = {
      ...this.tweakOptions,
      [EnginePanelTweakOptionsKeys.FPS]: 50,
    };
  }

  protected addTweakPaneOptions() {
    super.addStatsOpt();
    super.addEventLogOpt();
    const bufferSize = 64;
    // https://github.com/cocopon/tweakpane/issues/415
    // disable monitor interval and update it only in updateFps ? use
    // interval: 0,
    this.fpsMonitor = this.tweakPane.addMonitor(
      this.tweakOptions,
      EnginePanelTweakOptionsKeys.FPS,
      {
        view: 'graph',
        // interval: 100,
        interval: 0,
        min: 0,
        // max: 100,
        // max: 1000,
        bufferSize,
      }
    );
    this.maxDeque = new MaxDeque(bufferSize);
    // this.fpsMonitor.disabled = true;
  }

  updateFps(fps: number) {
    this.maxDeque.push(fps);
    this.tweakOptions[EnginePanelTweakOptionsKeys.FPS] = fps;
    this.fpsMonitor.label = `${fps.toFixed(0)} FPS`;
    // https://github.com/cocopon/tweakpane/issues/371
    // // @ts-ignore
    // const max = this.fpsMonitor.controller_.valueController.props_?.get('maxValue');
    // @ts-ignore
    this.fpsMonitor.controller_.valueController.props_.set('maxValue', this.maxDeque.max * 1.5);
    // console.log(this.fpsMonitor.controller_.valueController);
    this.fpsMonitor.refresh();
  }

  // get panel(): EnginePanel {
  //   return super.panel as EnginePanel;
  // }
}

export { EnginePanelGui };
