/**
 * Normalize and validate notification payloads for the NotificationManager.
 */

import {
  isNotificationAction,
  normalizeNotificationAction,
  type NotificationAction,
} from './action';
import {
  MAX_NOTIFICATION_DISPLAY_TARGETS,
  NOTIFICATION_AUTO_CLOSE_MAX_SECONDS,
  NOTIFICATION_MESSAGE_MAX_LENGTH,
  NOTIFICATION_TITLE_MAX_LENGTH,
} from './constants';
import { isNotificationIcon } from './icons';
import { isNotificationMedia, type NotificationMedia } from './media';
import { isNotificationSeverity } from './severity';
import type {
  NotificationIcon,
  NotificationSeverity,
  PublishNotificationInput,
  UpdateNotificationInput,
} from './types';

export interface NormalizedPublishInput {
  readonly id: string | undefined;
  readonly title: string | undefined;
  readonly message: string;
  readonly severity: NotificationSeverity;
  readonly icon: NotificationIcon | undefined;
  readonly dismissable: boolean;
  readonly highlight: boolean;
  readonly autoOpen: boolean;
  readonly autoCloseSeconds: number | undefined;
  readonly action: NotificationAction | undefined;
  readonly media: NotificationMedia | undefined;
  readonly mediaDeviceId: string | undefined;
  readonly notificationKey: string | undefined;
  readonly displayIds: readonly string[];
}

export interface NormalizedUpdateInput {
  readonly id: string;
  readonly title: string | null | undefined;
  readonly message: string | undefined;
  readonly severity: NotificationSeverity | undefined;
  readonly icon: NotificationIcon | null | undefined;
  readonly dismissable: boolean | undefined;
  readonly highlight: boolean | undefined;
  readonly autoOpen: boolean | undefined;
  readonly autoCloseSeconds: number | null | undefined;
  readonly action: NotificationAction | null | undefined;
  readonly media: NotificationMedia | null | undefined;
  readonly mediaDeviceId: string | null | undefined;
  readonly notificationKey: string | null | undefined;
  readonly displayIds: readonly string[] | undefined;
}

export type NormalizeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly message: string };

function sanitizeText(value: string, maxLength: number): string {
  // Strip control chars except tab/newline; keep as plain text (never HTML).
  const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  return cleaned.slice(0, maxLength);
}

function normalizeDisplayIds(
  displayIds: readonly string[],
): NormalizeResult<readonly string[]> {
  if (!Array.isArray(displayIds) || displayIds.length === 0) {
    return { ok: false, message: 'displayIds_required' };
  }

  if (displayIds.length > MAX_NOTIFICATION_DISPLAY_TARGETS) {
    return { ok: false, message: 'too_many_displays' };
  }

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of displayIds) {
    if (typeof raw !== 'string') {
      return { ok: false, message: 'invalid_display_id' };
    }
    const id = raw.trim();
    if (id === '') {
      return { ok: false, message: 'invalid_display_id' };
    }
    if (!seen.has(id)) {
      seen.add(id);
      unique.push(id);
    }
  }

  if (unique.length === 0) {
    return { ok: false, message: 'displayIds_required' };
  }

  return { ok: true, value: unique };
}

/**
 * 0 / absent / invalid → disabled (undefined).
 * Values above max are clamped.
 */
export function normalizeAutoCloseSeconds(
  value: unknown,
): NormalizeResult<number | undefined> {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: undefined };
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { ok: false, message: 'invalid_auto_close' };
  }
  const rounded = Math.floor(value);
  if (rounded <= 0) {
    return { ok: true, value: undefined };
  }
  return {
    ok: true,
    value: Math.min(rounded, NOTIFICATION_AUTO_CLOSE_MAX_SECONDS),
  };
}

function normalizeOptionalMedia(
  media: unknown,
): NormalizeResult<NotificationMedia | undefined> {
  if (media === undefined || media === null) {
    return { ok: true, value: undefined };
  }
  if (!isNotificationMedia(media)) {
    return { ok: false, message: 'invalid_media' };
  }
  return { ok: true, value: media };
}

function normalizeOptionalMediaDeviceId(
  value: unknown,
): NormalizeResult<string | undefined> {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: undefined };
  }
  if (typeof value !== 'string') {
    return { ok: false, message: 'invalid_media_device' };
  }
  const trimmed = value.trim();
  if (trimmed === '') {
    return { ok: true, value: undefined };
  }
  return { ok: true, value: trimmed };
}

