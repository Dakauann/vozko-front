import type { LibraryCategory } from "../model";

export const GRAPHICS_SUBCATEGORIES = ["blobs", "waves", "confetti", "sparkles", "doodles", "dotFrames", "brushes", "backgrounds", "ornaments", "dials", "people", "illustrations"] as const;

export type GraphicsSubcategory = (typeof GRAPHICS_SUBCATEGORIES)[number];

export const GRAPHICS_CATEGORY: LibraryCategory = {
  id: "graphics",
  panel: "elements",
  label: { key: "studio.library.categories.graphics" },
  tile: "square",
  fixture: "sample",
  generates: "element",
  subcategories: GRAPHICS_SUBCATEGORIES.map((id) => ({ id, label: { key: `studio.library.subcategories.graphics.${id}` } })),
  items: () => import("../decor/items").then((module) => module.graphicsItems()),
};
