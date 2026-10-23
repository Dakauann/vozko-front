import { ArrowsDownUp, Buildings, CursorClick, Image, Minus, TextAlignLeft, TextT, type Icon } from "@/components/icons";
import { paragraphText } from "@/lib/email-design/rich-text";
import type { Block, BlockKind } from "@/lib/email-design/types";

import { ColumnsGlyph, ShareNetwork } from "./glyphs";

export const KIND_ICONS: Record<BlockKind, Icon> = {
  heading: TextT,
  text: TextAlignLeft,
  button: CursorClick,
  image: Image,
  divider: Minus,
  spacer: ArrowsDownUp,
  columns: ColumnsGlyph,
  social: ShareNetwork,
  footer: Buildings,
};

export const PALETTE_KINDS: readonly BlockKind[] = ["heading", "text", "button", "image", "divider", "spacer", "columns", "social"];

const SUMMARY_LENGTH = 48;

function clip(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > SUMMARY_LENGTH ? `${flat.slice(0, SUMMARY_LENGTH - 1)}\u2026` : flat;
}

export function blockSummary(block: Block): string {
  switch (block.kind) {
    case "heading":
      return clip(block.heading.text);
    case "text":
      return clip(block.text.paragraphs.map(paragraphText).join(" "));
    case "button":
      return clip(block.button.label);
    case "image":
      return clip(block.image.alt);
    case "footer":
      return clip(block.footer.company_name);
    default:
      return "";
  }
}

export const DRAG_PREFIX = "palette:";
export const COLUMN_DROP_PREFIX = "column:";
export const BLOCK_DROP_PREFIX = "block:";
