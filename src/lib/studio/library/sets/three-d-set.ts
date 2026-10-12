import { importedAssets } from "../asset-import";
import type { LibraryAsset, LibraryItem } from "../model";
import { localizedNames } from "./format";
import { THREE_D_INDEX } from "./three-d/index";
import { THREE_D_PUBLIC_DIR, THREE_D_SETS, type ThreeDEntry } from "./three-d-sets";

function threeDItem(entry: ThreeDEntry): LibraryItem {
  const set = THREE_D_SETS[entry.g];
  const asset: LibraryAsset = { path: `${THREE_D_PUBLIC_DIR}/${entry.file}`, sha256: entry.sha256, width: entry.w, height: entry.h, contentType: "image/webp" };
  return {
    id: entry.id,
    category: "threeD",
    subcategory: set.subcategory,
    editors: ["image", "video"],
    ratio: entry.w / entry.h,
    label: { text: localizedNames(entry.l) },
    tags: { en: entry.t, pt: entry.p },
    preview: { kind: "image", src: `/${asset.path}` },
    source: set.source,
    assets: importedAssets(entry.id, asset),
    template: { kind: "asset", asset },
  };
}

export const THREE_D_ITEMS: readonly LibraryItem[] = THREE_D_INDEX.map(threeDItem);
