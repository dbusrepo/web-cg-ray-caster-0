import assert from 'assert';
import screenfull from 'screenfull';
import {
  StartViewMode,
  PanelConfig,
  EventLogConfig,
  ConsoleConfig,
} from '../config/mainConfig';
import { Console, ConsoleHandlersObjInit } from '../ui/console/console';
import { PanelGui } from './panelGui';
import { EventLog } from '../ui/eventLog/eventLog';
import { Stats } from '../ui/stats/stats';

// TODO move?
const resetClassName = (node: HTMLElement) => {
  node.className = ''; // empty the list
};

// fullscreen api can only be initiated by a user gesture
const enum ViewMode {
  WIN = 'win',
  FULL_WIN = 'fullwin',
  FULL_SCREEN = 'fullscreen',
}

abstract class Panel {
  private static panelList: Panel[] = [];

  private cfg: PanelConfig;

  private board: HTMLDivElement; // used to append the panel in full win/screen
  private parentNode: HTMLDivElement;

  private panelContainer: HTMLDivElement;
  private panelDiv: HTMLDivElement;

  private panelContainerWinFull: HTMLDivElement;
  // eslint-disable-next-line max-len
  private panelContainerWinFullHeight: number; // cached to avoid fs -> fw errors

  private canvasContainer: HTMLDivElement;
  private canvas: HTMLCanvasElement;

  // perc wrt to panel container when in full win/screen to allow the vis of
  // event log below
  private canvasDisplayHeightPercFull: number; // TODO check use

  // note: the event log can be rendered on the main panel or on a separate own
  // panel when in full (win) mode the event log uses _eventLogMainContainer
  // inside the

  // canvas container and the log is displayed inside the main panel: it can be
  // displayed in the main panel (in place of canvas) or in a bottom part under
  // the canvas
  // when in win mode it uses its own panel _eventLogContainer which is
  // displayed always under the main panel container

  protected eventLog: EventLog;
  private eventLogBottomPanel: HTMLDivElement;
  private eventLogMainPanel: HTMLDivElement;

  private console: Console;

  protected abstract menuGui: PanelGui;

  protected stats: Stats;
  protected inputKeys: Set<string>;

  protected viewMode: ViewMode;
  protected preViewMode: ViewMode;

  constructor(board: HTMLDivElement, parentNode: HTMLDivElement) {
    this.board = board;
    this.parentNode = parentNode;
  }

  init(panelConfig: PanelConfig, stats: Stats) {
    this.cfg = structuredClone(panelConfig);
    this.stats = stats;
    this.initPanel();
    this.initCanvas();
    this.initEventLog();
    this.initConsole();
    this.initFullScreenMode();
    Panel.panelList.push(this);
  }

  private initPanel(): void {
    this.panelContainer = document.createElement('div');
    this.panelContainer.classList.add('panel-container');
    this.panelContainerWinFull = document.createElement('div');
    this.panelContainerWinFull.classList.add('panel-container-win-full');
    this.board.appendChild(this.panelContainerWinFull); // TODO in init
    this.panelContainerWinFullHeight =
      this.panelContainerWinFull.offsetHeight;
    this.panelDiv = document.createElement('div');
    this.panelDiv.tabIndex = -1; // TODO call this before focus() !
    // this._panelContainer.appendChild(this._panel); // done before run
    this.parentNode.appendChild(this.panelContainer);
    this.addListeners();
  }

  private setPanelWinStyle(): void {
    resetClassName(this.panelDiv);
    this.panelDiv.classList.add('panel', 'panel-win');
    this.panelContainer.style.marginTop = '0';
    this.panelDiv.style.marginTop = '0';
    this.panelDiv.style.width = `auto`;
    this.panelDiv.style.height = `auto`;
    this.panelContainerWinFull.style.display = 'none';
    if (!(this.isInit() || this.preViewMode === ViewMode.WIN)) {
      this.setAllPanelsToWinMode();
    }
  }

