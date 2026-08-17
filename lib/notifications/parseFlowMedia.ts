/**
 * Parse Flow autocomplete / device argument for optional camera media.
 */

export interface FlowMediaArgument {
  readonly deviceId: string;
  readonly name?: string;
}

export type ParseFlowMediaResult =
  | { readonly ok: true; readonly value: FlowMediaArgument | null }
  | { readonly ok: false; readonly message: string };

/**
 * Homey autocomplete returns `{ id, name }`. Optional `required: false`
 * yields `undefined` on saved Flows that never set the argument.
 */
export function parseFlowMediaArgument(value: unknown): ParseFlowMediaResult {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: null };
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return { ok: true, value: null };
    }
    return { ok: true, value: { deviceId: trimmed } };
  }

  if (typeof value !== 'object') {
    return { ok: false, message: 'invalid_media_device' };
  }

  const candidate = value as {
    readonly id?: unknown;
    readonly name?: unknown;
  };
  if (typeof candidate.id !== 'string' || candidate.id.trim() === '') {
    return { ok: false, message: 'invalid_media_device' };
  }

  const name =
    typeof candidate.name === 'string' && candidate.name.trim() !== ''
      ? candidate.name.trim()
      : undefined;

  return {
    ok: true,
    value: {
      deviceId: candidate.id.trim(),
      ...(name !== undefined ? { name } : {}),
    },
  };
}
