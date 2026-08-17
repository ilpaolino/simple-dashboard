/**
 * Semantic notification action validation.
 * actionId is a Flow-chosen identifier — never a Homey capability or device command.
 */

export const NOTIFICATION_ACTION_ID_MAX_LENGTH = 64;
export const NOTIFICATION_ACTION_LABEL_MAX_LENGTH = 64;
export const NOTIFICATION_ACTION_TEXT_MAX_LENGTH = 200;

/**
 * Same character set as notification keys: simple, predictable, Flow-friendly.
 */
const ACTION_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

export interface NotificationAction {
  readonly actionId: string;
  readonly label: string;
  readonly text?: string;
}

export type NotificationActionNormalizeResult =
  | { readonly ok: true; readonly value: NotificationAction }
  | { readonly ok: false; readonly message: string };

function sanitizePlainText(value: string, maxLength: number): string {
  const cleaned = value.replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
    '',
  );
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  return cleaned.slice(0, maxLength);
}

export function normalizeActionId(value: unknown): NotificationActionNormalizeResult {
  if (typeof value !== 'string') {
    return { ok: false, message: 'invalid_action_id' };
  }
  const trimmed = value.trim();
  if (trimmed === '') {
    return { ok: false, message: 'invalid_action_id' };
  }
  if (trimmed.length > NOTIFICATION_ACTION_ID_MAX_LENGTH) {
    return { ok: false, message: 'invalid_action_id' };
  }
  if (!ACTION_ID_PATTERN.test(trimmed)) {
    return { ok: false, message: 'invalid_action_id' };
  }
  return {
    ok: true,
    value: { actionId: trimmed, label: '' },
  };
}

/**
 * Normalize a full action when enabled. Empty optional text is omitted.
 */
export function normalizeNotificationAction(input: {
  readonly actionId: unknown;
  readonly label: unknown;
  readonly text?: unknown;
}): NotificationActionNormalizeResult {
  const idResult = normalizeActionId(input.actionId);
  if (!idResult.ok) {
    return idResult;
  }

  if (typeof input.label !== 'string') {
    return { ok: false, message: 'invalid_action_label' };
  }
  const label = sanitizePlainText(
    input.label.trim(),
    NOTIFICATION_ACTION_LABEL_MAX_LENGTH,
  );
  if (label === '') {
    return { ok: false, message: 'invalid_action_label' };
  }

  let text: string | undefined;
  if (input.text !== undefined && input.text !== null && input.text !== '') {
    if (typeof input.text !== 'string') {
      return { ok: false, message: 'invalid_action_text' };
    }
    const trimmed = sanitizePlainText(
      input.text.trim(),
      NOTIFICATION_ACTION_TEXT_MAX_LENGTH,
    );
    text = trimmed === '' ? undefined : trimmed;
  }

  return {
    ok: true,
    value: {
      actionId: idResult.value.actionId,
      label,
      ...(text !== undefined ? { text } : {}),
    },
  };
}

export function isNotificationAction(
  value: unknown,
): value is NotificationAction {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as {
    readonly actionId?: unknown;
    readonly label?: unknown;
    readonly text?: unknown;
  };
  if (typeof candidate.actionId !== 'string' || candidate.actionId.trim() === '') {
    return false;
  }
  if (typeof candidate.label !== 'string' || candidate.label.trim() === '') {
    return false;
  }
  if (candidate.text !== undefined && typeof candidate.text !== 'string') {
    return false;
  }
  return normalizeNotificationAction({
    actionId: candidate.actionId,
    label: candidate.label,
    text: candidate.text,
  }).ok;
}
