import type { LibraryItem } from "../model";
import { ART_CHUNKS, ART_INDEX } from "./art/loaders";
import { ART_SETS, ART_SHARE, type ArtIndexEntry } from "./art-sets";
import { chunkedArtItem } from "./chunked-art";
import { chunkedData, parsedModule } from "./chunks";
import type { EmojiArt } from "./format";

const chunks = chunkedData<EmojiArt[]>(ART_CHUNKS);

let items: Promise<LibraryItem[]> | null = null;

export function artItems(): Promise<LibraryItem[]> {
  items ??= parsedModule<ArtIndexEntry[]>(ART_INDEX).then((index) =>
    index.map((entry) => {
      const set = ART_SETS[entry.g];
      return chunkedArtItem(entry, chunks, { category: "graphics", subcategory: set.subcategory, source: set.source, share: ART_SHARE, ratio: entry.r });
    }),
  );
  items.catch(() => {
    items = null;
  });
  return items;
}