function normalizeOptionalAction(
  action: unknown,
): NormalizeResult<NotificationAction | undefined> {
  if (action === undefined || action === null) {
    return { ok: true, value: undefined };
  }
  if (!isNotificationAction(action) && typeof action === 'object') {
    const candidate = action as {
      readonly actionId?: unknown;
      readonly label?: unknown;
      readonly text?: unknown;
    };
    return normalizeNotificationAction({
      actionId: candidate.actionId,
      label: candidate.label,
      text: candidate.text,
    });
  }
  if (!isNotificationAction(action)) {
    return { ok: false, message: 'invalid_action' };
  }
  return { ok: true, value: action };
}

export function normalizePublishInput(
  input: PublishNotificationInput,
): NormalizeResult<NormalizedPublishInput> {
  if (typeof input !== 'object' || input === null) {
    return { ok: false, message: 'invalid_input' };
  }

  if (typeof input.message !== 'string') {
    return { ok: false, message: 'message_required' };
  }

  const message = sanitizeText(input.message.trim(), NOTIFICATION_MESSAGE_MAX_LENGTH);
  if (message === '') {
    return { ok: false, message: 'message_required' };
  }

  if (!isNotificationSeverity(input.severity)) {
    return { ok: false, message: 'invalid_severity' };
  }

  let title: string | undefined;
  if (input.title !== undefined) {
    if (typeof input.title !== 'string') {
      return { ok: false, message: 'invalid_title' };
    }
    const trimmed = sanitizeText(input.title.trim(), NOTIFICATION_TITLE_MAX_LENGTH);
    title = trimmed === '' ? undefined : trimmed;
  }

  let icon: NotificationIcon | undefined;
  if (input.icon !== undefined) {
    if (!isNotificationIcon(input.icon)) {
      return { ok: false, message: 'invalid_icon' };
    }
    icon = input.icon;
  }

  let id: string | undefined;
  if (input.id !== undefined) {
    if (typeof input.id !== 'string' || input.id.trim() === '') {
      return { ok: false, message: 'invalid_id' };
    }
    id = input.id.trim();
  }

  const displays = normalizeDisplayIds(input.displayIds);
  if (!displays.ok) {
    return displays;
  }

  const autoClose = normalizeAutoCloseSeconds(input.autoCloseSeconds);
  if (!autoClose.ok) {
    return autoClose;
  }

  const actionResult =
    input.action === null
      ? ({ ok: true, value: undefined } as const)
      : normalizeOptionalAction(input.action);
  if (!actionResult.ok) {
    return actionResult;
  }

  const mediaResult =
    input.media === null
      ? ({ ok: true, value: undefined } as const)
      : normalizeOptionalMedia(input.media);
  if (!mediaResult.ok) {
    return mediaResult;
  }

  const mediaDeviceResult =
    input.mediaDeviceId === null
      ? ({ ok: true, value: undefined } as const)
      : normalizeOptionalMediaDeviceId(input.mediaDeviceId);
  if (!mediaDeviceResult.ok) {
    return mediaDeviceResult;
  }

  let notificationKey: string | undefined;
  if (input.notificationKey !== undefined) {
    if (typeof input.notificationKey !== 'string') {
      return { ok: false, message: 'invalid_key' };
    }
    const trimmed = input.notificationKey.trim();
    notificationKey = trimmed === '' ? undefined : trimmed;
  }

  return {
    ok: true,
    value: {
      id,
      title,
      message,
      severity: input.severity,
      icon,
      dismissable: input.dismissable !== false,
      highlight: input.highlight === true,
      // M11/M11B default: push opened the Center. Preserve unless explicitly false.
      autoOpen: input.autoOpen !== false,
      autoCloseSeconds: autoClose.value,
      action: actionResult.value,
      media: mediaResult.value,
      mediaDeviceId: mediaDeviceResult.value,
      notificationKey,
      displayIds: displays.value,
    },
  };
}