  private setPanelFullStyle(): void {
    assert(
      this.isFullScreen ||
        this.panelDiv.parentNode === this.panelContainerWinFull,
    );
    resetClassName(this.panelDiv);
    this.panelDiv.classList.add('panel', 'panel-full');
    const menuBarHeight = 25; // see guify guify theme.js
    this.panelDiv.style.marginTop = `${menuBarHeight}px`;
    const panelFullHeight = this.isFullScreen
      ? screen.height
      : this.panelContainerWinFullHeight;
    this.panelDiv.style.height = `${panelFullHeight - 25}px`;
    this.hideOtherPanels();
    this.panelContainerWinFull.style.display = 'block';
  }

  private setViewMode(viewMode: ViewMode): void {
    this.preViewMode = this.viewMode;
    this.viewMode = viewMode;
  }

  private canStartInFullWin(): boolean {
    // if a previous panel is already in full win, return false....
    for (const panel of Panel.getPanelList()) {
      if (panel === this) {
        return true;
      }
      if (panel.isFullWin) {
        return false;
      }
    }
    return false;
  }

  private initFullWinMode(): void {
    // console.log('start view mode: ' + this._config.startViewMode);
    if (this.cfg.startViewMode === StartViewMode.FULL_WIN) {
      // console.log('Can start in fw: ' + this.canStartInFullWin());
      if (this.canStartInFullWin()) {
        this.setFullWin(true);
      } else {
        this.cfg.startViewMode = StartViewMode.WIN;
        this.initWinMode();
      }
    }
  }

  // toggle win - fullwin
  public setFullWin(enable: boolean): void {
    if (enable) {
      this.setViewMode(ViewMode.FULL_WIN);
      this.toFullWinStyle();
    } else {
      this.setViewMode(ViewMode.WIN);
      this.toWinStyle();
    }
    if (!this.isInit()) {
      this.focus();
    }
  }

  // fullscreen mode can be entered only by a gesture, so we init only here
  private initFullScreenMode(): void {
    if (screenfull.isEnabled) {
      screenfull.on('change', () => {
        // handle here the case when the user presses ESC to exit from FS mode
        // because the Escape key is not detected as a keydown event...
        if (this.isFullScreen && !screenfull.isFullscreen) {
          this.resetModeAfterFullScreen();
        }
      });
    } else {
      console.error('Fullscreen not supported');
      return;
    }
    screenfull.onerror((event) => {
      console.error('screenfull error', event);
    });
  }

  public async setFullScreen(enable: boolean): Promise<void> {
    if (!screenfull.isEnabled) {
      console.error('Fullscreen not allowed!');
      return;
    }
    if (enable) {
      this.enableFullScreenMode();
      await screenfull.request(this.panelContainer, { navigationUI: 'hide' });
    } else {
      assert(screenfull.isFullscreen);
      await screenfull.exit();
      this.resetModeAfterFullScreen();
    }
  }

  private enableFullScreenMode(): void {
    // if in full win go to win mode first and then to fullscreen
    if (this.viewMode === ViewMode.FULL_WIN) {
      this.setFullWin(false);
      // eslint-disable-next-line max-len
      // to have preViewMode set to fullwin with setViewMode(ViewMode.FULL_SCREEN)
      this.viewMode = ViewMode.FULL_WIN;
    }
    this.setViewMode(ViewMode.FULL_SCREEN);
    this.resetGui();
    this.setFullStyle();
  }

  private resetModeAfterFullScreen() {
    assert(
      this.viewMode === ViewMode.FULL_SCREEN &&
        (this.preViewMode === ViewMode.WIN ||
          this.preViewMode === ViewMode.FULL_WIN),
    );
    const fromFullWin = this.preViewMode === ViewMode.FULL_WIN;
    this.setFullWin(false);
    if (fromFullWin) {
      this.setFullWin(true);
    }
  }

  private addListeners(): void {
    this.initKeyHandlers();
    const onPanelFocus = (event: FocusEvent) => {
      this.canvasContainer.focus();
    };
    this.panelDiv.addEventListener('focus', onPanelFocus);
  }

