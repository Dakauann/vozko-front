import type { Settings } from "./types";

export const CURRENT_VERSION = 1;
export const MAX_BLOCKS = 200;

export const DEFAULT_WIDTH = 600;
export const MIN_WIDTH = 480;
export const MAX_WIDTH = 720;

export const MAX_SUBJECT_RUNES = 150;
export const MAX_PREHEADER_RUNES = 200;
export const MAX_HEADING_RUNES = 200;
export const MAX_TEXT_BLOCK_RUNES = 5000;
export const MAX_BUTTON_LABEL_RUNES = 80;
export const MAX_ALT_RUNES = 300;
export const MAX_HREF_RUNES = 2048;
export const MAX_SOCIAL_LABEL_RUNES = 50;
export const MAX_COMPANY_RUNES = 200;
export const MAX_ADDRESS_RUNES = 300;
export const MAX_FOOTER_TEXT_RUNES = 1000;
export const MAX_BLOCK_ID_RUNES = 64;
export const MAX_FALLBACK_RUNES = 100;

export const MIN_IMAGE_WIDTH = 10;
export const MAX_IMAGE_WIDTH = 100;
export const MIN_DIVIDER_THICKNESS = 1;
export const MAX_DIVIDER_THICKNESS = 8;
export const MIN_SPACER_HEIGHT = 4;
export const MAX_SPACER_HEIGHT = 120;

export const FONT_STACKS = [
  { id: "inter", stack: "Inter, Arial, Helvetica, sans-serif" },
  { id: "arial", stack: "Arial, Helvetica, sans-serif" },
  { id: "georgia", stack: "Georgia, 'Times New Roman', Times, serif" },
  { id: "helvetica", stack: "Helvetica, Arial, sans-serif" },
  { id: "verdana", stack: "Verdana, Geneva, sans-serif" },
  { id: "trebuchet", stack: "'Trebuchet MS', Arial, Helvetica, sans-serif" },
] as const;

export type FontFamily = (typeof FONT_STACKS)[number]["id"];

export const FONT_FAMILIES: readonly FontFamily[] = FONT_STACKS.map((font) => font.id);

export const DEFAULT_SETTINGS: Required<Omit<Settings, "preheader">> = {
  width: DEFAULT_WIDTH,
  background_color: "#f4f4f5",
  content_background_color: "#ffffff",
  text_color: "#1f2937",
  link_color: "#2563eb",
  button_color: "#2563eb",
  button_text_color: "#ffffff",
  font_family: "arial",
};

export const DEFAULT_DIVIDER_COLOR = "#e5e7eb";

export function runeCount(value: string): number {
  return Array.from(value).length;
}
