/**
 * Minimal frontend store for Display notifications.
 * Independent of WidgetRegistry. Dismiss is local; Homey/backend owns lifecycle.
 */

import { maxNotificationSeverity } from '../../lib/notifications/severity';
import {
  indexOfHighestSeverity,
  sortDisplayNotifications,
} from '../../lib/notifications/sort';
import type {
  DisplayNotification,
  NotificationSeverity,
} from '../../lib/notifications/types';

export type NotificationControllerListener = () => void;

export class NotificationController {
  private notifications: DisplayNotification[] = [];
  private currentIndex = 0;
  private centerOpen = false;
  private readonly listeners = new Set<NotificationControllerListener>();

  public subscribe(listener: NotificationControllerListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getNotifications(): readonly DisplayNotification[] {
    return this.notifications;
  }

  public getVisibleCount(): number {
    return this.notifications.length;
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public getCurrent(): DisplayNotification | null {
    if (this.notifications.length === 0) {
      return null;
    }
    return this.notifications[this.currentIndex] ?? null;
  }

  public getMaxSeverity(): NotificationSeverity | null {
    return maxNotificationSeverity(
      this.notifications.map((item) => item.severity),
    );
  }

  public isCenterOpen(): boolean {
    return this.centerOpen;
  }

  /**
   * Full replace from snapshot / reconnect (backend already filtered dismiss).
   */
  public applySnapshot(notifications: readonly DisplayNotification[]): void {
    const previousId = this.getCurrent()?.id ?? null;
    this.notifications = sortDisplayNotifications(notifications);
    this.currentIndex = this.resolveIndexAfterChange(previousId);
    if (this.notifications.length === 0 && this.centerOpen) {
      this.centerOpen = false;
    }
    this.emit();
  }

  public addNotification(notification: DisplayNotification): void {
    const without = this.notifications.filter((item) => item.id !== notification.id);
    without.push(notification);
    this.notifications = sortDisplayNotifications(without);
    this.currentIndex = Math.min(this.currentIndex, this.notifications.length - 1);
    if (this.currentIndex < 0) {
      this.currentIndex = 0;
    }
    this.emit();
  }

  public updateNotification(notification: DisplayNotification): void {
    const index = this.notifications.findIndex((item) => item.id === notification.id);
    if (index < 0) {
      this.addNotification(notification);
      return;
    }
    const previousId = this.getCurrent()?.id ?? null;
    const next = [...this.notifications];
    next[index] = notification;
    this.notifications = sortDisplayNotifications(next);
    this.currentIndex = this.resolveIndexAfterChange(previousId);
    this.emit();
  }

  public removeNotification(notificationId: string): void {
    const previousId = this.getCurrent()?.id ?? null;
    const wasCurrent = previousId === notificationId;
    this.notifications = this.notifications.filter(
      (item) => item.id !== notificationId,
    );

    if (this.notifications.length === 0) {
      this.currentIndex = 0;
      this.centerOpen = false;
      this.emit();
      return;
    }

    if (wasCurrent) {
      this.currentIndex = Math.min(
        this.currentIndex,
        this.notifications.length - 1,
      );
    } else {
      this.currentIndex = this.resolveIndexAfterChange(previousId);
    }
    this.emit();
  }

  /**
   * Optimistic local dismiss. Caller must also send notification-dismiss.
   */
  public dismissLocal(notificationId: string): DisplayNotification | null {
    const target = this.notifications.find((item) => item.id === notificationId);
    if (!target || !target.dismissable) {
      return null;
    }
    this.removeNotification(notificationId);
    return target;
  }

  public openCenter(preferHighestSeverity = true): boolean {
    if (this.notifications.length === 0) {
      return false;
    }
    if (preferHighestSeverity) {
      this.currentIndex = indexOfHighestSeverity(this.notifications);
    } else {
      this.currentIndex = Math.min(
        this.currentIndex,
        this.notifications.length - 1,
      );
    }
    this.centerOpen = true;
    this.emit();
    return true;
  }

  /**
   * Open (or keep open) on a specific notification. Used when Flow Show
   * re-presents an existing key so the Center shows that event, not another.
   */
  public openTo(notificationId: string): boolean {
    const index = this.notifications.findIndex(
      (item) => item.id === notificationId,
    );
    if (index < 0) {
      return this.openCenter(true);
    }
    this.currentIndex = index;
    this.centerOpen = true;
    this.emit();
    return true;
  }

  public closeCenter(): void {
    if (!this.centerOpen) {
      return;
    }
    this.centerOpen = false;
    this.emit();
  }

  /** No loop at boundaries. */
  public goNext(): boolean {
    if (this.currentIndex >= this.notifications.length - 1) {
      return false;
    }
    this.currentIndex += 1;
    this.emit();
    return true;
  }

  public goPrevious(): boolean {
    if (this.currentIndex <= 0) {
      return false;
    }
    this.currentIndex -= 1;
    this.emit();
    return true;
  }

  public canGoNext(): boolean {
    return this.currentIndex < this.notifications.length - 1;
  }

  public canGoPrevious(): boolean {
    return this.currentIndex > 0;
  }

  public destroy(): void {
    this.listeners.clear();
    this.notifications = [];
    this.centerOpen = false;
    this.currentIndex = 0;
  }

  private resolveIndexAfterChange(previousId: string | null): number {
    if (this.notifications.length === 0) {
      return 0;
    }
    if (previousId) {
      const index = this.notifications.findIndex((item) => item.id === previousId);
      if (index >= 0) {
        return index;
      }
    }
    return Math.min(this.currentIndex, this.notifications.length - 1);
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
