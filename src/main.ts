import assert from 'assert';
import './css/app.css';
import {
  StartViewMode,
  EnginePanelConfig,
  ViewPanelConfig,
  mainConfig,
} from './config/mainConfig';
import { statsConfig } from './ui/stats/statsConfig';
import { Panel } from './panels/panel';
import { EnginePanel } from './panels/enginePanel';
import { ViewPanel } from './panels/viewPanel';
import { Stats } from './ui/stats/stats';
import { StatsPanel } from './ui/stats/statsPanel';
import { StatsNames } from './ui/stats/stats';

class Main {
  private panels: Panel[];

  init() {
    this.initPanels();
  }

  initPanels(): void {
    const board = <HTMLDivElement>document.querySelector('#board');
    const row0 = document.createElement('div');
    row0.classList.add('row', 'row0');
    const row1 = document.createElement('div');
    row1.classList.add('row', 'row1');
    board.appendChild(row0);
    board.appendChild(row1);
    const stats = this.initStats();
    this.panels = [];
    // const enginePanel = null;

    const enginePanel = this.buildEnginePanel('3D View', board, row0, stats);
    this.panels.push(enginePanel);

    const aPanel = this.buildViewPanel('View', board, row0, stats);
    this.panels.push(aPanel);

    // board.style.display = 'none';
    // const aPanel2 = this.buildViewPanel('View', board, row1, stats);
    // this.panels.push(aPanel2);
  }

  private initStats() {
    const stats = new Stats();
    const cfg = {
      ...statsConfig,
      isVisible: true,
      // enable: false,
      // isVisible: false,
    };
    stats.init(cfg);
    const fpsPanel = new StatsPanel({ title: StatsNames.FPS, fg: '#0ff', bg: '#022', graphHeight: 200 });
    const rpsPanel = new StatsPanel({ title: StatsNames.RPS, fg: '#f80', bg: '#022', graphHeight: 200 });
    const upsPanel = new StatsPanel({ title: StatsNames.UPS, fg: '#0f0', bg: '#020', graphHeight: 200 });
    const ufpsPanel = new StatsPanel({ title: StatsNames.UFPS, fg: '#f50', bg: '#110', graphHeight: 5000 });
    // const unlockedFpsPanel = new StatsPanel(StatsNames.FPSU, '#f50', '#110');
    // const wasmHeapMem = new StatsPanel(StatsNames.WASM_HEAP, '#0b0', '#030');
    // this.mem_panel = new StatsPanel('MEM', '#ff0', '#330');
    stats.addPanel(fpsPanel);
    stats.addPanel(rpsPanel);
    stats.addPanel(upsPanel);
    stats.addPanel(ufpsPanel);
    // this._stats.addPanel(wasmHeapMem);
    // add mem stats panel
    // const memPanel = new MemoryStats(this._stats);
    return stats;
  }

  private buildEnginePanel(
    title: string,
    board: HTMLDivElement,
    parentNode: HTMLDivElement,
    stats: Stats,
  ): EnginePanel {
    const { enginePanelConfig } = mainConfig;
    // parentNode.style.zIndex = '1'; // TODO:
    const panelConfig: EnginePanelConfig = {
      ...enginePanelConfig,
      // startViewMode: StartViewMode.FULL_WIN,
      // startViewMode: StartViewMode.WIN,
      title,
      focusOnStart: true,
      eventLogConfig: {
        ...enginePanelConfig.eventLogConfig,
        isVisible: true,
        isBelowCanvas: true,
      },
    };
    return new EnginePanel(board, parentNode).init(panelConfig, stats);
  }

  private buildViewPanel(
    title: string,
    board: HTMLDivElement,
    parentNode: HTMLDivElement,
    stats: Stats,
  ): ViewPanel {
    const { viewPanelConfig } = mainConfig;
    const panelConfig: ViewPanelConfig = {
      ...viewPanelConfig,
      startViewMode: StartViewMode.WIN,
      title,
      // focusOnStart: true,
    };
    return new ViewPanel(board, parentNode).init(panelConfig, stats);
  }

  run() {
    this.init();
    this.panels.forEach((panel) => {
      panel.run();
    });
  }
}

window.onload = async () => {
  // console.log("isolated:" + self.crossOriginIsolated);
  new Main().run();
};
