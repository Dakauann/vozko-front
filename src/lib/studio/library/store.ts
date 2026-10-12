import type { LibraryCategory, LibraryItem } from "./model";

const loaded = new WeakMap<LibraryCategory, readonly LibraryItem[]>();
const pending = new WeakMap<LibraryCategory, Promise<readonly LibraryItem[]>>();

function isList(value: readonly LibraryItem[] | Promise<readonly LibraryItem[]>): value is readonly LibraryItem[] {
  return Array.isArray(value);
}

export function loadedItems(category: LibraryCategory): readonly LibraryItem[] | undefined {
  const known = loaded.get(category);
  if (known || pending.has(category)) return known;
  const result = category.items();
  if (isList(result)) {
    loaded.set(category, result);
    return result;
  }
  pending.set(
    category,
    result.then(
      (items) => {
        loaded.set(category, items);
        pending.delete(category);
        return items;
      },
      () => {
        pending.delete(category);
        return [];
      },
    ),
  );
  return undefined;
}

export function loadItems(category: LibraryCategory): Promise<readonly LibraryItem[]> {
  const now = loadedItems(category);
  return now ? Promise.resolve(now) : (pending.get(category) ?? Promise.resolve([]));
}

export async function loadAllItems(categories: readonly LibraryCategory[]): Promise<LibraryItem[]> {
  const lists = await Promise.all(categories.map(loadItems));
  return lists.flat();
}

export function itemIndex(items: readonly LibraryItem[]): ReadonlyMap<string, LibraryItem> {
  return new Map(items.map((item) => [item.id, item]));
}