  protected initKeyHandlers(): void {
    const onPanelKeyDown = (e: KeyboardEvent) => {
      // switch (e.key) {
      //   case Panel.FULL_WIN_KEY:
      //     // this.toggleFullWin(); // disable for now TODO
      //     break;
      //   case Panel.FULL_SCREEN_KEY:
      //     // this.toggleFullScreen(); // disable for now TODO
      //     break;
      //   // case 'F3':
      //   case 'Escape': // TODO
      //     // when in FS esc exit from FS, but note this handler here is not
      //     // executed !
      //     break;
      //   // case Panel.CONSOLE_KEY:
      //   //   console.log('panel console key detected');
      //   //   break;
      //   default:
      //     break;
      // }
      // if (!this._isConsoleOpen && e.key !== Panel.CONSOLE_KEY) {
      //   console.log('block console key');
      //   // if console key, let console handle it
      //   // otherwise stop event prop during capturing phase
      //   // rem: top down, on the bottom there is the console container
      //   e.stopPropagation();
      // }
    };
    // last arg true to capture events from top
    this.panelDiv.addEventListener('keydown', onPanelKeyDown, true);
  }

  private initCanvas(): void {
    this.canvasContainer = document.createElement('div');
    this.canvas = document.createElement('canvas');
    this.canvas.width = Number(this.cfg.canvasWidth);
    this.canvas.height = Number(this.cfg.canvasHeight);
    // other init elements could change canvas props (event log?) so we start
    // hidden
    // this._panelContainer.appendChild(this._canvas);
    this.canvasContainer.appendChild(this.canvas);
    this.canvasContainer.tabIndex = -1; // make it focusable
    this.panelDiv.appendChild(this.canvasContainer);
  }

  private setCanvasWinStyle(): void {
    resetClassName(this.canvas);
    this.canvas.classList.add('canvas', 'canvas-win');
    this.canvasContainer.style.width = `${this.cfg.canvasDisplayWidthWinMode}px`;
    this.canvasContainer.style.height = `${this.cfg.canvasDisplayHeightWinMode}px`;
    resetClassName(this.canvasContainer);
    this.canvasContainer.classList.add(
      'canvas-container',
      'canvas-container-win',
    );
  }

  private setCanvasFullStyle(): void {
    assert(!this.isWinMode);
    // update canvas
    resetClassName(this.canvas);
    this.canvas.classList.add('canvas', 'canvas-full');
    this.canvasContainer.style.width = '100%';
    this.canvasContainer.style.height = '100%';
    // update canvas container
    resetClassName(this.canvasContainer);
    this.canvasContainer.classList.add(
      'canvas-container',
      'canvas-container-full',
    );
    this.updateCanvasContainerHeightFullMode();
  }

  private initEventLog(): void {
    // if (!this.config.enableEventLog) {
    //   return;
    // }
    this.eventLogMainPanel = document.createElement('div');
    this.eventLogMainPanel.classList.add('event-log-main-panel');
    this.eventLogBottomPanel = document.createElement('div');
    this.moveOutEventLogBottomPanel();
    this.moveOutEventLogMainPanel();
    let eventContainer;
    if (this.isEventLogBelowCanvas) {
      // this.showEventLogOnBottomPanel(true);
      eventContainer = this.eventLogBottomPanel;
    } else {
      // this.showEventLogOnMainPanel(true);
      eventContainer = this.eventLogMainPanel;
    }
    const eventLogConfig: EventLogConfig = {
      ...this.cfg.eventLogConfig,
      fontSize: this.cfg.eventLogConfig.fontSize,
      lineHeight: this.cfg.eventLogConfig.lineHeight,
    };
    const eventHandlers = {};
    this.eventLog = new EventLog(
      eventContainer,
      eventLogConfig,
      eventHandlers,
    );
  }

