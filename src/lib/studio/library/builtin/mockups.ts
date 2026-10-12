import type { LibraryCategory } from "../model";

export const MOCKUP_SUBCATEGORIES = ["devices", "social"] as const;

export type MockupSubcategory = (typeof MOCKUP_SUBCATEGORIES)[number];

export const MOCKUPS_CATEGORY: LibraryCategory = {
  id: "mockups",
  panel: "elements",
  label: { key: "studio.library.categories.mockups" },
  tile: "square",
  notes: { image: { key: "studio.library.notes.mockupsImage" }, video: { key: "studio.library.notes.mockupsVideo" } },
  subcategories: MOCKUP_SUBCATEGORIES.map((id) => ({ id, label: { key: `studio.library.subcategories.mockups.${id}` } })),
  items: () => import("./mockup-designs").then((module) => module.MOCKUP_ITEMS),
};
