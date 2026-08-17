/**
 * Backend source of truth for Display notifications.
 * Runtime only — no Homey Settings / disk persistence.
 * Prepared for Homey Flow cards (publish / update / remove) without UI coupling.
 */

import { randomUUID } from 'node:crypto';
import { MAX_NOTIFICATIONS_PER_DISPLAY } from './constants';
import type { AggregateNotificationSeverity, UpsertDisplayNotificationInput } from './flowTypes';
import {
  normalizeNotificationKey,
  notificationKeyIndexId,
} from './keys';
import type { NotificationMediaBinding } from './media';
import { normalizePublishInput, normalizeUpdateInput } from './normalize';
import { maxNotificationSeverity } from './severity';
import { sortDisplayNotifications } from './sort';
import type {
  DisplayNotification,
  NotificationDiagnosticsSnapshot,
  NotificationDisplayDiagnostic,
  NotificationManagerResult,
  PublishNotificationInput,
  UpdateNotificationInput,
} from './types';

interface StoredNotification {
  readonly notification: DisplayNotification;
  readonly displayIds: ReadonlySet<string>;
  readonly mediaBinding: NotificationMediaBinding | undefined;
}

export type NotificationChangeKind =
  | 'added'
  | 'updated'
  | 'removed'
  | 'dismissed';

export interface NotificationChangeEvent {
  readonly kind: NotificationChangeKind;
  readonly notificationId: string;
  /** Displays that should receive a realtime update for this change. */
  readonly affectedDisplayIds: readonly string[];
  /** Visible payload for add/update (absent on remove). */
  readonly notification: DisplayNotification | null;
}

export interface NotificationManagerOptions {
  readonly onChange?: (event: NotificationChangeEvent) => void;
  readonly now?: () => number;
  readonly createId?: () => string;
  readonly maxPerDisplay?: number;
}

export class NotificationManager {
  private readonly notifications = new Map<string, StoredNotification>();
  /** Runtime dismiss state: displayId → dismissed notification ids. */
  private readonly dismissedByDisplay = new Map<string, Set<string>>();
  /**
   * Flow logical keys: `${displayId}\0${notificationKey}` → notification id.
   * Scope is per Display (same key on two Displays = two entries).
   */
  private readonly keyIndex = new Map<string, string>();
  private readonly onChange: ((event: NotificationChangeEvent) => void) | null;
  private readonly now: () => number;
  private readonly createId: () => string;
  private readonly maxPerDisplay: number;

  private notificationsPublished = 0;
  private notificationsUpdated = 0;
  private notificationsRemoved = 0;
  private notificationsDismissedLocally = 0;
  private notificationMessagesSent = 0;

  public constructor(options: NotificationManagerOptions = {}) {
    this.onChange = options.onChange ?? null;
    this.now = options.now ?? (() => Date.now());
    this.createId = options.createId ?? (() => randomUUID());
    this.maxPerDisplay = options.maxPerDisplay ?? MAX_NOTIFICATIONS_PER_DISPLAY;
  }

