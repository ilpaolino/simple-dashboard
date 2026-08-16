/**
 * Global widget control overlay shell — not a grid cell.
 * Hosts widget-specific panels (CoverControlPanel, LightControlPanel).
 * Only one overlay is active at a time.
 */

export interface WidgetControlOverlayOpenOptions {
  readonly widgetId: string;
  readonly title: string;
  readonly ariaLabel: string;
  readonly closeLabel: string;
  /** Build panel content inside the dialog surface. */
  readonly render: (surface: HTMLElement) => void | (() => void);
}

export class WidgetControlOverlay {
  private readonly root: HTMLElement;
  private readonly backdrop: HTMLElement;
  private readonly dialog: HTMLElement;
  private readonly header: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly body: HTMLElement;
  private readonly onKeyDown: (event: KeyboardEvent) => void;

  private activeWidgetId: string | null = null;
  private panelCleanup: (() => void) | null = null;
  private previouslyFocused: HTMLElement | null = null;

  public constructor(parent: HTMLElement = document.body) {
    this.root = document.createElement('div');
    this.root.className = 'widget-control-overlay';
    this.root.hidden = true;
    this.root.setAttribute('aria-hidden', 'true');

    this.backdrop = document.createElement('div');
    this.backdrop.className = 'widget-control-overlay__backdrop';

    this.dialog = document.createElement('div');
    this.dialog.className = 'widget-control-overlay__dialog';
    this.dialog.setAttribute('role', 'dialog');
    this.dialog.setAttribute('aria-modal', 'true');

    this.header = document.createElement('div');
    this.header.className = 'widget-control-overlay__header';

    this.titleEl = document.createElement('h2');
    this.titleEl.className = 'widget-control-overlay__title';
    this.titleEl.id = 'widget-control-overlay-title';

    this.closeButton = document.createElement('button');
    this.closeButton.type = 'button';
    this.closeButton.className = 'widget-control-overlay__close';
    this.closeButton.setAttribute('aria-label', 'Close');

    this.body = document.createElement('div');
    this.body.className = 'widget-control-overlay__body';

    this.header.appendChild(this.titleEl);
    this.header.appendChild(this.closeButton);
    this.dialog.appendChild(this.header);
    this.dialog.appendChild(this.body);
    this.dialog.setAttribute('aria-labelledby', 'widget-control-overlay-title');

    this.root.appendChild(this.backdrop);
    this.root.appendChild(this.dialog);
    parent.appendChild(this.root);

    this.onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && this.isOpen()) {
        event.preventDefault();
        this.close();
      }
    };

    this.backdrop.addEventListener('pointerdown', (event) => {
      if (event.target === this.backdrop) {
        this.close();
      }
    });
    this.closeButton.addEventListener('click', () => {
      this.close();
    });
  }

  public isOpen(): boolean {
    return this.activeWidgetId !== null;
  }

  public getActiveWidgetId(): string | null {
    return this.activeWidgetId;
  }

  public open(options: WidgetControlOverlayOpenOptions): void {
    if (this.activeWidgetId !== null) {
      this.close();
    }

    this.previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    this.activeWidgetId = options.widgetId;
    this.titleEl.textContent = options.title;
    this.closeButton.setAttribute('aria-label', options.closeLabel);
    this.closeButton.textContent = '×';
    this.dialog.setAttribute('aria-label', options.ariaLabel);

    this.body.replaceChildren();
    const cleanup = options.render(this.body);
    this.panelCleanup = typeof cleanup === 'function' ? cleanup : null;

    // Layout against current viewport at open time (no permanent resize listener).
    const viewportHeight =
      typeof globalThis.window !== 'undefined' ? globalThis.window.innerHeight : 800;
    const viewportWidth =
      typeof globalThis.window !== 'undefined' ? globalThis.window.innerWidth : 480;
    const maxHeight = Math.min(viewportHeight * 0.92, 720);
    const maxWidth = Math.min(viewportWidth * 0.94, 420);
    this.dialog.style.maxHeight = `${Math.round(maxHeight)}px`;
    this.dialog.style.width = `${Math.round(maxWidth)}px`;

    this.root.hidden = false;
    this.root.setAttribute('aria-hidden', 'false');
    document.addEventListener('keydown', this.onKeyDown);
    this.closeButton.focus();
  }

  /**
   * Close only the UI. In-flight Homey commands keep running; tiles keep updating.
   */
  public close(): void {
    if (this.activeWidgetId === null) {
      return;
    }

    this.panelCleanup?.();
    this.panelCleanup = null;
    this.body.replaceChildren();
    this.activeWidgetId = null;
    this.root.hidden = true;
    this.root.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', this.onKeyDown);

    const restore = this.previouslyFocused;
    this.previouslyFocused = null;
    if (restore && document.contains(restore)) {
      restore.focus();
    }
  }

  /**
   * Live config: close when the open widget is removed or rebound.
   */
  public handleWidgetsChanged(widgetIds: ReadonlySet<string>): void {
    if (this.activeWidgetId !== null && !widgetIds.has(this.activeWidgetId)) {
      this.close();
    }
  }

  public destroy(): void {
    this.close();
    this.root.remove();
  }
}
