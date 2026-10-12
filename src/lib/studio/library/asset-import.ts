import type { LibraryAsset, LibraryAssets } from "./model";

export type AssetImporter = (itemId: string, asset: LibraryAsset) => Promise<string>;

let importer: AssetImporter | null = null;
const imported = new Map<string, string>();
const pending = new Map<string, Promise<void>>();

export function setAssetImporter(next: AssetImporter | null): void {
  importer = next;
  imported.clear();
  pending.clear();
}

export function importedMedia(itemId: string): string | undefined {
  return imported.get(itemId);
}

function importAsset(itemId: string, asset: LibraryAsset): Promise<void> {
  if (imported.has(itemId)) return Promise.resolve();
  const waiting = pending.get(itemId);
  if (waiting) return waiting;
  const current = importer;
  if (!current) return Promise.reject(new Error("the library cannot import pictures here"));
  const next = current(itemId, asset).then(
    (mediaId) => {
      if (importer === current) imported.set(itemId, mediaId);
      pending.delete(itemId);
    },
    (error: unknown) => {
      pending.delete(itemId);
      throw error;
    },
  );
  pending.set(itemId, next);
  return next;
}

export function importedAssets(itemId: string, asset: LibraryAsset): LibraryAssets {
  return { loaded: () => imported.has(itemId), load: () => importAsset(itemId, asset) };
}