  /**
   * Publish a new notification (or replace content when the same id is re-published
   * to a new target set — treat as update of existing id when already present).
   */
  public publishNotification(
    input: PublishNotificationInput,
  ): NotificationManagerResult<DisplayNotification> {
    const normalized = normalizePublishInput(input);
    if (!normalized.ok) {
      return {
        ok: false,
        code:
          normalized.message === 'too_many_displays'
            ? 'too_many_displays'
            : 'invalid_input',
        message: normalized.message,
      };
    }

    const existing = normalized.value.id
      ? this.notifications.get(normalized.value.id)
      : undefined;

    if (existing) {
      // Same id → update path (keeps local dismiss for that id).
      return this.updateNotification({
        id: existing.notification.id,
        title: normalized.value.title ?? null,
        message: normalized.value.message,
        severity: normalized.value.severity,
        icon: normalized.value.icon ?? null,
        dismissable: normalized.value.dismissable,
        highlight: normalized.value.highlight,
        autoOpen: normalized.value.autoOpen,
        autoCloseSeconds: normalized.value.autoCloseSeconds ?? null,
        action: normalized.value.action ?? null,
        media: normalized.value.media ?? null,
        mediaDeviceId: normalized.value.mediaDeviceId ?? null,
        notificationKey: normalized.value.notificationKey ?? null,
        displayIds: normalized.value.displayIds,
      });
    }

    const id = normalized.value.id ?? this.createId();
    const displayIds = new Set(normalized.value.displayIds);

    for (const displayId of displayIds) {
      const visibleCount = this.countActiveForDisplay(displayId);
      if (visibleCount >= this.maxPerDisplay) {
        return {
          ok: false,
          code: 'display_limit',
          message: `display_limit:${displayId}`,
        };
      }
    }

    const notification: DisplayNotification = {
      id,
      title: normalized.value.title,
      message: normalized.value.message,
      severity: normalized.value.severity,
      icon: normalized.value.icon,
      dismissable: normalized.value.dismissable,
      highlight: normalized.value.highlight,
      autoOpen: normalized.value.autoOpen,
      ...(normalized.value.autoCloseSeconds !== undefined
        ? { autoCloseSeconds: normalized.value.autoCloseSeconds }
        : {}),
      ...(normalized.value.action !== undefined
        ? { action: normalized.value.action }
        : {}),
      ...(normalized.value.media !== undefined
        ? { media: normalized.value.media }
        : {}),
      ...(normalized.value.notificationKey !== undefined
        ? { notificationKey: normalized.value.notificationKey }
        : {}),
      publishedAt: this.now(),
    };

    const mediaBinding = normalized.value.mediaDeviceId
      ? { deviceId: normalized.value.mediaDeviceId }
      : undefined;

    this.notifications.set(id, { notification, displayIds, mediaBinding });
    this.notificationsPublished += 1;

    this.emit({
      kind: 'added',
      notificationId: id,
      affectedDisplayIds: [...displayIds],
      notification,
    });

    return { ok: true, value: notification };
  }

  public updateNotification(
    input: UpdateNotificationInput,
  ): NotificationManagerResult<DisplayNotification> {
    const normalized = normalizeUpdateInput(input);
    if (!normalized.ok) {
      return {
        ok: false,
        code:
          normalized.message === 'too_many_displays'
            ? 'too_many_displays'
            : 'invalid_input',
        message: normalized.message,
      };
    }

    const stored = this.notifications.get(normalized.value.id);
    if (!stored) {
      return { ok: false, code: 'not_found', message: 'not_found' };
    }

    let nextDisplayIds = stored.displayIds;
    if (normalized.value.displayIds) {
      const next = new Set(normalized.value.displayIds);
      for (const displayId of next) {
        if (stored.displayIds.has(displayId)) {
          continue;
        }
        if (this.countActiveForDisplay(displayId) >= this.maxPerDisplay) {
          return {
            ok: false,
            code: 'display_limit',
            message: `display_limit:${displayId}`,
          };
        }
      }
      nextDisplayIds = next;
    }

    const prev = stored.notification;
    const nextAutoClose =
      normalized.value.autoCloseSeconds === null
        ? undefined
        : normalized.value.autoCloseSeconds !== undefined
          ? normalized.value.autoCloseSeconds
          : prev.autoCloseSeconds;
    const nextAction =
      normalized.value.action === null
        ? undefined
        : normalized.value.action !== undefined
          ? normalized.value.action
          : prev.action;
    const nextMedia =
      normalized.value.media === null
        ? undefined
        : normalized.value.media !== undefined
          ? normalized.value.media
          : prev.media;
    const nextMediaBinding =
      normalized.value.media === null
        ? undefined
        : normalized.value.mediaDeviceId === null
          ? undefined
          : normalized.value.mediaDeviceId !== undefined
            ? { deviceId: normalized.value.mediaDeviceId }
            : stored.mediaBinding;
    const nextKey =
      normalized.value.notificationKey === null
        ? undefined
        : normalized.value.notificationKey !== undefined
          ? normalized.value.notificationKey
          : prev.notificationKey;

    const nextNotification: DisplayNotification = {
      id: prev.id,
      title:
        normalized.value.title === null
          ? undefined
          : normalized.value.title !== undefined
            ? normalized.value.title
            : prev.title,
      message: normalized.value.message ?? prev.message,
      severity: normalized.value.severity ?? prev.severity,
      icon:
        normalized.value.icon === null
          ? undefined
          : normalized.value.icon !== undefined
            ? normalized.value.icon
            : prev.icon,
      dismissable: normalized.value.dismissable ?? prev.dismissable,
      highlight: normalized.value.highlight ?? prev.highlight,
      autoOpen: normalized.value.autoOpen ?? prev.autoOpen,
      ...(nextAutoClose !== undefined ? { autoCloseSeconds: nextAutoClose } : {}),
      ...(nextAction !== undefined ? { action: nextAction } : {}),
      ...(nextMedia !== undefined ? { media: nextMedia } : {}),
      ...(nextKey !== undefined ? { notificationKey: nextKey } : {}),
      publishedAt: prev.publishedAt,
    };

    const prevDisplays = stored.displayIds;
    this.notifications.set(prev.id, {
      notification: nextNotification,
      displayIds: nextDisplayIds,
      mediaBinding: nextMediaBinding,
    });
    this.notificationsUpdated += 1;

    const affected = new Set<string>([...prevDisplays, ...nextDisplayIds]);
    this.emit({
      kind: 'updated',
      notificationId: prev.id,
      affectedDisplayIds: [...affected],
      notification: nextNotification,
    });

    return { ok: true, value: nextNotification };
  }

