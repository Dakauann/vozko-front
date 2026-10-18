import type { CanvasSize, Clip, Layer, StudioGroup } from "../document";
import type { FrameShape } from "./frame-shapes";
import type { GridNode } from "./grid-layout";
import type { MockupDesign } from "./mockup";

export const LIBRARY_LOCALES = ["pt", "en", "es", "de"] as const;

export type LibraryLocale = (typeof LIBRARY_LOCALES)[number];

export const LIBRARY_EDITORS = ["image", "video"] as const;

export type LibraryEditor = (typeof LIBRARY_EDITORS)[number];

export const LIBRARY_PANELS = ["text", "elements"] as const;

export type LibraryPanelId = (typeof LIBRARY_PANELS)[number];

export const LIBRARY_INK: Readonly<Record<LibraryEditor, string>> = { image: "#111111", video: "#ffffff" };

export const LIBRARY_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type LocalizedText = Readonly<Record<LibraryLocale, string>>;

export function localizedText(pt: string, en: string, es: string, de: string): LocalizedText {
  return { pt, en, es, de };
}

export type LibraryLabel = { readonly key: string } | { readonly text: LocalizedText };

export interface LibrarySlot {
  id: string;
  sample: LibraryLabel;
}

export interface LibraryContext {
  editor: LibraryEditor;
  canvas: CanvasSize;
  ink: string;
  locale: string;
  text: (slot: LibrarySlot) => string;
}

interface LibraryClipContext extends LibraryContext {
  atMs: number;
  documentMs: number;
}

export interface LibraryStickerContext extends LibraryClipContext {
  durationMs: number;
}

export interface LibraryLayers {
  layers: Layer[];
  groups?: StudioGroup[];
}

export type LibraryTemplate =
  | { kind: "layers"; slots?: readonly LibrarySlot[]; build: (ctx: LibraryContext) => LibraryLayers }
  | { kind: "clips"; slots?: readonly LibrarySlot[]; build: (ctx: LibraryClipContext) => Clip[] }
  | { kind: "frame"; slots?: readonly LibrarySlot[]; shape: FrameShape }
  | { kind: "grid"; slots?: readonly LibrarySlot[]; root: GridNode }
  | { kind: "sticker"; slots?: readonly LibrarySlot[]; durationMs: number; build: (ctx: LibraryStickerContext) => Clip[] }
  | { kind: "mockup"; slots?: readonly LibrarySlot[]; design: MockupDesign }
  | { kind: "asset"; slots?: readonly LibrarySlot[]; asset: LibraryAsset };

export type LibraryPreview =
  | { kind: "deferred"; load: () => Promise<LibraryPreview> }
  | { kind: "svg"; markup: string }
  | { kind: "icon"; iconId: string }
  | { kind: "text"; size: number; weight: number }
  | { kind: "image"; src: string }
  | { kind: "sound"; assetId: string }
  | { kind: "render" };

export interface LibrarySource {
  set: string;
  license: string;
  credit?: string;
  url?: string;
}

export const OWN_SOURCE: LibrarySource = { set: "vozko", license: "own" };

export interface LibraryAsset {
  path: string;
  sha256: string;
  width: number;
  height: number;
  contentType: string;
}

export interface LibraryAssets {
  loaded: () => boolean;
  load: () => Promise<void>;
}

export interface LibraryItem {
  id: string;
  category: string;
  subcategory?: string;
  editors: readonly LibraryEditor[];
  ratio: number;
  label: LibraryLabel;
  hint?: LibraryLabel;
  tags?: Partial<Record<LibraryLocale, readonly string[]>>;
  preview: LibraryPreview;
  source: LibrarySource;
  template: LibraryTemplate;
  assets?: LibraryAssets;
  palette?: (editor: LibraryEditor) => readonly string[];
}

export type LibraryTile = "square" | "card" | "row" | "poster" | "action" | "sound";

export interface LibrarySubcategory {
  id: string;
  label: LibraryLabel;
}

export interface LibraryCategory {
  id: string;
  panel: LibraryPanelId;
  label: LibraryLabel;
  tile: LibraryTile;
  subcategories?: readonly LibrarySubcategory[];
  notes?: Partial<Record<LibraryEditor, LibraryLabel>>;
  fixture?: "sample";
  generates?: "element";
  items: () => readonly LibraryItem[] | Promise<readonly LibraryItem[]>;
}
