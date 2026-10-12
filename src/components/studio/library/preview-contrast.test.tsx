import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { render, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const recentIds = vi.hoisted(() => ({ current: [] as string[] }));

vi.mock("@/app/actions/studio-library", () => ({ importLibraryAssetAction: vi.fn() }));
vi.mock("./recent-items", () => ({ useRecentItems: () => ({ ids: recentIds.current, remember: () => undefined, clear: () => undefined }) }));

import { TooltipProvider } from "@/components/ui/tooltip";
import ptMessages from "@/i18n/messages/pt.json";
import { supports } from "@/lib/studio/library/catalog";
import { imageContent } from "@/lib/studio/library/instantiate";
import { LIBRARY_EDITORS, type LibraryCategory, type LibraryEditor, type LibraryItem } from "@/lib/studio/library/model";
import { layerColors } from "@/lib/studio/library/placement";
import { loadItems } from "@/lib/studio/library/store";

import { LibraryPanel } from "./library-panel";
import { LIBRARY_CATEGORIES } from "./registry";
import { PREVIEW_PAPER } from "./rendered-preview";

type Rgb = readonly [number, number, number];

interface Theme {
  name: string;
  tokens: ReadonlyMap<string, string>;
}

interface Mark {
  color: Rgb;
  alpha: number;
}

interface Found {
  contrast: number;
  raster: string[];
}

const GLOBALS = resolve(__dirname, "../../../app/globals.css");
const PUBLIC = resolve(__dirname, "../../../../public");
const MIN_CONTRAST = 2;
const MIN_RASTER_BYTES = 1024;
const BLACK: Rgb = [0, 0, 0];
const WHITE: Rgb = [255, 255, 255];
const SVG_NS = "http://www.w3.org/2000/svg";
const DRAWN = "path, rect, circle, ellipse, polygon, polyline, line, text";
const RECENT = ptMessages.studio.library.recent;
const WAIT = { timeout: 10_000 };

function tokensOf(css: string, selector: string): ReadonlyMap<string, string> {
  const block = [...css.matchAll(/(:root|\.dark)\s*\{([^{}]*)\}/g)].find(([, name, body]) => name === selector && body.includes("--card:"));
  if (!block) throw new Error(`globals.css has no ${selector} block with theme tokens`);
  return new Map([...block[2].matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));
}

function themes(): Theme[] {
  const css = readFileSync(GLOBALS, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  return [
    { name: "light", tokens: tokensOf(css, ":root") },
    { name: "dark", tokens: tokensOf(css, ".dark") },
  ];
}

const THEMES = themes();

function hsl(h: number, s: number, l: number): Rgb {
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [channel(0), channel(8), channel(4)];
}

function parseColor(raw: string, theme: Theme, current: Rgb): Rgb | null {
  const value = raw.trim().toLowerCase();
  if (value === "currentcolor") return current;
  if (value === "white") return WHITE;
  if (value === "black") return BLACK;
  const variable = /^var\(--([a-z0-9-]+)(?:,\s*(.+))?\)$/.exec(value);
  if (variable) {
    const known = theme.tokens.get(variable[1]);
    return known !== undefined ? parseColor(known, theme, current) : variable[2] ? parseColor(variable[2], theme, current) : null;
  }
  const wrapped = /^hsla?\((.+)\)$/.exec(value);
  if (wrapped) return parseColor(wrapped[1].replace(/var\(--([a-z0-9-]+)\)/g, (_, name: string) => theme.tokens.get(name) ?? "").split("/")[0], theme, current);
  const triple = /^(-?[\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%$/.exec(value);
  if (triple) return hsl(Number(triple[1]), Number(triple[2]) / 100, Number(triple[3]) / 100);
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})(?:[0-9a-f]{2})?$/.exec(value);
  if (!hex) return null;
  const full = hex[1].length === 3 ? [...hex[1]].map((digit) => digit + digit).join("") : hex[1];
  return [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16)) as unknown as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const linear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

function blend(mark: Mark, under: Rgb): Rgb {
  return mark.color.map((channel, index) => channel * mark.alpha + under[index] * (1 - mark.alpha)) as unknown as Rgb;
}

function classTokens(node: Element, prefix: "text" | "bg", theme: Theme): string | null {
  const names = (node.getAttribute("class") ?? "").split(/\s+/);
  const token = names.map((name) => new RegExp(`^${prefix}-([a-z-]+)$`).exec(name)?.[1]).find((name) => name !== undefined && theme.tokens.has(name));
  return token ?? null;
}

function nearestToken(node: Element, stop: Element, prefix: "text" | "bg", theme: Theme, fallback: string): Rgb {
  for (let at: Element | null = node; at; at = at === stop ? null : at.parentElement) {
    const token = classTokens(at, prefix, theme);
    if (token) return parseColor(theme.tokens.get(token)!, theme, BLACK)!;
  }
  return parseColor(theme.tokens.get(fallback)!, theme, BLACK)!;
}

function readPaint(node: Element, property: "fill" | "stroke"): string | null {
  const names = (node.getAttribute("class") ?? "").split(/\s+/);
  if (names.includes(`${property}-current`)) return "currentColor";
  return node.getAttribute(property) ?? ((node as SVGElement).style?.getPropertyValue(property) || null);
}

function inherited(node: Element, root: Element, read: (at: Element) => string | null): string | null {
  for (let at: Element | null = node; at; at = at === root ? null : at.parentElement) {
    const value = read(at);
    if (value !== null && value !== "") return value;
  }
  return null;
}

function opacityOf(node: Element, root: Element): number {
  let product = 1;
  for (let at: Element | null = node; at; at = at === root ? null : at.parentElement) product *= Number(at.getAttribute("opacity") ?? 1);
  return product;
}

function svgMarks(root: Element, theme: Theme, currentOf: (node: Element) => Rgb): Mark[] {
  return [...root.querySelectorAll(DRAWN)].flatMap((node) => {
    const current = currentOf(node);
    const opacity = opacityOf(node, root);
    const fill = inherited(node, root, (at) => readPaint(at, "fill")) ?? "#000000";
    const stroke = inherited(node, root, (at) => readPaint(at, "stroke"));
    const strokeWidth = Number(inherited(node, root, (at) => at.getAttribute("stroke-width")) ?? 1);
    const fillAlpha = opacity * Number(inherited(node, root, (at) => at.getAttribute("fill-opacity")) ?? 1);
    const strokeAlpha = opacity * Number(inherited(node, root, (at) => at.getAttribute("stroke-opacity")) ?? 1);
    const marks: Mark[] = [];
    const fillColor = fill === "none" ? null : parseColor(fill, theme, current);
    if (fillColor) marks.push({ color: fillColor, alpha: fillAlpha });
    const strokeColor = stroke === null || stroke === "none" || strokeWidth <= 0 ? null : parseColor(stroke, theme, current);
    if (strokeColor) marks.push({ color: strokeColor, alpha: strokeAlpha });
    return marks;
  });
}

function pictureMarks(src: string, theme: Theme): Mark[] {
  const markup = decodeURIComponent(src.slice(src.indexOf(",") + 1));
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  if (doc.documentElement.namespaceURI !== SVG_NS) return [];
  return svgMarks(doc.documentElement, theme, () => BLACK);
}

function backgroundSource(node: HTMLElement): string | null {
  const match = /url\(["']?(.+?)["']?\)$/.exec(node.style.backgroundImage);
  return match ? match[1] : null;
}

function renderedMarks(item: LibraryItem): Mark[] {
  const content = imageContent(item, { canvas: { width: 480, height: 360 }, locale: "pt", text: () => "Aa" });
  return layerColors(content?.layers ?? []).flatMap((color) => {
    const parsed = parseColor(color, THEMES[0], BLACK);
    return parsed ? [{ color: parsed, alpha: 1 }] : [];
  });
}

function bestContrast(marks: readonly Mark[], under: Rgb): number {
  return marks.reduce((best, mark) => Math.max(best, contrast(blend(mark, under), under)), 0);
}

function previewOf(tile: HTMLElement, item: LibraryItem, theme: Theme): Found {
  const under = nearestToken(tile, tile, "bg", theme, "card");
  const raster: string[] = [];
  let best = 0;
  const rendered = tile.querySelector('[data-library-preview="render"]');
  if (rendered) best = Math.max(best, bestContrast(renderedMarks(item), parseColor(PREVIEW_PAPER, theme, BLACK)!));
  for (const svg of tile.querySelectorAll("svg")) best = Math.max(best, bestContrast(svgMarks(svg, theme, (node) => nearestToken(node, tile, "text", theme, "foreground")), under));
  for (const picture of tile.querySelectorAll<HTMLElement>('[data-library-preview="image"]')) {
    const src = backgroundSource(picture);
    if (!src) continue;
    if (src.startsWith("data:image/svg+xml")) best = Math.max(best, bestContrast(pictureMarks(src, theme), under));
    else raster.push(src);
  }
  const resolved = item.preview.kind;
  if (resolved === "text" && (tile.textContent ?? "").trim() !== "") best = Math.max(best, contrast(nearestToken(tile, tile, "text", theme, "foreground"), under));
  return { contrast: best, raster };
}

function expectVisible(found: Found, label: string): void {
  if (found.raster.length > 0) {
    for (const src of found.raster) expect(statSync(resolve(PUBLIC, src.replace(/^\//, ""))).size, `${label}: ${src}`).toBeGreaterThan(MIN_RASTER_BYTES);
    return;
  }
  expect(found.contrast, label).toBeGreaterThanOrEqual(MIN_CONTRAST);
}

class SeenObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds = [];
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

function renderPanel(category: LibraryCategory, editor: LibraryEditor) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <TooltipProvider>
        <LibraryPanel panel={category.panel} adapter={{ editor, insert: () => true }} searchPlaceholder="" />
      </TooltipProvider>
    </NextIntlClientProvider>,
  );
}

function tileIn(container: HTMLElement, id: string, recent: boolean): HTMLElement | null {
  const tiles = [...container.querySelectorAll<HTMLElement>(`[data-library-item="${id}"]`)];
  return tiles.find((tile) => (tile.closest("[role=group]")?.getAttribute("aria-label") === RECENT) === recent) ?? null;
}

async function firstItem(category: LibraryCategory, editor: LibraryEditor): Promise<LibraryItem | null> {
  return (await loadItems(category)).find((item) => supports(item, editor)) ?? null;
}

const CASES = LIBRARY_EDITORS.flatMap((editor) => LIBRARY_CATEGORIES.map((category) => ({ editor, category })));

describe("library preview tiles", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", SeenObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    recentIds.current = [];
  });

  it.each(CASES)("draw the first $category.id item visibly on the tile and under Recentes in the $editor editor, in both themes", { timeout: 20_000 }, async ({ editor, category }) => {
    const item = await firstItem(category, editor);
    if (!item) return;
    recentIds.current = [item.id];
    const { container } = renderPanel(category, editor);
    const tile = await waitFor(() => {
      const found = tileIn(container, item.id, false);
      if (!found) throw new Error(`the ${item.id} tile is not on the panel yet`);
      return found;
    }, WAIT);
    const recent = tileIn(container, item.id, true);
    expect(recent, `${item.id} is listed under Recentes`).not.toBeNull();
    for (const theme of THEMES) {
      await waitFor(() => expectVisible(previewOf(tile, item, theme), `${item.id} on the ${theme.name} ${category.tile} tile`), WAIT);
      await waitFor(() => expectVisible(previewOf(recent!, item, theme), `${item.id} under Recentes in the ${theme.name} theme`), WAIT);
    }
    if (category.tile === "square") expect(recent!.innerHTML).toBe(tile.innerHTML);
  });
});