  public removeNotification(
    notificationId: string,
  ): NotificationManagerResult<true> {
    if (typeof notificationId !== 'string' || notificationId.trim() === '') {
      return { ok: false, code: 'invalid_input', message: 'invalid_id' };
    }

    const id = notificationId.trim();
    const stored = this.notifications.get(id);
    if (!stored) {
      return { ok: false, code: 'not_found', message: 'not_found' };
    }

    const affected = [...stored.displayIds];
    this.notifications.delete(id);
    this.purgeDismissedId(id);
    this.purgeKeysForNotification(id);
    this.notificationsRemoved += 1;

    this.emit({
      kind: 'removed',
      notificationId: id,
      affectedDisplayIds: affected,
      notification: null,
    });

    return { ok: true, value: true };
  }

  /**
   * Flow upsert for a single Display + notificationKey.
   * Same key on the same Display updates in place (keeps internal id).
   * Clears local dismiss on that Display so Flow "Show" can re-surface.
   */
  public upsertForDisplay(
    input: UpsertDisplayNotificationInput,
  ): NotificationManagerResult<DisplayNotification> & {
    readonly created?: boolean;
  } {
    const keyResult = normalizeNotificationKey(input.notificationKey);
    if (!keyResult.ok) {
      return { ok: false, code: 'invalid_input', message: keyResult.message };
    }

    if (typeof input.displayId !== 'string' || input.displayId.trim() === '') {
      return { ok: false, code: 'invalid_input', message: 'invalid_display_id' };
    }

    const displayId = input.displayId.trim();
    const notificationKey = keyResult.value;
    const indexId = notificationKeyIndexId(displayId, notificationKey);
    const existingId = this.keyIndex.get(indexId);

    if (existingId && this.notifications.has(existingId)) {
      // Flow "Show notification" must re-surface on this Display. A prior local
      // dismiss would otherwise leave the gateway skipping the update push,
      // so the Wall Display stays empty despite an active SoT notification.
      this.clearDismissForDisplay(displayId, existingId);

      const updated = this.updateNotification({
        id: existingId,
        ...(input.title !== undefined
          ? {
              title:
                typeof input.title === 'string' && input.title.trim() === ''
                  ? null
                  : input.title,
            }
          : {}),
        message: input.message,
        severity: input.severity,
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
        dismissable: input.dismissable,
        highlight: input.highlight,
        autoOpen: input.autoOpen,
        autoCloseSeconds: input.autoCloseSeconds ?? null,
        ...(input.action !== undefined ? { action: input.action } : {}),
        ...(input.media !== undefined ? { media: input.media } : {}),
        ...(input.mediaDeviceId !== undefined
          ? { mediaDeviceId: input.mediaDeviceId }
          : {}),
        notificationKey,
        displayIds: [displayId],
      });
      if (!updated.ok) {
        return updated;
      }
      return { ok: true, value: updated.value, created: false };
    }

    const published = this.publishNotification({
      message: input.message,
      title: input.title,
      severity: input.severity,
      icon: input.icon,
      dismissable: input.dismissable,
      highlight: input.highlight,
      autoOpen: input.autoOpen,
      autoCloseSeconds: input.autoCloseSeconds,
      ...(input.action !== undefined && input.action !== null
        ? { action: input.action }
        : {}),
      ...(input.media !== undefined && input.media !== null
        ? { media: input.media }
        : {}),
      ...(input.mediaDeviceId !== undefined && input.mediaDeviceId !== null
        ? { mediaDeviceId: input.mediaDeviceId }
        : {}),
      notificationKey,
      displayIds: [displayId],
    });
    if (!published.ok) {
      return published;
    }

    this.keyIndex.set(indexId, published.value.id);
    return { ok: true, value: published.value, created: true };
  }

