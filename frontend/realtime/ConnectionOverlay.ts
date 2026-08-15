import type { DashboardUiCopy } from '../../lib/dashboard/types';

/**
 * Global connection overlay — not a grid cell.
 */
export class ConnectionOverlay {
  private readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly detail: HTMLElement;
  private visible = false;

  public constructor(parent: HTMLElement = document.body) {
    this.root = document.createElement('div');
    this.root.className = 'connection-overlay';
    this.root.hidden = true;
    this.root.setAttribute('role', 'alert');
    this.root.setAttribute('aria-live', 'assertive');

    this.title = document.createElement('p');
    this.title.className = 'connection-overlay__title';

    this.detail = document.createElement('p');
    this.detail.className = 'connection-overlay__detail';

    this.root.appendChild(this.title);
    this.root.appendChild(this.detail);
    parent.appendChild(this.root);
  }

  public show(copy: DashboardUiCopy['realtime']): void {
    this.title.textContent = copy.connectionLost;
    this.detail.textContent = copy.reconnecting;
    this.root.hidden = false;
    this.visible = true;
  }

  public hide(): void {
    this.root.hidden = true;
    this.visible = false;
  }

  public isVisible(): boolean {
    return this.visible;
  }

  public destroy(): void {
    this.root.remove();
  }
}
