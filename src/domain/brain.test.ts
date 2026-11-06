import { expect, it } from 'vitest';
import { crystalDrift, crystalPlacement } from './brain';

it('同じ知識の配置と静かな動きは決定論的で、プレビューの範囲に収まる', () => {
  for (let slot = 0; slot < 33; slot++) {
    const point = crystalPlacement(slot, 33);
    const motion = crystalDrift('knowledge-' + slot, slot, point.scale);
    expect(crystalDrift('knowledge-' + slot, slot, point.scale)).toEqual(motion);
    expect(crystalPlacement(slot, slot + 1)).toEqual(point);
    expect(Number(motion.duration)).toBeGreaterThanOrEqual(16);
    expect(Number(motion.duration)).toBeLessThanOrEqual(25);
    expect(motion.points).toHaveLength(5);
    for (const [x, y] of motion.points) expect(Math.hypot(Number(x), Number(y))).toBeLessThan(12.8 * point.scale * .33);
  }
});

it('枠を超える知識数でも中央の安全な範囲に1件ずつ配置する', () => {
  const positions = Array.from({ length: 1000 }, (_, slot) => crystalPlacement(slot, 1000));
  expect(new Set(positions.map(({ x, y }) => `${x},${y}`)).size).toBe(1000);
  for (const { x, y } of positions) {
    expect(x).toBeGreaterThan(103); expect(x).toBeLessThan(303);
    expect(y).toBeGreaterThan(94); expect(y).toBeLessThan(154);
  }
});