  /**
   * Remove by Flow key for one Display. Idempotent when missing.
   */
  public removeByKey(
    displayId: string,
    notificationKey: string,
  ): NotificationManagerResult<{ readonly removed: boolean }> {
    const keyResult = normalizeNotificationKey(notificationKey);
    if (!keyResult.ok) {
      return { ok: false, code: 'invalid_input', message: keyResult.message };
    }
    if (typeof displayId !== 'string' || displayId.trim() === '') {
      return { ok: false, code: 'invalid_input', message: 'invalid_display_id' };
    }

    const indexId = notificationKeyIndexId(
      displayId.trim(),
      keyResult.value,
    );
    const notificationId = this.keyIndex.get(indexId);
    if (!notificationId) {
      return { ok: true, value: { removed: false } };
    }

    this.keyIndex.delete(indexId);
    const stored = this.notifications.get(notificationId);
    if (!stored) {
      return { ok: true, value: { removed: false } };
    }

    // Detach this Display only when the notification also targets others.
    if (stored.displayIds.size > 1 && stored.displayIds.has(displayId.trim())) {
      const next = new Set(stored.displayIds);
      next.delete(displayId.trim());
      this.notifications.set(notificationId, {
        notification: stored.notification,
        displayIds: next,
        mediaBinding: stored.mediaBinding,
      });
      this.dismissedByDisplay.get(displayId.trim())?.delete(notificationId);
      this.notificationsRemoved += 1;
      this.emit({
        kind: 'removed',
        notificationId,
        affectedDisplayIds: [displayId.trim()],
        notification: null,
      });
      return { ok: true, value: { removed: true } };
    }

    const removed = this.removeNotification(notificationId);
    if (!removed.ok && removed.code === 'not_found') {
      return { ok: true, value: { removed: false } };
    }
    if (!removed.ok) {
      return removed;
    }
    return { ok: true, value: { removed: true } };
  }

