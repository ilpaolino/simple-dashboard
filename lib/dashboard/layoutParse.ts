import {
  LAYOUT_DEFINITIONS,
  type LayoutId,
} from '../adapters/types';
import type { GridConfig, LayoutResolveResult } from './types';

export function isValidGridConfig(config: GridConfig): boolean {
  return (
    Number.isInteger(config.rows) &&
    Number.isInteger(config.columns) &&
    config.rows > 0 &&
    config.columns > 0
  );
}

/**
 * Resolves a Homey layout id (e.g. "2x4" or "4x2") into a GridConfig.
 * Ids are `{columns}x{rows}`.
 */
export function resolveLayoutId(layoutId: string): LayoutResolveResult {
  if (!isKnownLayoutId(layoutId)) {
    return { ok: false, reason: 'invalid_layout' };
  }

  const definition = LAYOUT_DEFINITIONS[layoutId];
  const config: GridConfig = {
    rows: definition.rows,
    columns: definition.columns,
  };

  if (!isValidGridConfig(config)) {
    return { ok: false, reason: 'invalid_layout' };
  }

  return { ok: true, config };
}

export function formatGridSize(config: GridConfig): string {
  return `${config.columns}x${config.rows}`;
}

function isKnownLayoutId(value: string): value is LayoutId {
  return value in LAYOUT_DEFINITIONS;
}
