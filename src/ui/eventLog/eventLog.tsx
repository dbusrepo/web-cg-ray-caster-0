import React from 'react';
import { h, render as preactRender, JSX } from 'preact';
import { EventLogPanel, EventLogPanelProps } from './eventLogPanel';
import { Event, EventLogEntry } from './eventLogHistoryPanel';
import { EventLogConfig } from '../../config/mainConfig';

type EventKey = string;

type EventHandlerInput = any[];
type EventHandlerOutput = string;
type EventHandlerFun = (...args: EventHandlerInput) => EventHandlerOutput;
type EventHandlerConfig = object; // TODO

type EventHandlerFunObj = {
  // callables with a config property
  (...args: EventHandlerInput): EventHandlerOutput;
  config?: EventHandlerConfig;
  default?: boolean;
};

type EventHandler = {
  fn: EventHandlerFun;
  eventKey?: EventKey; // optional for the default handler...
  config?: EventHandlerConfig;
};

// TODO not used?
// const defaultHandler: EventHandlerFunObj =
// (...args: EventHandlerInput) => '';

class EventLog {
  private cfg: EventLogConfig;
  private history: EventLogEntry[];
  private defaultHandler: EventHandlerFunObj | null;
  private handlers: { [k: EventKey]: EventHandler };
  private container: HTMLDivElement;
  private panel: JSX.Element;
  // private element: Element | null; // TODO

  constructor(
    container: HTMLDivElement,
    config: EventLogConfig,
    handlers: { [k: string]: EventHandlerFunObj },
  ) {
    this.cfg = config;
    this.container = container;
    this.history = [];
    this.handlers = {};
    this.defaultHandler = null;

    if (handlers) {
      for (const [eventKey, handler] of Object.entries(handlers)) {
        this.register(eventKey, handler);
      }
    }

    // we render here
    this.log('', this.cfg.helloMsg); // show panel background imm

    // let counter = 0;
    // setInterval(() => {
    //   const val = counter++; //Math.round(Math.random()*1000);
    //   this.log('event ' + val, 'Hello' + ' ' + val);
    // }, 1000);

    // setTimeout(() => {
    // this.clear();
    // let counter = 0;
    // setInterval(() => {
    //   const val = counter++; //Math.round(Math.random()*1000);
    //   this.log(this.config.welcome + val, 'event ' + val);
    // }, 1000);
    // }, 1000);

    // for (let i = 0; i < 20; ++i) {
    //   const val = i; // Math.round(Math.random() * 1000);
    //   this.log('event ' + val, 'Hello ' + val);
    //   // this.log('', 'Hello ' + val);
    // }
  }

  log(event: Event, message: string) {
    const logEntry: EventLogEntry = {
      event,
      message,
    };
    this.history.push(logEntry);
    this.render();
  }

  clear(): void {
    while (this.history.length) {
      // TODO
      this.history.shift();
    }
    this.render();
  }

  register(eventKey: EventKey, handler: EventHandlerFunObj): EventLog {
    if (handler.default) {
      this.defaultHandler = handler;
    } else {
      const eventHandler: EventHandler = {
        fn: handler,
        eventKey,
        config: handler.config,
      };
      this.handlers[eventKey] = eventHandler;
    }
    return this;
  }

  public render(scrollToBottom = false) {
    const panelProps: EventLogPanelProps = {
      // config: this.config, // not used for now
      // dispatch: this.dispatch.bind(this), // not used for now
      history: this.history,
      parentContainer: this.container,
      scrollToBottom,
      fontSize: this.cfg.fontSize,
      lineHeight: this.cfg.lineHeight,
      updateRender: (props: EventLogPanelProps) => {
        this.panel = <EventLogPanel {...props} />;
        preactRender(this.panel, this.container);
      },
      prompt: this.cfg.prompt,
    };

    this.panel = <EventLogPanel {...panelProps} />;
    preactRender(this.panel, this.container);
    return this;
  }

  dispatch(event: Event): void {
    const [eventKey, ...args] = event.split(' ');

    const DEF_RES: EventHandlerOutput = 'Unknown event';
    let result;
    const handler = this.handlers[eventKey];
    if (handler) {
      result = handler.fn(args);
    } else if (this.defaultHandler) {
      result = this.defaultHandler(args);
    }

    this.log(result ?? DEF_RES, event);
  }

  deinit(): void {
    preactRender('', this.container);
    // this.element = null;
  }

  setFontSize(fontSize: number): void {
    this.cfg.fontSize = fontSize;
    this.render();
  }

  setLineHeight(lineHeight: number): void {
    this.cfg.lineHeight = lineHeight;
    this.render();
  }

  setContainer(value: HTMLDivElement) {
    // this.deinit();
    this.container = value;
    this.render(true); // force a re-render
  }

  // toggle(visibility) {
  //   this.panel.toggleVis(visibility);
  // }
}

export { EventLog, EventHandlerFunObj, EventHandlerInput };