  /**
   * Remove every active notification that targets this Display.
   * Does not affect other Displays' exclusive notifications.
   */
  public removeAllForDisplay(
    displayId: string,
  ): NotificationManagerResult<{ readonly removedCount: number }> {
    if (typeof displayId !== 'string' || displayId.trim() === '') {
      return { ok: false, code: 'invalid_input', message: 'invalid_display_id' };
    }

    const id = displayId.trim();
    const targets: string[] = [];
    for (const [notificationId, stored] of this.notifications) {
      if (stored.displayIds.has(id)) {
        targets.push(notificationId);
      }
    }

    let removedCount = 0;
    for (const notificationId of targets) {
      const stored = this.notifications.get(notificationId);
      if (!stored) {
        continue;
      }

      this.purgeKeysForNotification(notificationId, id);

      if (stored.displayIds.size > 1) {
        const next = new Set(stored.displayIds);
        next.delete(id);
        this.notifications.set(notificationId, {
          notification: stored.notification,
          displayIds: next,
          mediaBinding: stored.mediaBinding,
        });
        this.dismissedByDisplay.get(id)?.delete(notificationId);
        this.notificationsRemoved += 1;
        this.emit({
          kind: 'removed',
          notificationId,
          affectedDisplayIds: [id],
          notification: null,
        });
        removedCount += 1;
      } else {
        const result = this.removeNotification(notificationId);
        if (result.ok) {
          removedCount += 1;
        }
      }
    }

    this.dismissedByDisplay.delete(id);
    this.purgeKeysForDisplay(id);

    return { ok: true, value: { removedCount } };
  }

  /** Active (SoT) count — ignores local dismiss. */
  public getActiveCountForDisplay(displayId: string): number {
    return this.countActiveForDisplay(displayId);
  }

  /**
   * Highest severity among active (SoT) notifications for a Display.
   * Ignores local dismiss. Returns `none` when empty.
   */
  public getHighestActiveSeverityForDisplay(
    displayId: string,
  ): AggregateNotificationSeverity {
    const severities: DisplayNotification['severity'][] = [];
    for (const stored of this.notifications.values()) {
      if (stored.displayIds.has(displayId)) {
        severities.push(stored.notification.severity);
      }
    }
    return maxNotificationSeverity(severities) ?? 'none';
  }

  public getNotificationIdByKey(
    displayId: string,
    notificationKey: string,
  ): string | null {
    const keyResult = normalizeNotificationKey(notificationKey);
    if (!keyResult.ok) {
      return null;
    }
    return (
      this.keyIndex.get(
        notificationKeyIndexId(displayId.trim(), keyResult.value),
      ) ?? null
    );
  }

  /**
   * Local dismiss for one Display. Does not remove the global notification.
   * Returns false when missing, not targeted, already dismissed, or not dismissable.
   */
  public dismissForDisplay(
    displayId: string,
    notificationId: string,
  ): boolean {
    if (
      typeof displayId !== 'string' ||
      displayId.trim() === '' ||
      typeof notificationId !== 'string' ||
      notificationId.trim() === ''
    ) {
      return false;
    }

    const stored = this.notifications.get(notificationId.trim());
    if (!stored || !stored.displayIds.has(displayId)) {
      return false;
    }

    if (!stored.notification.dismissable) {
      return false;
    }

    let set = this.dismissedByDisplay.get(displayId);
    if (!set) {
      set = new Set();
      this.dismissedByDisplay.set(displayId, set);
    }

    if (set.has(notificationId.trim())) {
      return true;
    }

    set.add(notificationId.trim());
    this.notificationsDismissedLocally += 1;

    this.emit({
      kind: 'dismissed',
      notificationId: notificationId.trim(),
      affectedDisplayIds: [displayId],
      notification: null,
    });

    return true;
  }

  /**
   * Active notifications for a Display after applying local dismiss filters,
   * sorted by severity then publish order.
   */
  public getNotificationsForDisplay(
    displayId: string,
  ): readonly DisplayNotification[] {
    const dismissed = this.dismissedByDisplay.get(displayId);
    const visible: DisplayNotification[] = [];

    for (const stored of this.notifications.values()) {
      if (!stored.displayIds.has(displayId)) {
        continue;
      }
      if (dismissed?.has(stored.notification.id)) {
        continue;
      }
      visible.push(stored.notification);
    }

    return sortDisplayNotifications(visible);
  }

  public getActiveNotification(notificationId: string): DisplayNotification | null {
    return this.notifications.get(notificationId)?.notification ?? null;
  }

