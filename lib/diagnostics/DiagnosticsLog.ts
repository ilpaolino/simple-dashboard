import type { DiagnosticsRecentError } from '../display/types';

const DEFAULT_CAPACITY = 20;

/**
 * Ring buffer of recent diagnostic events (runtime only).
 */
export class DiagnosticsLog {
  private readonly entries: DiagnosticsRecentError[] = [];

  public constructor(private readonly capacity: number = DEFAULT_CAPACITY) {}

  public record(error: DiagnosticsRecentError): void {
    this.entries.unshift(error);
    if (this.entries.length > this.capacity) {
      this.entries.length = this.capacity;
    }
  }

  public list(): readonly DiagnosticsRecentError[] {
    return [...this.entries];
  }

  public clear(): void {
    this.entries.length = 0;
  }
}
