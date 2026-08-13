import { createDefaultWidgetRegistry } from '../../../lib/widgets/registry';
import type { WidgetDefinition, WidgetTypeId } from '../../../lib/widgets/types';
import { DateTimeWidgetRenderer } from '../date-time/DateTimeWidget';
import { TitleWidgetRenderer } from '../title/TitleWidget';
import type { WidgetRenderer } from '../types';

/**
 * Frontend registry: type definitions + DOM renderers.
 * Avoids scattered `if (widget.type === …)` branches in the renderer.
 */
export class FrontendWidgetRegistry {
  private readonly definitions = createDefaultWidgetRegistry();
  private readonly renderers = new Map<WidgetTypeId, WidgetRenderer<unknown>>();

  public constructor() {
    this.registerRenderer(new TitleWidgetRenderer());
    this.registerRenderer(new DateTimeWidgetRenderer());
  }

  public registerRenderer<TConfig>(renderer: WidgetRenderer<TConfig>): void {
    this.renderers.set(
      renderer.type,
      renderer as WidgetRenderer<unknown>,
    );
  }

  public getDefinition(type: string): WidgetDefinition<unknown> | null {
    return this.definitions.get(type);
  }

  public getRenderer(type: string): WidgetRenderer<unknown> | null {
    const definition = this.definitions.get(type);
    if (!definition) {
      return null;
    }
    return this.renderers.get(definition.type) ?? null;
  }

  public listDefinitions(): readonly WidgetDefinition<unknown>[] {
    return this.definitions.list();
  }
}

export function createFrontendWidgetRegistry(): FrontendWidgetRegistry {
  return new FrontendWidgetRegistry();
}