  public getMediaBinding(
    notificationId: string,
  ): NotificationMediaBinding | null {
    return this.notifications.get(notificationId)?.mediaBinding ?? null;
  }

  public notificationTargetsDisplay(
    notificationId: string,
    displayId: string,
  ): boolean {
    return (
      this.notifications.get(notificationId)?.displayIds.has(displayId) ===
      true
    );
  }

  /**
   * Resolve authoritative notification for a Display-scoped action press.
   * Returns null when missing, not targeted, without action, or actionId mismatch.
   */
  public resolveNotificationAction(input: {
    readonly displayId: string;
    readonly notificationId: string;
    readonly actionId: string;
    readonly notificationKey?: string;
  }): DisplayNotification | null {
    const displayId = input.displayId.trim();
    const notificationId = input.notificationId.trim();
    const stored = this.notifications.get(notificationId);
    if (!stored || !stored.displayIds.has(displayId)) {
      return null;
    }

    const notification = stored.notification;
    if (!notification.action) {
      return null;
    }
    if (notification.action.actionId !== input.actionId.trim()) {
      return null;
    }

    const authoritativeKey = notification.notificationKey;
    if (authoritativeKey !== undefined) {
      const clientKey =
        typeof input.notificationKey === 'string'
          ? input.notificationKey.trim()
          : '';
      if (clientKey !== authoritativeKey) {
        return null;
      }
    }

    return notification;
  }

  public listActiveNotifications(): readonly DisplayNotification[] {
    return [...this.notifications.values()].map((item) => item.notification);
  }

  public getDisplayIdsForNotification(
    notificationId: string,
  ): readonly string[] {
    const stored = this.notifications.get(notificationId);
    return stored ? [...stored.displayIds] : [];
  }

  public isDismissedOnDisplay(
    displayId: string,
    notificationId: string,
  ): boolean {
    return this.dismissedByDisplay.get(displayId)?.has(notificationId) === true;
  }

  /**
   * Clears local dismiss for one Display + notification id (no-op if absent).
   * Used by Flow upsert so "Show notification" can re-surface after dismiss.
   */
  public clearDismissForDisplay(
    displayId: string,
    notificationId: string,
  ): boolean {
    const set = this.dismissedByDisplay.get(displayId);
    if (!set || !set.has(notificationId)) {
      return false;
    }
    set.delete(notificationId);
    if (set.size === 0) {
      this.dismissedByDisplay.delete(displayId);
    }
    return true;
  }

  /**
   * Drop runtime state for a removed Homey Display.
   */
  public removeDisplay(displayId: string): void {
    this.dismissedByDisplay.delete(displayId);
    this.purgeKeysForDisplay(displayId);

    const toRemove: string[] = [];
    for (const [id, stored] of this.notifications) {
      if (!stored.displayIds.has(displayId)) {
        continue;
      }
      const next = new Set(stored.displayIds);
      next.delete(displayId);
      if (next.size === 0) {
        toRemove.push(id);
      } else {
        this.notifications.set(id, {
          notification: stored.notification,
          displayIds: next,
          mediaBinding: stored.mediaBinding,
        });
      }
    }

    for (const id of toRemove) {
      this.notifications.delete(id);
      this.purgeDismissedId(id);
      this.purgeKeysForNotification(id);
      this.notificationsRemoved += 1;
    }
  }

  /** Clear all runtime state (app restart semantics). */
  public reset(): void {
    this.notifications.clear();
    this.dismissedByDisplay.clear();
    this.keyIndex.clear();
    this.notificationsPublished = 0;
    this.notificationsUpdated = 0;
    this.notificationsRemoved = 0;
    this.notificationsDismissedLocally = 0;
    this.notificationMessagesSent = 0;
  }

  public recordMessageSent(count = 1): void {
    this.notificationMessagesSent += Math.max(0, count);
  }

