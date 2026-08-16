import type { WidgetInstance } from '../../../lib/widgets/types';
import type { LightWidgetConfig } from '../../../lib/widgets/light/types';
import type { LightWidgetRuntimeState } from '../../../lib/widgets/light/types';
import {
  lightVisualStateClass,
  resolveLightVisualState,
} from '../../../lib/widgets/light/visual';
import type { CommandStatus } from '../../realtime/WidgetInteractionController';
import { createDeviceWidgetIcon } from '../shared/deviceIcon';
import {
  layoutVariantClass,
  placementGridArea,
  type MountedWidget,
  type WidgetRenderContext,
  type WidgetRenderer,
} from '../types';

/**
 * Interactive LightWidget: entire tile is the tap target (toggle).
 * Real Homey onoff state is always shown; pending/error are overlays.
 * Decorative bulb icon is visual-only (Milestone 8 device language).
 */
export class LightWidgetRenderer implements WidgetRenderer<LightWidgetConfig> {
  public readonly type = 'light' as const;

  public mount(
    instance: WidgetInstance & { readonly config: LightWidgetConfig },
    context: WidgetRenderContext,
  ): MountedWidget {
    const element = document.createElement('article');
    element.className = [
      'widget',
      'widget-light',
      'device-widget',
      layoutVariantClass(instance.placement),
    ].join(' ');
    element.style.gridArea = placementGridArea(instance.placement);
    element.dataset.widgetId = instance.id;
    element.dataset.widgetType = instance.type;
    element.setAttribute('role', 'button');

    const iconEl = createDeviceWidgetIcon({ kind: 'light' });

    const statusEl = document.createElement('p');
    statusEl.className = 'widget-light__status device-widget__state';

    const footerEl = document.createElement('div');
    footerEl.className = 'widget-light__footer';

    const feedbackEl = document.createElement('p');
    feedbackEl.className = 'widget-light__feedback';
    feedbackEl.hidden = true;

    const nameEl = document.createElement('p');
    nameEl.className = 'widget-light__name device-widget__name';

    const pendingEl = document.createElement('span');
    pendingEl.className = 'widget-light__pending';
    pendingEl.setAttribute('aria-hidden', 'true');
    pendingEl.hidden = true;

    footerEl.appendChild(feedbackEl);
    footerEl.appendChild(nameEl);

    element.appendChild(iconEl);
    element.appendChild(statusEl);
    element.appendChild(footerEl);
    element.appendChild(pendingEl);

    let runtime: LightWidgetRuntimeState | undefined =
      context.runtime?.type === 'light' ? context.runtime : undefined;
    let commandStatus: CommandStatus = 'idle';

    const paint = (): void => {
      const visual = resolveLightVisualState(runtime);
      const interactive = visual === 'on' || visual === 'off';
      const classes = [
        'widget',
        'widget-light',
        'device-widget',
        layoutVariantClass(instance.placement),
        lightVisualStateClass(visual),
      ];

      if (commandStatus === 'pending') {
        classes.push('widget-light--state-pending');
      } else if (commandStatus === 'error' || commandStatus === 'timeout') {
        classes.push('widget-light--state-error');
      }

      element.className = classes.join(' ');
      element.dataset.visualState = visual;
      element.dataset.commandStatus = commandStatus;
      element.dataset.interactive = interactive ? 'true' : 'false';
      element.tabIndex = interactive ? 0 : -1;
      element.setAttribute('aria-disabled', interactive ? 'false' : 'true');

      const copy = context.copy.light;
      if (visual === 'unavailable') {
        nameEl.textContent = runtime?.name || copy.unavailable;
        statusEl.textContent = copy.unavailable;
        element.setAttribute('aria-label', copy.unavailable);
        feedbackEl.hidden = true;
        pendingEl.hidden = true;
        return;
      }

      nameEl.textContent = runtime?.name ?? '';
      statusEl.textContent = visual === 'on' ? copy.on : copy.off;

      if (commandStatus === 'pending') {
        pendingEl.hidden = false;
        feedbackEl.hidden = false;
        feedbackEl.textContent = copy.commandInProgress;
        element.setAttribute(
          'aria-label',
          `${runtime?.name ?? ''} — ${statusEl.textContent}. ${copy.commandInProgress}`,
        );
        return;
      }

      pendingEl.hidden = true;

      if (commandStatus === 'timeout') {
        feedbackEl.hidden = false;
        feedbackEl.textContent = copy.commandTimeout;
        element.setAttribute(
          'aria-label',
          `${runtime?.name ?? ''} — ${statusEl.textContent}. ${copy.commandTimeout}`,
        );
        return;
      }

      if (commandStatus === 'error') {
        feedbackEl.hidden = false;
        feedbackEl.textContent = copy.commandFailed;
        element.setAttribute(
          'aria-label',
          `${runtime?.name ?? ''} — ${statusEl.textContent}. ${copy.commandFailed}`,
        );
        return;
      }

      feedbackEl.hidden = true;
      element.setAttribute(
        'aria-label',
        `${runtime?.name ?? ''} — ${statusEl.textContent}`,
      );
    };

    const unsubscribe = context.interactions?.onStatus(
      instance.id,
      (feedback) => {
        if (feedback.status === 'success') {
          commandStatus = 'idle';
        } else {
          commandStatus = feedback.status;
        }
        paint();
      },
    );

    const tryToggle = (): void => {
      const visual = resolveLightVisualState(runtime);
      if (visual !== 'on' && visual !== 'off') {
        return;
      }
      context.interactions?.requestToggle(instance.id);
    };

    // Prefer pointerup once; ignore synthetic click after touch to avoid double fire.
    let lastPointerUpAt = 0;
    const onPointerUp = (event: Event): void => {
      const pointerEvent = event as PointerEvent;
      if (pointerEvent.button !== undefined && pointerEvent.button !== 0) {
        return;
      }
      lastPointerUpAt = Date.now();
      tryToggle();
    };
    const onClick = (event: Event): void => {
      if (Date.now() - lastPointerUpAt < 400) {
        event.preventDefault();
        return;
      }
      tryToggle();
    };
    const onKeyDown = (event: Event): void => {
      const keyEvent = event as KeyboardEvent;
      if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
        keyEvent.preventDefault();
        tryToggle();
      }
    };

    element.addEventListener('pointerup', onPointerUp);
    element.addEventListener('click', onClick);
    element.addEventListener('keydown', onKeyDown);

    paint();

    return {
      widgetId: instance.id,
      element,
      updateState(state) {
        if (state.type !== 'light') {
          return;
        }
        runtime = state;
        if (commandStatus === 'pending') {
          context.interactions?.notifyStateConfirmed(instance.id);
        }
        paint();
      },
      destroy() {
        unsubscribe?.();
        element.removeEventListener('pointerup', onPointerUp);
        element.removeEventListener('click', onClick);
        element.removeEventListener('keydown', onKeyDown);
        element.remove();
      },
    };
  }
}
