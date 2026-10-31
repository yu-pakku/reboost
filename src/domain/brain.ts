export function particlePosition(id: string) {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  const seed = hash >>> 0;
  const angle = ((seed & 65535) / 65536) * Math.PI * 2;
  const radius = Math.sqrt(((seed >>> 16) & 32767) / 32768);
  const center = seed >>> 31 ? 217 : 103;
  return { x: center + Math.cos(angle) * radius * 51, y: 128 + Math.sin(angle) * radius * 70 };
}
