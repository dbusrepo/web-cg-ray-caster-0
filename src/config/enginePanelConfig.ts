import { PanelConfig, panelConfig } from './panelConfig';

const enginePanelProps = {
  title: '3D Panel',
};

const enginePanelConfig = {
  ...panelConfig,
  ...enginePanelProps,
};

type EnginePanelConfig = PanelConfig & typeof enginePanelProps;

export type { EnginePanelConfig };
export { enginePanelConfig };
