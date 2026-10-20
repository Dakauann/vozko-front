export function pickRange(
  orderedKeys: readonly string[],
  picked: ReadonlySet<string>,
  anchor: string | null,
  target: string,
): ReadonlySet<string> {
  const from = anchor ? orderedKeys.indexOf(anchor) : -1;
  const to = orderedKeys.indexOf(target);
  const next = new Set(picked);
  if (from < 0 || to < 0) {
    next.add(target);
    return next;
  }
  const [start, end] = from <= to ? [from, to] : [to, from];
  for (const key of orderedKeys.slice(start, end + 1)) next.add(key);
  return next;
}

export function keepListed(picked: ReadonlySet<string>, listedKeys: readonly string[]): ReadonlySet<string> {
  const listed = new Set(listedKeys);
  const kept = [...picked].filter((key) => listed.has(key));
  return kept.length === picked.size ? picked : new Set(kept);
}
