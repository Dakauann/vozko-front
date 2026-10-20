export type FocusStep = 1 | -1;

export function moveListFocus(keys: readonly string[], focused: string | null, step: FocusStep): string | null {
  if (keys.length === 0) return null;
  const index = focused === null ? -1 : keys.indexOf(focused);
  if (index === -1) return keys[0];
  const next = Math.min(keys.length - 1, Math.max(0, index + step));
  return keys[next];
}

export function rovingStop(keys: readonly string[], focused: string | null, selected: string | null): string | null {
  if (focused !== null && keys.includes(focused)) return focused;
  if (selected !== null && keys.includes(selected)) return selected;
  return keys[0] ?? null;
}
