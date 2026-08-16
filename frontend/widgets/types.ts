import type {
  DashboardTheme,
  WidgetInstance,
  WidgetPlacement,
  WidgetRuntimeState,
  WidgetTypeId,
} from '../../lib/widgets/types';
import { resolveWidgetChrome, spanKey } from '../../lib/widgets/types';
import type { DashboardUiCopy } from '../../lib/dashboard/types';
import type { WidgetInteractionController } from '../realtime/WidgetInteractionController';

export interface WidgetInteractionsApi {
  readonly requestToggle: (widgetId: string) => boolean;
  readonly requestCoverSetPosition: (
    widgetId: string,
    positionPercent: number,
  ) => boolean;
  readonly requestCoverStop: (widgetId: string) => boolean;
  readonly openCoverControl: (widgetId: string) => void;
  readonly notifyCoverRuntime: (
    widgetId: string,
    state: import('../../lib/widgets/cover/types').CoverWidgetRuntimeState,
  ) => void;
  readonly notifyCoverWidgetDestroyed: (widgetId: string) => void;
  readonly onStatus: WidgetInteractionController['onStatus'];
  readonly notifyStateConfirmed: (widgetId: string) => void;
  readonly isPending: (widgetId: string) => boolean;
}

export interface WidgetRenderContext {
  readonly locale: string;
  readonly theme: DashboardTheme;
  readonly now?: Date;
  readonly runtime?: WidgetRuntimeState;
  readonly copy: DashboardUiCopy;
  readonly interactions?: WidgetInteractionsApi;
}

export interface MountedWidget {
  readonly widgetId: string;
  readonly element: HTMLElement;
  updateState?(state: WidgetRuntimeState): void;
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
