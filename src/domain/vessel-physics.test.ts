import { expect, it } from 'vitest';
import { insideWall, nearestWall, stepVessel, vesselSlots, type MemoryBall } from './vessel-physics';
const wall = [{ x: 40, y: -20 }, { x: 360, y: -20 }, { x: 360, y: 245 }, { x: 40, y: 245 }];
it('0/6/32件の初期配置を底から作り、全ての玉が壁の内側で接触せず収まる', () => {
  for (const count of [0, 6, 32]) {
    const slots = vesselSlots(wall, count, 21);
    expect(slots).toHaveLength(count);
    slots.forEach((p, i) => {
      expect(insideWall(wall, p.x, p.y)).toBe(true);
      expect(nearestWall(wall, p.x, p.y).distance).toBeGreaterThanOrEqual(21);
      slots.slice(i + 1).forEach(q => expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThanOrEqual(42));
    });
  }
});
it('重力・横方向の重力・揺れでも玉を壁内に保持し、重なりを解消する', () => {
  const balls: MemoryBall[] = vesselSlots(wall, 32, 21).map(p => ({ ...p, vx: 100, vy: -180, r: 21 }));
  for (let i = 0; i < 480; i++) stepVessel(wall, balls, 1 / 120, 100, 300);
  balls.forEach((p, i) => {
    expect(insideWall(wall, p.x, p.y)).toBe(true);
    expect(nearestWall(wall, p.x, p.y).distance).toBeGreaterThanOrEqual(20.9);
    balls.slice(i + 1).forEach(q => expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThan(41.8));
  });
});
it('入場する1個だけが上から入り、内部に達した後は容器の壁で保持される', () => {
  const existing: MemoryBall = { x: 160, y: 210, vx: 0, vy: 0, r: 21 };
  const incoming: MemoryBall = { x: 164, y: -34, vx: 2, vy: 0, r: 21, enteringVessel: true };
  const balls = [existing, incoming];
  stepVessel(wall, balls, 1 / 120);
  expect(incoming.y).toBeLessThan(-20);
  for (let i = 0; i < 300; i++) stepVessel(wall, balls, 1 / 120);
  expect(balls).toHaveLength(2);
  expect(incoming.enteringVessel).toBe(false);
  balls.forEach(p => expect(nearestWall(wall, p.x, p.y).distance).toBeGreaterThan(20.9));
  expect(Math.hypot(existing.x - incoming.x, existing.y - incoming.y)).toBeGreaterThan(41.8);
});
