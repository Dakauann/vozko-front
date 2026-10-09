const singleUse = () => false;

export function assignColumn<K extends string>(
  columns: readonly K[],
  index: number,
  key: K,
  repeatable: (key: K) => boolean = singleUse,
): K[] {
  if (index < 0 || index >= columns.length) return [...columns];
  const moves = key !== "" && !repeatable(key);
  return columns.map((current, column) => {
    if (column === index) return key;
    return moves && current === key ? ("" as K) : current;
  });
}
