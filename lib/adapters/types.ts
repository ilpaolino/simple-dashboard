export const ADAPTER_IDS = {
  SHELLY_WALL_DISPLAY: 'shelly_wall_display',
  GENERIC_WEB_DISPLAY: 'generic_web_display',
} as const;

export type AdapterId = (typeof ADAPTER_IDS)[keyof typeof ADAPTER_IDS];

export const LAYOUT_IDS = {
  GRID_2X2: '2x2',
  GRID_3X3: '3x3',
  GRID_2X4: '2x4',
  GRID_4X2: '4x2',
  GRID_3X6: '3x6',
  GRID_6X3: '6x3',
} as const;

export type LayoutId = (typeof LAYOUT_IDS)[keyof typeof LAYOUT_IDS];

export interface LayoutDefinition {
  readonly id: LayoutId;
  readonly columns: number;
  readonly rows: number;
}

/**
 * Layout ids are `{columns}x{rows}`. Non-square grids have both portrait and
 * landscape variants; square grids are orientation-invariant.
 */
export const LAYOUT_DEFINITIONS: Readonly<Record<LayoutId, LayoutDefinition>> = {
  [LAYOUT_IDS.GRID_2X2]: { id: LAYOUT_IDS.GRID_2X2, columns: 2, rows: 2 },
  [LAYOUT_IDS.GRID_3X3]: { id: LAYOUT_IDS.GRID_3X3, columns: 3, rows: 3 },
  [LAYOUT_IDS.GRID_2X4]: { id: LAYOUT_IDS.GRID_2X4, columns: 2, rows: 4 },
  [LAYOUT_IDS.GRID_4X2]: { id: LAYOUT_IDS.GRID_4X2, columns: 4, rows: 2 },
  [LAYOUT_IDS.GRID_3X6]: { id: LAYOUT_IDS.GRID_3X6, columns: 3, rows: 6 },
  [LAYOUT_IDS.GRID_6X3]: { id: LAYOUT_IDS.GRID_6X3, columns: 6, rows: 3 },
};

export const SHELLY_LAYOUT_IDS: readonly LayoutId[] = [
  LAYOUT_IDS.GRID_2X2,
  LAYOUT_IDS.GRID_3X3,
];

export const GENERIC_LAYOUT_IDS: readonly LayoutId[] = [
  LAYOUT_IDS.GRID_2X4,
  LAYOUT_IDS.GRID_4X2,
  LAYOUT_IDS.GRID_3X6,
  LAYOUT_IDS.GRID_6X3,
];

export function canonicalLayoutIdsForAdapter(
  adapterId: AdapterId,
): readonly LayoutId[] {
  if (adapterId === ADAPTER_IDS.SHELLY_WALL_DISPLAY) {
    return SHELLY_LAYOUT_IDS;
  }
  return GENERIC_LAYOUT_IDS;
}

export function layoutDefinitionsFor(
  ids: readonly LayoutId[],
): readonly LayoutDefinition[] {
  return ids.map((id) => LAYOUT_DEFINITIONS[id]);
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
