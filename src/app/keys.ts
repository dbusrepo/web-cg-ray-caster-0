import type { EnginePanelInputKey } from '../panels/enginePanelTypes';
import { EnginePanelInputKeysEnum } from '../panels/enginePanelTypes';
// import type { ViewPanelInputKey } from '../panels/viewPanelTypes';
// import { ViewPanelInputKeysEnum } from '../panels/viewPanelTypes';

type Key = EnginePanelInputKey; // | ViewPanelInputKey;
const keys = { ...EnginePanelInputKeysEnum }; // ...ViewPanelInputKeysEnum };
const keyOffsets = (Object.values(keys) as Key[]).reduce(
  (acc, key, index) => {
    acc[key] = index;
    return acc;
  },
  {} as Record<Key, number>,
);

export type { Key };
export { keys, keyOffsets };
