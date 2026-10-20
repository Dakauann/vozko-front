export interface Identified {
  id: string;
}

export function appendById<T extends Identified>(existing: T[], incoming: T[]): T[] {
  const seen = new Set(existing.map((row) => row.id));
  return [...existing, ...incoming.filter((row) => !seen.has(row.id))];
}

export function replaceById<T extends Identified>(rows: T[], next: T): T[] {
  return rows.map((row) => (row.id === next.id ? next : row));
}

export function removeById<T extends Identified>(rows: T[], id: string): T[] {
  return rows.filter((row) => row.id !== id);
}
