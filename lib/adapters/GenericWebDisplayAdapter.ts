import { ADAPTER_IDS, LAYOUT_IDS, type DetectedDeviceInfo, type DeviceConfiguration, type LayoutDefinition, type WallDisplayAdapter } from './types';

const GENERIC_WEB_DISPLAY_LAYOUTS: readonly LayoutDefinition[] = [
  { id: LAYOUT_IDS.GRID_2X4, columns: 2, rows: 4 },
  { id: LAYOUT_IDS.GRID_3X6, columns: 3, rows: 6 },
];

/**
 * Fallback adapter. It never probes a remote protocol.
 */
export class GenericWebDisplayAdapter implements WallDisplayAdapter {
  public readonly id = ADAPTER_IDS.GENERIC_WEB_DISPLAY;
  public readonly nameKey = 'adapters.generic_web_display';
  public readonly canAutoIdentify = false;

  public async tryIdentify(ip: string): Promise<DetectedDeviceInfo | null> {
    void ip;
    return null;
  }

  public getSupportedLayouts(): readonly LayoutDefinition[] {
    return GENERIC_WEB_DISPLAY_LAYOUTS;
  }

  public createInitialConfiguration(): DeviceConfiguration {
    return {
      version: 1,
      layoutId: LAYOUT_IDS.GRID_2X4,
      supportedLayoutIds: GENERIC_WEB_DISPLAY_LAYOUTS.map((layout) => layout.id),
      recommended: {
        capabilities: [],
      },
    };
  }
}
