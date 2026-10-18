import { artLayers } from "../../svg-import";
import type { LibraryItem, LibrarySource } from "../model";
import type { Chunked } from "./chunks";
import { centeredTarget, emojiArt, emojiMarkup, emojiPalette, localizedNames, svgDataUrl, type EmojiArt, type EmojiIndexEntry } from "./format";

interface ChunkedArtSpec {
  category: string;
  subcategory: string;
  source: LibrarySource;
  share: number;
  ratio: number;
}

export function chunkedArtItem(entry: EmojiIndexEntry, chunks: Chunked<EmojiArt[]>, spec: ChunkedArtSpec): LibraryItem {
  const art = () => chunks.get(entry.k)?.[entry.i];
  return {
    id: entry.id,
    category: spec.category,
    subcategory: spec.subcategory,
    editors: ["image", "video"],
    ratio: spec.ratio,
    label: { text: localizedNames(entry.l) },
    tags: { en: entry.t, pt: entry.p },
    preview: {
      kind: "deferred",
      load: async () => ({ kind: "image", src: svgDataUrl(emojiMarkup((await chunks.load(entry.k))[entry.i])) }),
    },
    source: spec.source,
    palette: () => emojiPalette(art()),
    assets: { loaded: () => art() !== undefined, load: async () => void (await chunks.load(entry.k)) },
    template: {
      kind: "layers",
      build: (ctx) => {
        const loaded = art();
        if (!loaded) throw new Error(`the library drawing ${entry.id} is not loaded`);
        return artLayers(emojiArt(loaded), ctx.canvas, { target: centeredTarget(ctx.canvas, spec.share, loaded.w / loaded.h) });
      },
    },
  };
}
