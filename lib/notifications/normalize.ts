/**
 * Normalize and validate notification payloads for the NotificationManager.
 */

import {
  MAX_NOTIFICATION_DISPLAY_TARGETS,
  NOTIFICATION_MESSAGE_MAX_LENGTH,
  NOTIFICATION_TITLE_MAX_LENGTH,
} from './constants';
import { isNotificationIcon } from './icons';
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
      displayIds,
    },
  };
}
