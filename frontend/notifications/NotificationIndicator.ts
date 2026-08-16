/**
 * Global severity corner-ribbon indicator (dashboard chrome — not a grid cell).
 */

import type { NotificationSeverity } from '../../lib/notifications/types';
import type { NotificationController } from './NotificationController';

export interface NotificationIndicatorCopy {
  readonly openCenter: string;
  readonly severityCritical: string;
  readonly severityWarning: string;
  readonly severitySuccess: string;
  readonly severityInfo: string;
}

export class NotificationIndicator {
  private readonly root: HTMLButtonElement;
  private readonly controller: NotificationController;
  private copy: NotificationIndicatorCopy;
  private readonly unsubscribe: () => void;
  private readonly onClick: () => void;

  public constructor(
    controller: NotificationController,
    copy: NotificationIndicatorCopy,
    parent: HTMLElement = document.body,
  ) {
    this.controller = controller;
    this.copy = copy;

    this.root = document.createElement('button');
    this.root.type = 'button';
    this.root.className = 'notification-indicator';
    this.root.hidden = true;
    this.root.setAttribute('aria-hidden', 'true');

    const ribbon = document.createElement('span');
    ribbon.className = 'notification-indicator__ribbon';
    ribbon.setAttribute('aria-hidden', 'true');
    this.root.appendChild(ribbon);

    parent.appendChild(this.root);

    this.onClick = (): void => {
      this.controller.openCenter(true);
    };
    this.root.addEventListener('click', this.onClick);

    this.unsubscribe = this.controller.subscribe(() => {
      this.render();
    });
    this.render();
  }

  public setCopy(copy: NotificationIndicatorCopy): void {
    this.copy = copy;
    this.render();
  }

  public destroy(): void {
    this.unsubscribe();
    this.root.removeEventListener('click', this.onClick);
    this.root.remove();
  }

  private render(): void {
    const severity = this.controller.getMaxSeverity();
    if (!severity) {
      this.root.hidden = true;
      this.root.setAttribute('aria-hidden', 'true');
      this.root.removeAttribute('data-severity');
      return;
    }

    this.root.hidden = false;
    this.root.setAttribute('aria-hidden', 'false');
    this.root.dataset.severity = severity;
    const severityLabel = this.severityLabel(severity);
    this.root.setAttribute(
      'aria-label',
      `${this.copy.openCenter}. ${severityLabel}`,
    );
    this.root.title = `${this.copy.openCenter} — ${severityLabel}`;
  }

  private severityLabel(severity: NotificationSeverity): string {
    switch (severity) {
      case 'critical':
        return this.copy.severityCritical;
      case 'warning':
        return this.copy.severityWarning;
      case 'success':
        return this.copy.severitySuccess;
      case 'info':
        return this.copy.severityInfo;
      default:
        return severity;
    }
  }
}