  protected initConsole(): void {
    // if (!this.config.enableConsole) {
    //   return;
    // }
    const consoleConfig: ConsoleConfig = {
      ...this.cfg.consoleConfig,
      caseSensitive: true,
      autoComplete: true,
      onOpening: () => {
        this.onConsoleOpening();
      },
      onClosing: () => {
        this.onConsoleClosing();
      },
      onOpened: () => {
        this.onConsoleOpened();
      },
      onClosed: () => {
        this.onConsoleHidden();
      },
      prompt: this.config.consoleConfig.prompt,
      fontSize: this.cfg.consoleConfig.fontSize,
      lineHeight: this.cfg.consoleConfig.lineHeight,
    };
    const consoleHandlers = this.buildConsoleHandlers();
    this.console = new Console(
      this.canvasContainer,
      consoleConfig,
      consoleHandlers,
    );
    // this.container.addEventListener('focus', () => {
    //   assert(this.consoleContainer);
    //   this.consoleContainer.focus();
    // });
  }

  // TODO refactor ?
  protected buildConsoleHandlers(): ConsoleHandlersObjInit {
    const clear = () => {
      this.console.clear();
    };
    const defaultHandler = () => 'Unrecognized command';
    defaultHandler.isDefault = true;
    return {
      // showMenu,
      // hideMenu,
      clear,
      defaultHandler,
    };
  }

  protected onConsoleOpening(): void {
    // this.add_key_listener();
    this.isConsoleOpen = true;
    // if (this.menuGui) {
    //   this.menuGui.hide();
    // }
  }

  protected onConsoleOpened(): void {}

  protected onConsoleClosing(): void {
    // if (this.menuGui) {
    //   this.menuGui.show();
    // }
  }

  protected onConsoleHidden(): void {
    // called after transitionEnd, see console panel impl
    // this.add_key_listener();
    this.isConsoleOpen = false;
    this.focus(); // give focus to panel
  }

  focus(): void {
    this.panelDiv.focus(); // onFocus called
  }

  protected setAllPanelsToWinMode(): void {
    for (const panel of Panel.getPanelList()) {
      panel.panelContainerWinFull.style.display = 'none';
      panel.panelContainer.style.display = 'block';
      // force all panels to win mode
      panel.setViewMode(ViewMode.WIN);
      if (panel !== this) {
        panel.toWinStyle();
      }
    }
  }

  private hideOtherPanels(): void {
    for (const panel of Panel.getPanelList()) {
      if (panel !== this) {
        panel.hide();
      }
    }
  }

  protected hide(): void {
    this.panelContainerWinFull.style.display = 'none';
    this.panelContainer.style.display = 'none';
  }

  // used to check some event log invariants
  private eventLogCheckInv(): void {
    // TODO remove/debug mode only?
    // console.log('inv');
    if (this.isEventLogVisible) {
      if (this.isEventLogBelowCanvas) {
        assert(this.panelDiv.lastChild === this.eventLogBottomPanel);
      } else {
        assert(this.panelContainer.lastChild === this.eventLogBottomPanel);
      }
    } else {
      assert(this.panelContainer.lastChild === this.eventLogBottomPanel);
    }
  }

  private isPanelInsideParentContainer(): boolean {
    return this.panelDiv.parentNode === this.panelContainer;
  }

  private appendPanelTo(element: HTMLDivElement): void {
    this.panelDiv.parentNode?.removeChild(this.panelDiv);
    element.appendChild(this.panelDiv);
  }

  protected toWinStyle(): void {
    assert(this.isWinMode);
    if (!this.isPanelInsideParentContainer()) {
      this.appendPanelTo(this.panelContainer);
    }
    this.setWinStyle();
    this.resetGui();
    assert(this.isPanelInsideParentContainer());
  }

  protected setWinStyle(): void {
    this.setPanelWinStyle();
    this.setCanvasWinStyle();
    this.console.setOnWinMode();
    this.setEventLogBottomPanelWinStyle();
    this.moveEventLogBottomPanelOutOfPanel();
    this.setEventLogVisibility(this.isEventLogVisible);
    // if (this.isEventLogVisible) {
    //   this._eventLog.render(true); // TODO check double render ?
    //   if (!this.isEventLogOnBottomPanel) {
    //     this.moveEventLogAfterPanel();
    //   }
    // } else {
    //   this.moveEventLogAfterPanel();
    // }
    this.eventLogCheckInv();
    this.updateStatsParent(this.boardEl);
  }

