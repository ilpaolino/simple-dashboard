import { coverWidgetDefinition } from './cover/definition';
import { dateTimeWidgetDefinition } from './date-time/definition';
import { lightWidgetDefinition } from './light/definition';
import { titleWidgetDefinition } from './title/definition';
import type {
  WidgetDefinition,
  WidgetSpan,
  WidgetTypeId,
} from './types';

/**
 * Central registry of widget type definitions (no DOM / Homey coupling).
 */
export class WidgetRegistry {
  private readonly byType = new Map<
    WidgetTypeId,
    WidgetDefinition<unknown>
  >();

  public register<TConfig>(definition: WidgetDefinition<TConfig>): void {
    if (this.byType.has(definition.type)) {
      throw new Error(`Widget type already registered: ${definition.type}`);
    }
    this.byType.set(
      definition.type,
      definition as WidgetDefinition<unknown>,
    );
  }

  public get(type: string): WidgetDefinition<unknown> | null {
    if (!isWidgetTypeId(type)) {
      return null;
    }
    return this.byType.get(type) ?? null;
  }

  public has(type: string): boolean {
    return this.get(type) !== null;
  }

  public list(): readonly WidgetDefinition<unknown>[] {
    return [...this.byType.values()];
  }

  public allowedSpans(type: string): readonly WidgetSpan[] | null {
    const definition = this.get(type);
    return definition?.allowedSpans ?? null;
  }

  public validateConfig(type: string, config: unknown): boolean {
    const definition = this.get(type);
    if (!definition) {
      return false;
    }
    return definition.validateConfig(config);
  }
}

export function isWidgetTypeId(value: unknown): value is WidgetTypeId {
  return (
    value === 'title' ||
    value === 'date-time' ||
    value === 'light' ||
    value === 'cover'
  );
}

export function createDefaultWidgetRegistry(): WidgetRegistry {
  const registry = new WidgetRegistry();
  registry.register(titleWidgetDefinition);
  registry.register(dateTimeWidgetDefinition);
  registry.register(lightWidgetDefinition);
  registry.register(coverWidgetDefinition);
  return registry;
}
