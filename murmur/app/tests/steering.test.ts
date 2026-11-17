import { describe, expect, it } from 'vitest';
import { SteeringInput } from '../src/input/steering';

// Node has no window; the steering only needs somewhere to register its listeners.
const noop = { addEventListener() {}, removeEventListener() {} };
(globalThis as unknown as { window: unknown }).window ??= noop;

describe('draw a path', () => {
  it('drops the part of the line that has scrolled off the bottom, so the leader is not pinned there', () => {
    let camY = 0;
    const leader = { x: 6, y: 4 };
    const s = new SteeringInput('draw', noop as unknown as HTMLElement, (x, y) => ({ x, y }), () => leader, () => camY);
    s.path = [
      { x: 2, y: 3 },
      { x: 2, y: 8 },
      { x: 4, y: 14 },
    ];
    expect(s.target()).toEqual({ x: 2, y: 3 });
    // The sky scrolls on: the first two points are now below the visible sky.
    camY = 9;
    leader.y = 13;
    expect(s.target()).toEqual({ x: 4, y: 14 });
    camY = 20;
    expect(s.target()).toBeNull();
  });
});
