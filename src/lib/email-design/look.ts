import { DEFAULT_SETTINGS, FONT_STACKS } from "./limits";
import type { Align, Block, ColumnRatio, Padding, Settings } from "./types";

export type Device = "desktop" | "mobile";

export const MOBILE_VIEWPORT = 375;
export const MOBILE_GUTTER = 16;
export const OUTER_PADDING = 24;
export const DARK_CLIENT_BACKGROUND = "#121212";
export const SOCIAL_SEPARATOR = "\u00a0\u00a0\u00b7\u00a0\u00a0";

export function withDarkBackdrop(html: string): string {
  const style = `<style>html,body,body>table{background-color:${DARK_CLIENT_BACKGROUND} !important;}</style>`;
  return html.includes("</head>") ? html.replace("</head>", `${style}</head>`) : style + html;
}

export interface EmailLook {
  width: number;
  background: string;
  content: string;
  text: string;
  link: string;
  button: string;
  buttonText: string;
  font: string;
  mobile: boolean;
}

export interface Box {
  vertical: number;
  horizontal: number;
}

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isHexColor(value: string | undefined): boolean {
  return value !== undefined && HEX.test(value);
}

export function expandHex(value: string): string {
  const lower = value.toLowerCase();
  if (lower.length !== 4) return lower;
  return `#${lower[1]}${lower[1]}${lower[2]}${lower[2]}${lower[3]}${lower[3]}`;
}

export function colorOr(value: string | undefined, fallback: string): string {
  return value !== undefined && isHexColor(value) ? expandHex(value) : fallback;
}

export function fontStack(id: string | undefined): string {
  return (FONT_STACKS.find((font) => font.id === id) ?? FONT_STACKS.find((font) => font.id === DEFAULT_SETTINGS.font_family))?.stack ?? "Arial, sans-serif";
}

export function emailLook(settings: Settings, device: Device): EmailLook {
  return {
    width: settings.width || DEFAULT_SETTINGS.width,
    background: colorOr(settings.background_color, DEFAULT_SETTINGS.background_color),
    content: colorOr(settings.content_background_color, DEFAULT_SETTINGS.content_background_color),
    text: colorOr(settings.text_color, DEFAULT_SETTINGS.text_color),
    link: colorOr(settings.link_color, DEFAULT_SETTINGS.link_color),
    button: colorOr(settings.button_color, DEFAULT_SETTINGS.button_color),
    buttonText: colorOr(settings.button_text_color, DEFAULT_SETTINGS.button_text_color),
    font: fontStack(settings.font_family),
    mobile: device === "mobile",
  };
}

export function paddingBox(padding: Padding | undefined, insideColumns: boolean, look: EmailLook): Box {
  const chosen = padding ?? (insideColumns ? "s" : "m");
  const box = chosen === "s" ? { vertical: 8, horizontal: 20 } : chosen === "l" ? { vertical: 32, horizontal: 40 } : { vertical: 16, horizontal: 30 };
  return look.mobile && !insideColumns ? { ...box, horizontal: MOBILE_GUTTER } : box;
}

export function rootAvailable(look: EmailLook): number {
  return look.mobile ? MOBILE_VIEWPORT : look.width;
}

const FRACTIONS: Record<ColumnRatio, number[]> = {
  "50-50": [1, 1],
  "33-67": [1, 2],
  "67-33": [2, 1],
  "33-33-33": [1, 1, 1],
};

export function columnWidths(ratio: ColumnRatio, inner: number): number[] {
  const fractions = FRACTIONS[ratio] ?? FRACTIONS["50-50"];
  const total = fractions.reduce((sum, value) => sum + value, 0);
  let used = 0;
  return fractions.map((fraction, index) => {
    if (index === fractions.length - 1) return inner - used;
    const width = Math.floor((inner * fraction) / total);
    used += width;
    return width;
  });
}

export function imageWidth(percent: number, desktopInner: number, inner: number): number {
  return Math.min(inner, Math.floor((desktopInner * percent) / 100));
}

export const HEADING_SIZES: Record<number, { size: number; line: number }> = {
  1: { size: 28, line: 36 },
  2: { size: 22, line: 30 },
  3: { size: 18, line: 26 },
};

export function alignOr(align: Align | undefined, fallback: Align): Align {
  return align ?? fallback;
}

export function blockBackground(block: Block): string | undefined {
  const color = block.background_color;
  return color !== undefined && isHexColor(color) ? expandHex(color) : undefined;
}
