import type { Key } from './keys';
import { PanelId } from '../app/appTypes';

type InputEvent = {
  code: Key;
  panelId: PanelId;
}

export type { InputEvent };
