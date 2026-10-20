export function appendNew<T>(current: readonly T[], next: readonly T[], idOf: (item: T) => string): T[] {
  const seen = new Set(current.map(idOf));
  return [...current, ...next.filter((item) => !seen.has(idOf(item)))];
}
