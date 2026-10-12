import type { LibraryCategory } from "../model";

export const THREE_D_SUBCATEGORIES = ["icons", "emoji"] as const;

export const THREE_D_CATEGORY: LibraryCategory = {
  id: "threeD",
  panel: "elements",
  label: { key: "studio.library.categories.threeD" },
  tile: "square",
  fixture: "sample",
  generates: "element",
  subcategories: THREE_D_SUBCATEGORIES.map((id) => ({ id, label: { key: `studio.library.subcategories.threeD.${id}` } })),
  items: () => import("../sets/three-d-set").then((module) => module.THREE_D_ITEMS),
};
