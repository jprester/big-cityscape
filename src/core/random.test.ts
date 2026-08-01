import { describe, expect, it } from 'vitest';
import { createSeededRandom } from './random';

describe('createSeededRandom', () => {
  it('repeats the same sequence for the same seed', () => {
    const first = createSeededRandom(42);
    const second = createSeededRandom(42);

    expect(Array.from({ length: 8 }, () => first.next())).toEqual(
      Array.from({ length: 8 }, () => second.next()),
    );
  });

  it('keeps a stable reference sequence', () => {
    const random = createSeededRandom(42);

    expect(Array.from({ length: 4 }, () => random.next())).toEqual([
      0.6011037519201636,
      0.44829055899754167,
      0.8524657934904099,
      0.6697340414393693,
    ]);
  });

  it('produces different sequences for different seeds', () => {
    const first = createSeededRandom(1);
    const second = createSeededRandom(2);

    expect(Array.from({ length: 4 }, () => first.next())).not.toEqual(
      Array.from({ length: 4 }, () => second.next()),
    );
  });

  it('honours floating-point and integer bounds', () => {
    const random = createSeededRandom(1234);

    for (let index = 0; index < 100; index += 1) {
      const float = random.float(-5, 12);
      const integer = random.integer(4, 9);

      expect(float).toBeGreaterThanOrEqual(-5);
      expect(float).toBeLessThan(12);
      expect(integer).toBeGreaterThanOrEqual(4);
      expect(integer).toBeLessThan(9);
    }
  });

  it('rejects invalid seeds and ranges', () => {
    expect(() => createSeededRandom(Number.NaN)).toThrow(RangeError);
    expect(() => createSeededRandom(1).float(4, 4)).toThrow(RangeError);
    expect(() => createSeededRandom(1).integer(0.5, 2)).toThrow(RangeError);
  });
});
