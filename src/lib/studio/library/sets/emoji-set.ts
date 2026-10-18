import type { LibraryCategory, LibraryItem, LibrarySource } from "../model";
import { chunkedArtItem } from "./chunked-art";
import { chunkedData, parsedModule } from "./chunks";
import { EMOJI_CHUNKS, EMOJI_INDEX } from "./data/loaders";
import { EMOJI_GROUPS, type EmojiArt, type EmojiIndexEntry } from "./format";

const EMOJI_SET_SOURCE: LibrarySource = { set: "fluent-emoji", license: "MIT" };

const EMOJI_SHARE = 0.25;

const chunks = chunkedData<EmojiArt[]>(EMOJI_CHUNKS);

function emojiItem(entry: EmojiIndexEntry): LibraryItem {
  return chunkedArtItem(entry, chunks, { category: "emoji", subcategory: EMOJI_GROUPS[entry.g], source: EMOJI_SET_SOURCE, share: EMOJI_SHARE, ratio: 1 });
}

let items: Promise<LibraryItem[]> | null = null;

export function emojiItems(): Promise<LibraryItem[]> {
  items ??= parsedModule<EmojiIndexEntry[]>(EMOJI_INDEX).then((index) => index.map(emojiItem));
  items.catch(() => {
    items = null;
  });
  return items;
}

export const EMOJI_CATEGORY: LibraryCategory = {
  id: "emoji",
  panel: "elements",
  label: { key: "studio.library.categories.emoji" },
  tile: "square",
  fixture: "sample",
  subcategories: EMOJI_GROUPS.map((id) => ({ id, label: { key: `studio.library.subcategories.emoji.${id}` } })),
  items: emojiItems,
};
