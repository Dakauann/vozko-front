/** Largest-remainder allocation keeps a waffle at exactly `cells` squares. */
export function allocateWaffle(values: number[], cells = 100): number[] {
  const safe = values.map((value) => Number.isFinite(value) ? Math.max(0, value) : 0);
  const total = safe.reduce((sum, value) => sum + value, 0);
  if (!total) return safe.map(() => 0);
  const quotas = safe.map((value) => value / total * cells);
  const counts = quotas.map(Math.floor);
  const remaining = cells - counts.reduce((sum, value) => sum + value, 0);
  const order = quotas.map((quota, index) => ({ index, remainder: quota - counts[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let i = 0; i < remaining; i++) counts[order[i].index]++;
  return counts;
}

/** Colours stay attached to an entity even when sorting or filtering changes. */
export function entityColorIndex(key: string, count = 5): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (Math.imul(hash, 31) + key.charCodeAt(i)) | 0;
  return (hash >>> 0) % count;
}

export function share(value: number, total: number): number {
  return total > 0 && Number.isFinite(value) && Number.isFinite(total)
    ? Math.max(0, Math.min(100, value / total * 100)) : 0;
}