export function normalizeUpdateInput(
  input: UpdateNotificationInput,
): NormalizeResult<NormalizedUpdateInput> {
  if (typeof input !== 'object' || input === null) {
    return { ok: false, message: 'invalid_input' };
  }

  if (typeof input.id !== 'string' || input.id.trim() === '') {
    return { ok: false, message: 'invalid_id' };
  }

  let message: string | undefined;
  if (input.message !== undefined) {
    if (typeof input.message !== 'string') {
      return { ok: false, message: 'invalid_message' };
    }
    const trimmed = sanitizeText(
      input.message.trim(),
      NOTIFICATION_MESSAGE_MAX_LENGTH,
    );
    if (trimmed === '') {
      return { ok: false, message: 'message_required' };
    }
    message = trimmed;
  }

  let title: string | null | undefined;
  if (input.title === null) {
    title = null;
  } else if (input.title !== undefined) {
    if (typeof input.title !== 'string') {
      return { ok: false, message: 'invalid_title' };
    }
    const trimmed = sanitizeText(input.title.trim(), NOTIFICATION_TITLE_MAX_LENGTH);
    title = trimmed === '' ? null : trimmed;
  }

  let severity: NotificationSeverity | undefined;
  if (input.severity !== undefined) {
    if (!isNotificationSeverity(input.severity)) {
      return { ok: false, message: 'invalid_severity' };
    }
    severity = input.severity;
  }

  let icon: NotificationIcon | null | undefined;
  if (input.icon === null) {
    icon = null;
  } else if (input.icon !== undefined) {
    if (!isNotificationIcon(input.icon)) {
      return { ok: false, message: 'invalid_icon' };
    }
    icon = input.icon;
  }

  let displayIds: readonly string[] | undefined;
  if (input.displayIds !== undefined) {
    const displays = normalizeDisplayIds(input.displayIds);
    if (!displays.ok) {
      return displays;
    }
    displayIds = displays.value;
  }

  let dismissable: boolean | undefined;
  if (input.dismissable !== undefined) {
    if (typeof input.dismissable !== 'boolean') {
      return { ok: false, message: 'invalid_dismissable' };
    }
    dismissable = input.dismissable;
  }

  let highlight: boolean | undefined;
  if (input.highlight !== undefined) {
    if (typeof input.highlight !== 'boolean') {
      return { ok: false, message: 'invalid_highlight' };
    }
    highlight = input.highlight;
  }

  let autoOpen: boolean | undefined;
  if (input.autoOpen !== undefined) {
    if (typeof input.autoOpen !== 'boolean') {
      return { ok: false, message: 'invalid_auto_open' };
    }
    autoOpen = input.autoOpen;
  }

  let autoCloseSeconds: number | null | undefined;
  if (input.autoCloseSeconds === null) {
    autoCloseSeconds = null;
  } else if (input.autoCloseSeconds !== undefined) {
    const autoClose = normalizeAutoCloseSeconds(input.autoCloseSeconds);
    if (!autoClose.ok) {
      return autoClose;
    }
    autoCloseSeconds = autoClose.value ?? null;
  }

  let action: NotificationAction | null | undefined;
  if (input.action === null) {
    action = null;
  } else if (input.action !== undefined) {
    const actionResult = normalizeOptionalAction(input.action);
    if (!actionResult.ok) {
      return actionResult;
    }
    action = actionResult.value ?? null;
  }

  let media: NotificationMedia | null | undefined;
  if (input.media === null) {
    media = null;
  } else if (input.media !== undefined) {
    const mediaResult = normalizeOptionalMedia(input.media);
    if (!mediaResult.ok) {
      return mediaResult;
    }
    media = mediaResult.value ?? null;
  }

  let mediaDeviceId: string | null | undefined;
  if (input.mediaDeviceId === null) {
    mediaDeviceId = null;
  } else if (input.mediaDeviceId !== undefined) {
    const mediaDeviceResult = normalizeOptionalMediaDeviceId(
      input.mediaDeviceId,
    );
    if (!mediaDeviceResult.ok) {
      return mediaDeviceResult;
    }
    mediaDeviceId = mediaDeviceResult.value ?? null;
  }

  let notificationKey: string | null | undefined;
  if (input.notificationKey === null) {
    notificationKey = null;
  } else if (input.notificationKey !== undefined) {
    if (typeof input.notificationKey !== 'string') {
      return { ok: false, message: 'invalid_key' };
    }
    const trimmed = input.notificationKey.trim();
    notificationKey = trimmed === '' ? null : trimmed;
  }

  return {
    ok: true,
    value: {
      id: input.id.trim(),
      title,
      message,
      severity,
      icon,
      dismissable,
      highlight,
      autoOpen,
      autoCloseSeconds,
      action,
      media,
      mediaDeviceId,
      notificationKey,
      displayIds,
    },
  };
}