  private initWinMode(): void {
    if (this.cfg.startViewMode === StartViewMode.WIN) {
      this.setViewMode(ViewMode.WIN);
      this.toWinStyle();
    }
  }

  private isInit(): boolean {
    return this.preViewMode === undefined;
  }

  protected resetGui(): void {
    this.menuGui?.removefromDom();
    this.initGui();
  }

  private toFullWinStyle(): void {
    assert(this.isFullWin);
    if (this.isInit() || this.preViewMode === ViewMode.WIN) {
      assert(this.isInit() || this.isPanelInsideParentContainer());
      this.appendPanelTo(this.panelContainerWinFull);
      this.setEventLogVisibility(this.isEventLogVisible);
      this.setFullStyle();
      this.resetGui();
    }
    assert(this.panelDiv.parentNode === this.panelContainerWinFull);
  }

  private updateStatsParent(parent: HTMLDivElement): void {
    if (
      this.isInit() &&
      Panel.getPanelList().filter((p) => p !== this && p.isFullWin).length
    ) {
      // if a prev panel while init was in fullWin mode, don't update stats parent
      // to avoid setting an incorrect parent node
      return;
    }
    this.stats.setParentNode(parent);
    this.setStatsVisible(this.isStatsVisible);
  }

  protected setFullStyle(): void {
    this.setPanelFullStyle();
    this.setCanvasFullStyle();
    this.console.setOnFullMode(); // TODO: check from here...
    this.setEventLogBottomPanelFullStyle(); // TODO: not necessary?
    this.eventLog.render(true);
    this.updateStatsParent(this.panelEl);
  }

  private setEventLogBottomPanelWinStyle(): void {
    assert(this.eventLogBottomPanel);
    // assert(this.eventLog);
    resetClassName(this.eventLogBottomPanel);
    this.eventLogBottomPanel.classList.add(
      'event-log-bottom-panel',
      'event-log-bottom-panel-win',
    );
    // width 100% see css
    this.eventLogBottomPanel.style.height = `${
      this.config.eventLogConfig.percHeightWin *
      this.cfg.canvasDisplayHeightWinMode
    }px`; // height in px here
  }

  private setEventLogBottomPanelFullStyle(): void {
    assert(this.eventLogBottomPanel);
    // assert(this.eventLog);
    resetClassName(this.eventLogBottomPanel);
    this.eventLogBottomPanel.classList.add(
      'event-log-bottom-panel',
      'event-log-bottom-panel-full',
    );
    this.updateEventLogBottomPanelHeightPercFullMode(); // TODO not nec
  }

  // Note: the events log can be showed on his own panel (below the canvas)
  // or the same area of canvas (the canvas is hidden in that case). The two are
  // complementary states

  private moveEventLogBottomPanelInsidePanel(): void {
    assert(this.eventLogBottomPanel);
    this.eventLogBottomPanel.parentNode?.removeChild(
      this.eventLogBottomPanel,
    );
    // pushed as last el
    this.panelDiv.appendChild(this.eventLogBottomPanel);
  }

  private moveEventLogBottomPanelOutOfPanel(): void {
    const eventLogBottomPanel = this.eventLogBottomPanel!;
    eventLogBottomPanel.parentNode?.removeChild(eventLogBottomPanel);
    // we move the log below the panel to keep the same height with main
    // container and the canvas otherwise without the event panel below the
    // canvas would be recentered...
    this.panelContainer.appendChild(eventLogBottomPanel);
  }

  private moveOutEventLogBottomPanel(): void {
    assert(this.eventLogBottomPanel);
    this.eventLogBottomPanel!.style.visibility = 'hidden';
    this.moveEventLogBottomPanelOutOfPanel();
    if (!this.isWinMode) {
      this.updateCanvasContainerHeightFullMode();
    }
  }

