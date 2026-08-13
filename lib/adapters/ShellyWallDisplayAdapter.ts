import type { JsonHttpClient } from '../http/JsonHttpClient';
import {
  ADAPTER_IDS,
  LAYOUT_IDS,
  SHELLY_LAYOUT_IDS,
  layoutDefinitionsFor,
  type DetectedDeviceInfo,
  type DeviceConfiguration,
  type LayoutDefinition,
  type WallDisplayAdapter,
} from './types';

const SHELLY_WALL_DISPLAY_LAYOUTS: readonly LayoutDefinition[] =
  layoutDefinitionsFor(SHELLY_LAYOUT_IDS);

interface ShellyDeviceInfo {
  readonly id: string;
  readonly mac?: string;
  readonly model: string;
  readonly ver?: string;
  readonly app: string;
  readonly name?: string;
}

/**
 * Identifies a device using the official Shelly Gen2 RPC API.
 * @see https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Shelly#shellygetdeviceinfo
 */
export class ShellyWallDisplayAdapter implements WallDisplayAdapter {
  public readonly id = ADAPTER_IDS.SHELLY_WALL_DISPLAY;
  public readonly nameKey = 'adapters.shelly_wall_display';
  public readonly canAutoIdentify = true;

  public constructor(private readonly httpClient: JsonHttpClient) {}

  public async tryIdentify(ip: string): Promise<DetectedDeviceInfo | null> {
    try {
      const payload = await this.httpClient.getJson(
        `http://${ip}/rpc/Shelly.GetDeviceInfo`,
      );
      const info = parseShellyDeviceInfo(payload);
      if (!info || !isShellyWallDisplay(info)) {
        return null;
      }

      return toDetectedInfo(info);
    } catch {
      return null;
    }
  }

  public getSupportedLayouts(): readonly LayoutDefinition[] {
    return SHELLY_WALL_DISPLAY_LAYOUTS;
  }

  public createInitialConfiguration(): DeviceConfiguration {
    return {
      version: 1,
      layoutId: LAYOUT_IDS.GRID_2X2,
      supportedLayoutIds: SHELLY_WALL_DISPLAY_LAYOUTS.map((layout) => layout.id),
      recommended: {
        capabilities: [],
      },
    };
  }
}

export function parseShellyDeviceInfo(value: unknown): ShellyDeviceInfo | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== 'string' || candidate.id.trim() === '') {
    return null;
  }

  if (typeof candidate.model !== 'string' || candidate.model.trim() === '') {
    return null;
  }

  if (typeof candidate.app !== 'string') {
    return null;
  }

  const mac = typeof candidate.mac === 'string' ? candidate.mac : undefined;
  const ver = typeof candidate.ver === 'string' ? candidate.ver : undefined;
  const name = typeof candidate.name === 'string' ? candidate.name : undefined;

  return {
    id: candidate.id,
    mac,
    model: candidate.model,
    ver,
    app: candidate.app,
    name,
  };
}

export function isShellyWallDisplay(info: ShellyDeviceInfo): boolean {
  const model = info.model.toUpperCase();
  const app = info.app.toLowerCase().replace(/[\s_-]/g, '');
  const id = info.id.toLowerCase();

  return (
    model.startsWith('SAWD') ||
    app.includes('walldisplay') ||
    id.includes('shellywalldisplay') ||
    id.includes('sawd-')
  );
}

function toDetectedInfo(info: ShellyDeviceInfo): DetectedDeviceInfo {
  return {
    manufacturer: 'Shelly',
    model: info.model,
    firmware: info.ver,
    serial: info.mac ?? info.id,
    uniqueId: info.id,
    name: info.name,
  };
}
