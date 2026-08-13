import type { WidgetInstance } from '../../../lib/widgets/types';
import type { TitleWidgetConfig } from '../../../lib/widgets/title/types';
import {
  layoutVariantClass,
  placementGridArea,
  widgetChromeClass,
  type MountedWidget,
  type WidgetRenderContext,
  type WidgetRenderer,
} from '../types';

export class TitleWidgetRenderer implements WidgetRenderer<TitleWidgetConfig> {
  public readonly type = 'title' as const;

  public mount(
    instance: WidgetInstance & { readonly config: TitleWidgetConfig },
    _context: WidgetRenderContext,
  ): MountedWidget {
    const element = document.createElement('article');
    element.className = [
      'widget',
      'widget-title',
      layoutVariantClass(instance.placement),
      widgetChromeClass(instance.config),
      `widget-align-${instance.config.alignment}`,
    ].join(' ');
    element.style.gridArea = placementGridArea(instance.placement);
    element.dataset.widgetId = instance.id;
    element.dataset.widgetType = instance.type;
    element.setAttribute('role', 'group');
    element.setAttribute('aria-label', instance.config.text);

    const text = document.createElement('p');
    text.className = 'widget-title__text';
    text.textContent = instance.config.text;
    element.appendChild(text);

    return {
      element,
      destroy() {
        element.remove();
      },
    };
  }
}