  public getDiagnostics(): NotificationDiagnosticsSnapshot {
    let criticalCount = 0;
    let warningCount = 0;
    let successCount = 0;
    let infoCount = 0;

    let notificationsWithMedia = 0;
    for (const stored of this.notifications.values()) {
      if (stored.mediaBinding || stored.notification.media) {
        notificationsWithMedia += 1;
      }
      switch (stored.notification.severity) {
        case 'critical':
          criticalCount += 1;
          break;
        case 'warning':
          warningCount += 1;
          break;
        case 'success':
          successCount += 1;
          break;
        case 'info':
          infoCount += 1;
          break;
        default:
          break;
      }
    }

    const displayIds = new Set<string>();
    for (const stored of this.notifications.values()) {
      for (const id of stored.displayIds) {
        displayIds.add(id);
      }
    }
    for (const id of this.dismissedByDisplay.keys()) {
      displayIds.add(id);
    }

    const perDisplay: NotificationDisplayDiagnostic[] = [...displayIds]
      .sort()
      .map((displayId) => this.buildDisplayDiagnostic(displayId));

    let dismissedRuntimeCount = 0;
    for (const set of this.dismissedByDisplay.values()) {
      dismissedRuntimeCount += set.size;
    }

    return {
      activeCount: this.notifications.size,
      notificationsPublished: this.notificationsPublished,
      notificationsUpdated: this.notificationsUpdated,
      notificationsRemoved: this.notificationsRemoved,
      notificationsDismissedLocally: this.notificationsDismissedLocally,
      notificationMessagesSent: this.notificationMessagesSent,
      criticalCount,
      warningCount,
      successCount,
      infoCount,
      dismissedRuntimeCount,
      notificationsWithMedia,
      mediaSessions: [],
      perDisplay,
    };
  }

  private buildDisplayDiagnostic(
    displayId: string,
  ): NotificationDisplayDiagnostic {
    let activeCount = 0;
    let criticalCount = 0;
    let warningCount = 0;
    let successCount = 0;
    let infoCount = 0;

    for (const stored of this.notifications.values()) {
      if (!stored.displayIds.has(displayId)) {
        continue;
      }
      activeCount += 1;
      switch (stored.notification.severity) {
        case 'critical':
          criticalCount += 1;
          break;
        case 'warning':
          warningCount += 1;
          break;
        case 'success':
          successCount += 1;
          break;
        case 'info':
          infoCount += 1;
          break;
        default:
          break;
      }
    }

    const dismissedCount = this.dismissedByDisplay.get(displayId)?.size ?? 0;
    const visible = this.getNotificationsForDisplay(displayId);

    return {
      displayId,
      activeCount,
      visibleCount: visible.length,
      dismissedCount,
      criticalCount,
      warningCount,
      successCount,
      infoCount,
    };
  }

  private countActiveForDisplay(displayId: string): number {
    let count = 0;
    for (const stored of this.notifications.values()) {
      if (stored.displayIds.has(displayId)) {
        count += 1;
      }
    }
    return count;
  }

  private purgeDismissedId(notificationId: string): void {
    for (const [displayId, set] of this.dismissedByDisplay) {
      if (set.delete(notificationId) && set.size === 0) {
        this.dismissedByDisplay.delete(displayId);
      }
    }
  }

  private purgeKeysForNotification(
    notificationId: string,
    onlyDisplayId?: string,
  ): void {
    for (const [indexId, id] of this.keyIndex) {
      if (id !== notificationId) {
        continue;
      }
      if (onlyDisplayId !== undefined) {
        const separator = indexId.indexOf('\u0000');
        const displayId =
          separator >= 0 ? indexId.slice(0, separator) : indexId;
        if (displayId !== onlyDisplayId) {
          continue;
        }
      }
      this.keyIndex.delete(indexId);
    }
  }

  private purgeKeysForDisplay(displayId: string): void {
    const prefix = `${displayId}\u0000`;
    for (const indexId of this.keyIndex.keys()) {
      if (indexId.startsWith(prefix)) {
        this.keyIndex.delete(indexId);
      }
    }
  }

  private emit(event: NotificationChangeEvent): void {
    this.onChange?.(event);
  }
}
