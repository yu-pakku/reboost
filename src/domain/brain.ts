const crystalSlots = [
  [130,72],[167,126],[217,144],[266,111],[294,150],[131,162],
  [100,102],[154,96],[185,89],[211,108],[237,92],[269,82],
  [312,106],[325,124],[314,150],[279,136],[259,154],[239,128],
  [232,163],[200,169],[193,134],[186,152],[161,163],[148,142],
  [114,142],[85,150],[105,167],[119,115],[146,116],[178,107],
  [251,111],[295,93],[222,73],
] as const;

export type CrystalPlacement = { x: number; y: number; scale: number; angle: number; slot: number };

const normalPlacements = crystalSlots.map(([x,y],slot) => ({
  x, y, slot,
  scale: slot < 6 ? 1.08 + (slot % 3) * .08 : .66 + (slot * 3 % 7) * .045,
  angle: (slot * 19) % 25 - 12,
}));

export function crystalPlacement(slot: number, total: number): CrystalPlacement {
  if (total <= normalPlacements.length) return normalPlacements[slot];
  // Fit every crystal in a central area of the ribbons when the collection exceeds the art's full-size slots.
  const columns = Math.ceil(Math.sqrt(total * 3.5));
  const rows = Math.ceil(total / columns);
  const step = Math.min(200 / columns, 60 / rows);
  return {
    x: 203 + (slot % columns - (columns - 1) / 2) * step,
    y: 124 + (Math.floor(slot / columns) - (rows - 1) / 2) * step,
    scale: step / 25,
    angle: (slot * 19) % 25 - 12,
    slot,
  };
}

function tileExtent({ scale, angle }: CrystalPlacement, bearing: number) {
  const relative = bearing - angle * Math.PI / 180;
  return 6.8 * scale * (Math.abs(Math.cos(relative)) + Math.abs(Math.sin(relative)));
}

const clearances = normalPlacements.map(geometry => normalPlacements.filter(other => other !== geometry).map(other => {
  const dx = other.x - geometry.x, dy = other.y - geometry.y;
  const distance = Math.hypot(dx, dy);
  const bearing = Math.atan2(dy, dx);
  const gap = distance - tileExtent(geometry, bearing) - tileExtent(other, bearing);
  return { x: dx / distance, y: dy / distance, room: Math.max(0, gap * .45) };
}));

export function crystalDrift(id: string, slot: number, scale: number) {
  let seed = 2166136261;
  for (const char of id) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  const sample = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const duration = 16 + sample() * 9;
  const phase = -duration * sample();
  const placement = normalPlacements[slot];
  const neighbors = placement?.scale === scale ? clearances[slot] : [];
  const points = Array.from({ length: 5 }, () => {
    const direction = sample() * 2 * Math.PI;
    const radius = 12.8 * scale * (.19 + sample() * .13);
    const x = radius * Math.cos(direction), y = radius * Math.sin(direction);
    let fraction = 1;
    for (const neighbor of neighbors) {
      const toward = x * neighbor.x + y * neighbor.y;
      if (toward > neighbor.room) fraction = Math.min(fraction, neighbor.room / toward);
    }
    // The upper-left crystal rests near the rising edge of the rear ribbon.
    if (slot === 0 && neighbors.length) {
      const towardEdge = -y - x * .45;
      if (towardEdge > .8) fraction = Math.min(fraction, .8 / towardEdge);
    }
    return [(x * fraction).toFixed(3), (y * fraction).toFixed(3)];
  });
  return { duration: duration.toFixed(2), phase: phase.toFixed(2), points };
}
