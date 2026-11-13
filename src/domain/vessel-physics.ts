/** Display-only physics. Never reads or writes learning data. */
export type Point = { x: number; y: number };
export type MemoryBall = Point & { vx: number; vy: number; r: number };
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export function insideWall(wall: readonly Point[], x: number, y: number) {
  let hit = false;
  for (let i = 0, j = wall.length - 1; i < wall.length; j = i++) {
    const a = wall[i], b = wall[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}
export function nearestWall(wall: readonly Point[], x: number, y: number) {
  let distance = Infinity, point = { x, y };
  for (let i = 0; i < wall.length; i++) {
    const a = wall[i], b = wall[(i + 1) % wall.length], dx = b.x - a.x, dy = b.y - a.y;
    const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    const q = { x: a.x + dx * t, y: a.y + dy * t }, d = Math.hypot(x - q.x, y - q.y);
    if (d < distance) { distance = d; point = q; }
  }
  return { distance, point };
}
export function containBall(wall: readonly Point[], ball: MemoryBall) {
  const { distance, point } = nearestWall(wall, ball.x, ball.y), within = insideWall(wall, ball.x, ball.y);
  if (distance >= ball.r && within) return;
  const sign = within ? 1 : -1;
  const nx = sign * (ball.x - point.x) / (distance || 1), ny = sign * (ball.y - point.y) / (distance || 1);
  ball.x = point.x + nx * (ball.r + .03); ball.y = point.y + ny * (ball.r + .03);
  const speed = ball.vx * nx + ball.vy * ny;
  if (speed < 0) { ball.vx -= 1.22 * speed * nx; ball.vy -= 1.22 * speed * ny; }
  ball.vx *= .94; ball.vy *= .94;
}
export function stepVessel(wall: readonly Point[], balls: MemoryBall[], dt: number, gx = 0, gy = 300) {
  for (const ball of balls) {
    ball.vx = clamp((ball.vx + gx * dt) * .998, -450, 450);
    ball.vy = clamp((ball.vy + gy * dt) * .998, -450, 450);
    ball.x += ball.vx * dt; ball.y += ball.vy * dt;
  }
  for (let pass = 0; pass < (balls.length > 6 ? 16 : 6); pass++) {
    for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i], b = balls[j], dx = b.x - a.x, dy = b.y - a.y;
      const distance = Math.hypot(dx, dy), overlap = a.r + b.r - distance;
      if (overlap <= 0) continue;
      const nx = distance ? dx / distance : 1, ny = distance ? dy / distance : 0;
      a.x -= nx * overlap * .5; a.y -= ny * overlap * .5; b.x += nx * overlap * .5; b.y += ny * overlap * .5;
      const speed = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (speed < 0) { const impulse = -speed * .6; a.vx -= impulse * nx; a.vy -= impulse * ny; b.vx += impulse * nx; b.vy += impulse * ny; }
    }
    balls.forEach(ball => containBall(wall, ball));
  }
}
export function vesselSlots(wall: readonly Point[], count: number, radius: number) {
  const slots: Point[] = [], spacing = radius * 2 + .2;
  // Same 32-ball lattice as the accepted preview; smaller balls allow larger collections.
  for (let row = 0; row < Math.ceil(280 / (spacing * .866)); row++) for (let col = 0; col < Math.ceil(340 / spacing); col++) {
    const x = 50 + col * spacing + (row % 2) * spacing / 2, y = 208 - row * spacing * .866;
    if (insideWall(wall, x, y) && nearestWall(wall, x, y).distance >= radius + .1) slots.push({ x, y });
  }
  return slots.sort((a, b) => b.y - a.y || a.x - b.x).slice(0, count);
}
