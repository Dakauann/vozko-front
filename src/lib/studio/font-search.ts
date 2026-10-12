import { FONT_CATEGORIES, fontsIn, STUDIO_FONTS, type FontCategory, type FontId } from "./fonts";
import { searchText } from "./inspector-layout";

function rank(id: FontId, wanted: string, categoryName: string): number | null {
  const family = searchText(STUDIO_FONTS[id].family);
  if (family.startsWith(wanted)) return 0;
  if (family.split(/\s+/).some((word) => word.startsWith(wanted))) return 1;
  if (family.includes(wanted)) return 2;
  return searchText(categoryName).includes(wanted) ? 3 : null;
}

export function searchFonts(query: string, category: FontCategory | null, categoryLabel: (category: FontCategory) => string): FontId[] {
  const wanted = searchText(query);
  const pool = (category ? [category] : FONT_CATEGORIES).flatMap(fontsIn);
  if (wanted === "") return pool;
  return pool
    .map((id, index) => ({ id, index, score: rank(id, wanted, categoryLabel(STUDIO_FONTS[id].category)) }))
    .filter((ranked): ranked is { id: FontId; index: number; score: number } => ranked.score !== null)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((ranked) => ranked.id);
}
