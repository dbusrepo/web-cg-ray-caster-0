import type { EnginePanelInputKey } from '../panels/enginePanelTypes';
import { EnginePanelInputKeysEnum } from '../panels/enginePanelTypes';
// import type { ViewPanelInputKey } from '../panels/viewPanelTypes';
// import { ViewPanelInputKeysEnum } from '../panels/viewPanelTypes';

type Key = EnginePanelInputKey; // | ViewPanelInputKey;
const keys = { ...EnginePanelInputKeysEnum, }; // ...ViewPanelInputKeysEnum };

export type { Key };
export { keys };
