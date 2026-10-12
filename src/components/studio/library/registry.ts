import { STUDIO_ICON_IDS } from "@/components/studio/canvas/icon-catalog";
import { CHARTS_CATEGORY } from "@/lib/studio/library/builtin/charts";
import { COMPONENTS_CATEGORY } from "@/lib/studio/library/builtin/components";
import { QR_CODES_CATEGORY } from "@/lib/studio/library/builtin/qr-codes";
import { TABLES_CATEGORY } from "@/lib/studio/library/builtin/tables";
import { CONTROLS_CATEGORY } from "@/lib/studio/library/builtin/controls";
import { FRAMES_CATEGORY } from "@/lib/studio/library/builtin/frames";
import { GRAPHICS_CATEGORY } from "@/lib/studio/library/builtin/graphics";
import { GRIDS_CATEGORY } from "@/lib/studio/library/builtin/grids";
import { iconsCategory } from "@/lib/studio/library/builtin/icons";
import { MOCKUPS_CATEGORY } from "@/lib/studio/library/builtin/mockups";
import { SHAPES_CATEGORY } from "@/lib/studio/library/builtin/shapes";
import { AUDIO_CATEGORY } from "@/lib/studio/library/builtin/sounds";
import { STICKERS_CATEGORY } from "@/lib/studio/library/builtin/stickers";
import { TEXT_BOX_CATEGORY, TEXT_CATEGORY, TEXT_STYLES_CATEGORY } from "@/lib/studio/library/builtin/text";
import { TEXT_COMBOS_CATEGORY } from "@/lib/studio/library/builtin/text-combos";
import { THREE_D_CATEGORY } from "@/lib/studio/library/builtin/three-d";
import type { LibraryCategory, LibraryItem } from "@/lib/studio/library/model";
import { EMOJI_CATEGORY } from "@/lib/studio/library/sets/emoji-set";
import { itemIndex, loadAllItems } from "@/lib/studio/library/store";

export const LIBRARY_CATEGORIES: readonly LibraryCategory[] = [TEXT_BOX_CATEGORY, TEXT_CATEGORY, TEXT_STYLES_CATEGORY, TEXT_COMBOS_CATEGORY, SHAPES_CATEGORY, GRAPHICS_CATEGORY, iconsCategory(STUDIO_ICON_IDS), EMOJI_CATEGORY, THREE_D_CATEGORY, STICKERS_CATEGORY, FRAMES_CATEGORY, GRIDS_CATEGORY, MOCKUPS_CATEGORY, CHARTS_CATEGORY, TABLES_CATEGORY, COMPONENTS_CATEGORY, QR_CODES_CATEGORY, AUDIO_CATEGORY, CONTROLS_CATEGORY];

export async function libraryItems(): Promise<ReadonlyMap<string, LibraryItem>> {
  return itemIndex(await loadAllItems(LIBRARY_CATEGORIES));
}