  // private hideEventsLogMainPanel(showOnBottomPanel: boolean): void {
  private moveOutEventLogMainPanel(): void {
    assert(this.eventLogMainPanel);
    // assert(!this.isEventLogOnBottomPanel);
    // this.isEventLogOnBottomPanel = showOnBottomPanel;
    // this._eventLogMainPanel.style.visibility = 'hidden';
    this.eventLogMainPanel.style.visibility = 'hidden';
    this.canvas.style.visibility = 'visible'; // display block/none ?
    this.eventLogMainPanel.parentNode?.removeChild(this.eventLogMainPanel);
  }

  private moveInEventLogBottomPanel(): void {
    // assert(this.eventLog);
    assert(this.eventLogBottomPanel);
    assert(this.isEventLogBelowCanvas);
    assert(this.isEventLogVisible);
    this.moveEventLogBottomPanelInsidePanel();
    this.eventLogBottomPanel.style.visibility = 'visible';
    if (!this.isWinMode) {
      this.updateCanvasContainerHeightFullMode();
      this.updateEventLogBottomPanelHeightPercFullMode();
    }
    this.eventLog.setContainer(this.eventLogBottomPanel);
    this.eventLogCheckInv();
  }

  private moveInEventLogMainPanel(): void {
    // assert(this.eventLog);
    assert(this.eventLogMainPanel);
    assert(!this.isEventLogBelowCanvas);
    assert(this.isEventLogVisible);
    this.canvas.style.visibility = 'hidden';
    this.eventLogMainPanel.style.visibility = 'visible';
    this.canvasContainer.appendChild(this.eventLogMainPanel);
    this.eventLog.setContainer(this.eventLogMainPanel);
    this.eventLogCheckInv();
  }

  public setEventLogBelowCanvas(): void {
    this.isEventLogBelowCanvas = true;
    if (this.isEventLogVisible) {
      this.moveOutEventLogMainPanel();
      this.moveInEventLogBottomPanel();
    }
  }

  public setEventLogOnCanvas(): void {
    this.isEventLogBelowCanvas = false;
    if (this.isEventLogVisible) {
      this.moveOutEventLogBottomPanel();
      this.moveInEventLogMainPanel();
    }
  }

  private updateCanvasContainerHeightFullMode(): void {
    this.canvasDisplayHeightPercFull = 1;
    if (this.isEventLogVisible && this.isEventLogBelowCanvas) {
      this.canvasDisplayHeightPercFull =
        1 - this.config.eventLogConfig.percHeightFull;
    }
    this.canvasContainer.style.height = `${
      this.canvasDisplayHeightPercFull * 100
    }%`;
  }

  private updateEventLogBottomPanelHeightPercFullMode(): void {
    assert(this.eventLogBottomPanel);
    this.eventLogBottomPanel.style.height = `${
      (1 - this.canvasDisplayHeightPercFull) * 100
    }%`;
  }

  toggleFullscreen(): void {
    this.setFullScreen(!this.isFullScreen);
  }

  toggleFullWin(): void {
    if (!this.isFullScreen) {
      this.setFullWin(!this.isFullWin);
    } else {
      this.preViewMode = ViewMode.FULL_WIN;
      this.setFullScreen(false);
    }
  }

  setEventLogVisibility(visible: boolean): void {
    this.isEventLogVisible = visible;
    if (this.isEventLogBelowCanvas) {
      if (visible) {
        this.moveInEventLogBottomPanel();
      } else {
        this.moveOutEventLogBottomPanel();
      }
    } else if (visible) {
      this.moveInEventLogMainPanel();
    } else {
      this.moveOutEventLogMainPanel();
    }
    this.eventLogCheckInv();
  }

  public setStatsVisible(visible: boolean): void {
    assert(this.stats);
    this.isStatsVisible = visible;
    if (visible) {
      this.stats.show();
    } else {
      this.stats.hide();
    }
  }

