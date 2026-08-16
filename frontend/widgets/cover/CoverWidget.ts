import type { WidgetInstance } from '../../../lib/widgets/types';
import type { CoverWidgetConfig } from '../../../lib/widgets/cover/types';
import type { CoverWidgetRuntimeState } from '../../../lib/widgets/cover/types';
import {
  coverVisualStateClass,
  formatCoverPositionPercent,
  resolveCoverVisualState,
} from '../../../lib/widgets/cover/visual';
import { createDeviceWidgetIcon } from '../shared/deviceIcon';
import {
  layoutVariantClass,
  placementGridArea,
  type MountedWidget,
  type WidgetRenderContext,
  type WidgetRenderer,
} from '../types';

/**
 * Interactive CoverWidget: tap opens the global control overlay.
 * The tile always paints Homey-confirmed position — never the pending target.
 */
export class CoverWidgetRenderer implements WidgetRenderer<CoverWidgetConfig> {
  public readonly type = 'cover' as const;

  public mount(
    instance: WidgetInstance & { readonly config: CoverWidgetConfig },
    context: WidgetRenderContext,
  ): MountedWidget {
    const element = document.createElement('article');
    element.className = [
      'widget',
      'widget-cover',
      'device-widget',
      layoutVariantClass(instance.placement),
    ].join(' ');
    element.style.gridArea = placementGridArea(instance.placement);
    element.dataset.widgetId = instance.id;
    element.dataset.widgetType = instance.type;
    element.setAttribute('role', 'button');

    const iconEl = createDeviceWidgetIcon({ kind: 'cover' });

    const nameEl = document.createElement('p');
    nameEl.className = 'widget-cover__name device-widget__name';

    const bodyEl = document.createElement('div');
    bodyEl.className = 'widget-cover__body';

    const positionEl = document.createElement('p');
    positionEl.className = 'widget-cover__position device-widget__state';

    const barEl = document.createElement('div');
    barEl.className = 'widget-cover__bar';
    barEl.setAttribute('aria-hidden', 'true');

    const fillEl = document.createElement('div');
    fillEl.className = 'widget-cover__bar-fill';
    barEl.appendChild(fillEl);

    bodyEl.appendChild(positionEl);
    bodyEl.appendChild(barEl);

    element.appendChild(iconEl);
    element.appendChild(nameEl);
    element.appendChild(bodyEl);

    let runtime: CoverWidgetRuntimeState | undefined =
      context.runtime?.type === 'cover' ? context.runtime : undefined;
    let suppressClickUntil = 0;

    const paint = (): void => {
      const visual = resolveCoverVisualState(runtime);
      const interactive = visual === 'available';
      element.className = [
        'widget',
        'widget-cover',
        'device-widget',
        layoutVariantClass(instance.placement),
        coverVisualStateClass(visual),
      ].join(' ');
      element.dataset.visualState = visual;
      element.dataset.interactive = interactive ? 'true' : 'false';
      element.tabIndex = interactive ? 0 : -1;
      element.setAttribute('aria-disabled', interactive ? 'false' : 'true');

      const copy = context.copy.cover;

      if (visual === 'unavailable') {
        nameEl.textContent = runtime?.name || copy.unavailable;
        positionEl.textContent = copy.unavailable;
        fillEl.style.height = '0%';
        barEl.dataset.level = 'unavailable';
        element.setAttribute('aria-label', copy.unavailable);
        return;
      }

      const percent = runtime?.positionPercent ?? null;
      const formatted = formatCoverPositionPercent(percent);
      nameEl.textContent = runtime?.name ?? '';
      positionEl.textContent = formatted ?? copy.invalidPosition;
      const height = percent === null ? 0 : Math.max(0, Math.min(100, percent));
      fillEl.style.height = `${height}%`;
      barEl.dataset.level = String(height);
      element.setAttribute(
        'aria-label',
        `${runtime?.name ?? ''} — ${formatted ?? copy.invalidPosition}. ${copy.openControl}`,
      );
    };

    const openControl = (): void => {
      const visual = resolveCoverVisualState(runtime);
      if (visual !== 'available') {
        return;
      }
      context.interactions?.openCoverControl(instance.id);
    };

    const onPointerUp = (event: PointerEvent): void => {
      if (event.pointerType === 'touch' || event.pointerType === 'pen') {
        suppressClickUntil = Date.now() + 400;
        openControl();
      }
    };

    const onClick = (event: MouseEvent): void => {
      if (Date.now() < suppressClickUntil) {
        event.preventDefault();
        return;
      }
      openControl();
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openControl();
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
        if (state.type !== 'cover') {
          return;
        }
        runtime = state;
        paint();
        context.interactions?.notifyCoverRuntime(instance.id, state);
      },
      destroy() {
        element.removeEventListener('pointerup', onPointerUp);
        element.removeEventListener('click', onClick);
        element.removeEventListener('keydown', onKeyDown);
        context.interactions?.notifyCoverWidgetDestroyed(instance.id);
        element.remove();
      },
    };
  }
}
