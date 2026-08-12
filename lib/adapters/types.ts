export const ADAPTER_IDS = {
  SHELLY_WALL_DISPLAY: 'shelly_wall_display',
  GENERIC_WEB_DISPLAY: 'generic_web_display',
} as const;

export type AdapterId = (typeof ADAPTER_IDS)[keyof typeof ADAPTER_IDS];

export const LAYOUT_IDS = {
  GRID_2X2: '2x2',
  GRID_3X3: '3x3',
  GRID_2X4: '2x4',
  GRID_3X6: '3x6',
} as const;

export type LayoutId = (typeof LAYOUT_IDS)[keyof typeof LAYOUT_IDS];

export interface LayoutDefinition {
  readonly id: LayoutId;
  readonly columns: number;
  readonly rows: number;
}

export interface DetectedDeviceInfo {
  readonly manufacturer: string;
  readonly model: string;
  readonly firmware?: string;
  readonly serial?: string;
  readonly uniqueId?: string;
  readonly name?: string;
}

/**
 * Adapter-generated starting point. After pairing this object is stored on the
 * Homey device and is no longer derived from the adapter at runtime.
 */
export interface DeviceConfiguration {
  readonly version: 1;
  readonly layoutId: LayoutId;
  readonly supportedLayoutIds: readonly LayoutId[];
  readonly recommended: {
    readonly capabilities: readonly string[];
  };
}

export interface WallDisplayAdapter {
  readonly id: AdapterId;
  readonly nameKey: string;
  readonly canAutoIdentify: boolean;
  tryIdentify(ip: string): Promise<DetectedDeviceInfo | null>;
  getSupportedLayouts(): readonly LayoutDefinition[];
  createInitialConfiguration(): DeviceConfiguration;
}

export type IdentifyResult =
  | {
      readonly kind: 'matched';
      readonly adapter: WallDisplayAdapter;
      readonly info: DetectedDeviceInfo;
    }
  | {
      readonly kind: 'unrecognized';
    };
