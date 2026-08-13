import type {
  DashboardTheme,
  WidgetInstance,
  WidgetPlacement,
  WidgetTypeId,
} from '../../lib/widgets/types';
import { resolveWidgetChrome, spanKey } from '../../lib/widgets/types';

export interface WidgetRenderContext {
  readonly locale: string;
  readonly theme: DashboardTheme;
  readonly now?: Date;
}

export interface MountedWidget {
  readonly element: HTMLElement;
  destroy(): void;
}

export interface WidgetRenderer<TConfig> {
  readonly type: WidgetTypeId;
  mount(
    instance: WidgetInstance & { readonly config: TConfig },
    context: WidgetRenderContext,
  ): MountedWidget;
}

export function placementGridArea(placement: WidgetPlacement): string {
  // CSS grid lines are 1-based; end is exclusive.
  const rowStart = placement.row + 1;
  const columnStart = placement.column + 1;
  const rowEnd = placement.row + placement.rowSpan + 1;
  const columnEnd = placement.column + placement.columnSpan + 1;
  return `${rowStart} / ${columnStart} / ${rowEnd} / ${columnEnd}`;
}

export function layoutVariantClass(placement: WidgetPlacement): string {
  return `widget-layout-${spanKey({
    rowSpan: placement.rowSpan,
    columnSpan: placement.columnSpan,
  })}`;
}

export function widgetChromeClass(config: { readonly chrome?: unknown }): string {
  return resolveWidgetChrome(config) === 'card' ? 'widget--card' : 'widget--plain';
}
