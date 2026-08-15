import type { WidgetInstance } from '../../../lib/widgets/types';
import type { LightWidgetConfig } from '../../../lib/widgets/light/types';
import type { LightWidgetRuntimeState } from '../../../lib/widgets/light/types';
import {
  lightVisualStateClass,
  resolveLightVisualState,
} from '../../../lib/widgets/light/visual';
import {
  layoutVariantClass,
  placementGridArea,
  type MountedWidget,
  type WidgetRenderContext,
  type WidgetRenderer,
} from '../types';

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
      layoutVariantClass(instance.placement),
    ].join(' ');
    element.style.gridArea = placementGridArea(instance.placement);
    element.dataset.widgetId = instance.id;
    element.dataset.widgetType = instance.type;
    element.setAttribute('role', 'status');

    const statusEl = document.createElement('p');
    statusEl.className = 'widget-light__status';

    const nameEl = document.createElement('p');
    nameEl.className = 'widget-light__name';

    element.appendChild(statusEl);
    element.appendChild(nameEl);

    const paint = (runtime: LightWidgetRuntimeState | undefined): void => {
      const visual = resolveLightVisualState(runtime);
      element.className = [
        'widget',
        'widget-light',
        layoutVariantClass(instance.placement),
        lightVisualStateClass(visual),
      ].join(' ');
      element.dataset.visualState = visual;

      const copy = context.copy.light;
      if (visual === 'unavailable') {
        nameEl.textContent = runtime?.name || copy.unavailable;
        statusEl.textContent = copy.unavailable;
        element.setAttribute('aria-label', copy.unavailable);
        return;
      }

      nameEl.textContent = runtime?.name ?? '';
      statusEl.textContent = visual === 'on' ? copy.on : copy.off;
      element.setAttribute(
        'aria-label',
        `${runtime?.name ?? ''} — ${statusEl.textContent}`,
      );
    };

    const initial =
      context.runtime?.type === 'light' ? context.runtime : undefined;
    paint(initial);

    return {
      widgetId: instance.id,
      element,
      updateState(state) {
        if (state.type !== 'light') {
          return;
        }
        paint(state);
      },
      destroy() {
        element.remove();
      },
    };
  }
}
