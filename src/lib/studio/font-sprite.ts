import { FONT_IDS, type FontId } from "./fonts";

export const FONT_SPRITE = { src: "/images/studio/font-names.png", width: 240, row: 28, size: 18, scale: 2 } as const;

export function fontSpriteOffset(id: FontId): number {
  return FONT_IDS.indexOf(id) * FONT_SPRITE.row;
}
