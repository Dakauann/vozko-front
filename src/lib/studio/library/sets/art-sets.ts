import type { LibrarySource } from "../model";
import type { EmojiIndexEntry } from "./format";

export const ART_SHARE = 0.5;

export interface ArtSet {
  id: string;
  subcategory: "people" | "illustrations";
  source: LibrarySource;
}

export const ART_SETS: readonly ArtSet[] = [
  { id: "open-peeps", subcategory: "people", source: { set: "open-peeps", license: "CC0-1.0", credit: "Pablo Stanley", url: "https://www.openpeeps.com/" } },
  { id: "humaaans", subcategory: "people", source: { set: "humaaans", license: "CC0-1.0", credit: "Pablo Stanley", url: "https://www.humaaans.com/" } },
  { id: "open-doodles", subcategory: "illustrations", source: { set: "open-doodles", license: "CC0-1.0", credit: "Pablo Stanley", url: "https://www.opendoodles.com/" } },
];

export interface ArtIndexEntry extends EmojiIndexEntry {
  r: number;
}