  setEventLogFontSize(fontSize: number): void {
    // assert(this.eventLog);
    this.eventLog.setFontSize(fontSize);
  }

  setEventLogLineHeight(lineHeight: number): void {
    // assert(this.eventLog);
    this.eventLog.setLineHeight(lineHeight);
  }

  setConsoleFontSize(fontSize: number): void {
    // assert(this.console);
    this.console.setFontSize(fontSize);
  }

  setConsoleLineHeight(lineHeight: number): void {
    // assert(this.eventLog);
    this.console.setLineHeight(lineHeight);
  }

  protected initGui(): void {
    if (!this.menuGui) {
      this.menuGui = this.createPanelGui();
    }
    this.menuGui.init(this);
  }

  protected abstract createPanelGui(): PanelGui;

  private initFocus(): void {
    // if a previous panel has starting focus, ignore start focus for this
    let panel;
    for (panel of Panel.getPanelList()) {
      if (panel === this || panel.cfg.focusOnStart) {
        break;
      }
    }
    if (panel === this && this.cfg.focusOnStart) {
      this.focus();
    }
  }

  public ignoreInputKey(_key: string): boolean {
    return this.isConsoleOpen;
  }

  showInit(): void {
    this.initWinMode();
    this.initFullWinMode();
    this.initFocus();
  }

  protected destroy() {}

  get isWinMode(): boolean {
    return this.viewMode === ViewMode.WIN;
  }

  get canvasContainerEl(): HTMLDivElement {
    return this.canvasContainer;
  }

  get panelContainerFullWinEl(): HTMLDivElement {
    return this.panelContainerWinFull;
  }

  get panelContainerEl(): HTMLDivElement {
    return this.panelContainer;
  }

  get panelEl(): HTMLDivElement {
    return this.panelDiv;
  }

  get boardEl(): HTMLDivElement {
    return this.board;
  }

  get Canvas(): HTMLCanvasElement {
    return this.canvas;
  }

  get menuGuiContainer(): HTMLDivElement {
    return this.isFullWin
      ? this.panelContainerFullWinEl
      : this.panelContainerEl;
  }

  get menuGuiBarMode(): string {
    return this.isWin ? 'offset' : 'full';
  }

  get isWin(): boolean {
    return !(this.isFullWin || this.isFullScreen);
  }

  get isFullWin(): boolean {
    return this.viewMode === ViewMode.FULL_WIN;
  }

  get isFullScreen(): boolean {
    // screenfull.isEnabled
    return this.viewMode === ViewMode.FULL_SCREEN;
  }

  get title(): string {
    return this.config.title;
  }

  get config(): PanelConfig {
    return this.cfg;
  }

  static getPanelList(): Panel[] {
    return Panel.panelList;
  }

  public get isStatsVisible(): boolean {
    return this.stats.isVisible;
  }

  private set isStatsVisible(value: boolean) {
    this.stats.isVisible = value;
  }

  get Stats(): Stats {
    return this.stats;
  }

  get EventLog(): EventLog {
    return this.eventLog;
  }

  get isConsoleOpen(): boolean {
    return this.cfg.consoleConfig.isOpen;
  }

  set isConsoleOpen(value: boolean) {
    this.cfg.consoleConfig.isOpen = value;
  }

  get isEventLogVisible(): boolean {
    return this.cfg.eventLogConfig.isVisible;
  }

  set isEventLogVisible(value: boolean) {
    this.cfg.eventLogConfig.isVisible = value;
  }

  get isEventLogBelowCanvas(): boolean {
    return this.cfg.eventLogConfig.isBelowCanvas;
  }

  private set isEventLogBelowCanvas(value: boolean) {
    this.cfg.eventLogConfig.isBelowCanvas = value;
  }

  get InputEl(): HTMLElement {
    return this.canvasContainerEl;
  }

  get InputKeys(): Set<string> {
    return this.inputKeys;
  }

  get InputElement(): HTMLElement {
    return this.canvasContainer;
  }

  get Id() {
    return this.cfg.id;
  }
}

export { Panel, ViewMode };
