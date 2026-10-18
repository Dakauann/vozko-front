interface Merged<T> {
  value: T;
  conflicts: string[];
}

type Json = unknown;
type Keyed = { id: string } & Record<string, unknown>;

function isRecord(value: Json): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isKeyedList(value: Json): value is Keyed[] {
  return Array.isArray(value) && value.every((item) => isRecord(item) && typeof item.id === "string");
}

function same(a: Json, b: Json): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === (b as Json[]).length && a.every((item, i) => same(item, (b as Json[])[i]));
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) if (!same(left[key], right[key])) return false;
  return true;
}

function join(path: string, key: string): string {
  return path ? `${path}.${key}` : key;
}

function mergeValue(base: Json, mine: Json, theirs: Json, path: string, conflicts: string[]): Json {
  if (same(mine, theirs)) return mine;
  if (same(base, mine)) return theirs;
  if (same(base, theirs)) return mine;
  if (isRecord(base) && isRecord(mine) && isRecord(theirs)) return mergeRecord(base, mine, theirs, path, conflicts);
  if (isKeyedList(base) && isKeyedList(mine) && isKeyedList(theirs)) return mergeList(base, mine, theirs, path, conflicts);
  conflicts.push(path);
  return mine;
}

function mergeRecord(base: Record<string, unknown>, mine: Record<string, unknown>, theirs: Record<string, unknown>, path: string, conflicts: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(mine), ...Object.keys(theirs), ...Object.keys(base)]);
  for (const key of keys) {
    const value = mergeValue(base[key], mine[key], theirs[key], join(path, key), conflicts);
    if (value !== undefined) result[key] = value;
  }
  return result;
}

function byId(items: readonly Keyed[]): Map<string, Keyed> {
  return new Map(items.map((item) => [item.id, item]));
}

function mergeList(base: readonly Keyed[], mine: readonly Keyed[], theirs: readonly Keyed[], path: string, conflicts: string[]): Keyed[] {
  const baseItems = byId(base);
  const mineItems = byId(mine);
  const theirItems = byId(theirs);
  const survives = (id: string): boolean => {
    const original = baseItems.get(id);
    if (!original) return true;
    const kept = mineItems.get(id);
    const theirsKept = theirItems.get(id);
    if (kept && theirsKept) return true;
    if (!kept && !theirsKept) return false;
    const survivor = (kept ?? theirsKept)!;
    if (same(original, survivor)) return false;
    conflicts.push(join(path, id));
    return Boolean(kept);
  };
  const order = [...theirs.map((item) => item.id)];
  mine.forEach((item, index) => {
    if (theirItems.has(item.id)) return;
    const before = mine.slice(0, index).reverse().find((candidate) => order.includes(candidate.id));
    order.splice(before ? order.indexOf(before.id) + 1 : 0, 0, item.id);
  });
  return order.filter(survives).map((id) => {
    const original = baseItems.get(id);
    const kept = mineItems.get(id);
    const theirsKept = theirItems.get(id);
    if (!kept) return theirsKept!;
    if (!theirsKept) return kept;
    return mergeValue(original, kept, theirsKept, join(path, id), conflicts) as Keyed;
  });
}

export function merge3<T>(base: T, mine: T, theirs: T): Merged<T> {
  const conflicts: string[] = [];
  return { value: mergeValue(base, mine, theirs, "", conflicts) as T, conflicts };
}
