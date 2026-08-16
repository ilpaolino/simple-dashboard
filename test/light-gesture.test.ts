import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PointerGestureRecognizer } from '../frontend/widgets/light/PointerGestureRecognizer';
import { LONG_PRESS_MS } from '../lib/realtime/constants';

class FakeElement {
  public dataset: Record<string, string> = {};
  private listeners = new Map<string, Set<(event: unknown) => void>>();
  private captured: number | null = null;

  public addEventListener(
    type: string,
    listener: (event: unknown) => void,
  ): void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
  }

  public removeEventListener(
    type: string,
    listener: (event: unknown) => void,
  ): void {
    this.listeners.get(type)?.delete(listener);
  }

  public dispatch(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  public setPointerCapture(id: number): void {
    this.captured = id;
  }

  public releasePointerCapture(): void {
    this.captured = null;
  }

  public hasPointerCapture(id: number): boolean {
    return this.captured === id;
  }
}

describe('PointerGestureRecognizer', () => {
  it('fires tap on short press and not long-press', async () => {
    const el = new FakeElement();
    let taps = 0;
    let longPresses = 0;
    const gesture = new PointerGestureRecognizer(
      el as unknown as HTMLElement,
      {
        onTap: () => {
          taps += 1;
        },
        onLongPress: () => {
          longPresses += 1;
        },
      },
      { longPressMs: 80 },
    );

    el.dispatch('pointerdown', {
      button: 0,
      pointerType: 'touch',
      pointerId: 1,
      clientX: 10,
      clientY: 10,
    });
    el.dispatch('pointerup', {
      button: 0,
      pointerType: 'touch',
      pointerId: 1,
      clientX: 10,
      clientY: 10,
    });

    assert.equal(taps, 1);
    assert.equal(longPresses, 0);
    gesture.destroy();
  });

  it('fires long-press without tap when held', async () => {
    const el = new FakeElement();
    let taps = 0;
    let longPresses = 0;
    const gesture = new PointerGestureRecognizer(
      el as unknown as HTMLElement,
      {
        onTap: () => {
          taps += 1;
        },
        onLongPress: () => {
          longPresses += 1;
        },
      },
      { longPressMs: 40 },
    );

    el.dispatch('pointerdown', {
      button: 0,
      pointerType: 'touch',
      pointerId: 2,
      clientX: 10,
      clientY: 10,
    });

    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.equal(longPresses, 1);

    el.dispatch('pointerup', {
      button: 0,
      pointerType: 'touch',
      pointerId: 2,
      clientX: 10,
      clientY: 10,
    });
    assert.equal(taps, 0);
    gesture.destroy();
  });

  it('cancels on excessive movement', async () => {
    const el = new FakeElement();
    let taps = 0;
    let longPresses = 0;
    const gesture = new PointerGestureRecognizer(
      el as unknown as HTMLElement,
      {
        onTap: () => {
          taps += 1;
        },
        onLongPress: () => {
          longPresses += 1;
        },
      },
      { longPressMs: 80, moveTolerancePx: 8 },
    );

    el.dispatch('pointerdown', {
      button: 0,
      pointerType: 'touch',
      pointerId: 3,
      clientX: 10,
      clientY: 10,
    });
    el.dispatch('pointermove', {
      pointerId: 3,
      clientX: 40,
      clientY: 10,
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    el.dispatch('pointerup', {
      button: 0,
      pointerType: 'touch',
      pointerId: 3,
      clientX: 40,
      clientY: 10,
    });

    assert.equal(taps, 0);
    assert.equal(longPresses, 0);
    gesture.destroy();
  });

  it('cancels on pointercancel', async () => {
    const el = new FakeElement();
    let taps = 0;
    let longPresses = 0;
    const gesture = new PointerGestureRecognizer(
      el as unknown as HTMLElement,
      {
        onTap: () => {
          taps += 1;
        },
        onLongPress: () => {
          longPresses += 1;
        },
      },
      { longPressMs: 80 },
    );

    el.dispatch('pointerdown', {
      button: 0,
      pointerType: 'touch',
      pointerId: 4,
      clientX: 10,
      clientY: 10,
    });
    el.dispatch('pointercancel', { pointerId: 4 });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(taps, 0);
    assert.equal(longPresses, 0);
    gesture.destroy();
  });

  it('uses the centralized LONG_PRESS_MS default', () => {
    assert.ok(LONG_PRESS_MS >= 400 && LONG_PRESS_MS <= 800);
  });
});
