import { editArtboard } from "../artboards";
import { emptyImageDocument, emptyVideoDocument, newMediaClip, VIDEO_ASPECT_SIZES, type CanvasSize, type ImageDocument, type VideoDocument } from "../document";
import { DEFAULT_OVERLAY_MS } from "../media-clips";
import { setAssetImporter } from "./asset-import";
import { labelText, supports } from "./catalog";
import { frameWithItem, framesItem, framingSlots } from "./framing";
import { imageContent, insertImageContent, insertVideoClips, readyItem, slotsOf, videoClips, type LibraryRequest } from "./instantiate";
import { LIBRARY_EDITORS, LIBRARY_LOCALES, type LibraryAsset, type LibraryCategory, type LibraryEditor, type LibraryItem, type LibraryLabel, type LibraryLocale, type LibrarySlot, type LocalizedText } from "./model";
import { layerColors } from "./placement";
import { loadItems } from "./store";

export const CATALOG_VERSION = 2;
export const CATALOG_CANVAS: CanvasSize = VIDEO_ASPECT_SIZES.square;
const FIXTURE_LOCALE: LibraryLocale = "pt";
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

export type LocalizedMessages = Readonly<Record<LibraryLocale, unknown>>;

export interface CatalogSlot {
  id: string;
  samples: LocalizedText;
}

export interface CatalogItem {
  id: string;
  category: string;
  subcategory?: string;
  panel: string;
  editors: readonly LibraryEditor[];
  kind: string;
  ratio: number;
  names: LocalizedText;
  tags?: Partial<Record<LibraryLocale, readonly string[]>>;
  slots?: CatalogSlot[];
  colors: Partial<Record<LibraryEditor, string[]>>;
  source: LibraryItem["source"];
  asset?: LibraryAsset;
}

export interface CatalogCategory {
  id: string;
  panel: string;
  names: LocalizedText;
  fixture?: "sample";
  subcategories?: { id: string; names: LocalizedText }[];
}

export interface CatalogFile {
  version: number;
  categories: CatalogCategory[];
  items: CatalogItem[];
}

export type LocaleTranslate = (locale: LibraryLocale, key: string) => string;

export function translatorOf(messages: LocalizedMessages): LocaleTranslate {
  return (locale, key) => {
    const found = key.split(".").reduce<unknown>((node, part) => (node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined), messages[locale]);
    if (typeof found !== "string") throw new Error(`the library label ${key} has no ${locale} text`);
    return found;
  };
}

function localized(label: LibraryLabel, translate: LocaleTranslate): LocalizedText {
  const entries = LIBRARY_LOCALES.map((locale) => [locale, labelText(label, (key) => translate(locale, key), locale)] as const);
  return Object.fromEntries(entries) as Record<LibraryLocale, string>;
}

function requestOf(translate: LocaleTranslate, canvas: CanvasSize): LibraryRequest {
  return { canvas, locale: FIXTURE_LOCALE, text: (slot: LibrarySlot) => labelText(slot.sample, (key) => translate(FIXTURE_LOCALE, key), FIXTURE_LOCALE) };
}

function colorsIn(item: LibraryItem, editor: LibraryEditor, request: LibraryRequest): string[] {
  if (item.palette) return [...item.palette(editor)];
  if (editor === "image") return layerColors(imageContent(item, request)?.layers ?? []);
  const clips = videoClips(item, { ...request, atMs: 0, documentMs: DEFAULT_OVERLAY_MS }) ?? [];
  return layerColors(clips.flatMap((clip) => (clip.layer ? [clip.layer] : [])));
}

function catalogItem(item: LibraryItem, category: LibraryCategory, translate: LocaleTranslate): CatalogItem {
  const request = requestOf(translate, CATALOG_CANVAS);
  const slots = slotsOf(item).map((slot) => ({ id: slot.id, samples: localized(slot.sample, translate) }));
  const colors = Object.fromEntries(LIBRARY_EDITORS.filter((editor) => supports(item, editor)).map((editor) => [editor, colorsIn(item, editor, request)]));
  return {
    id: item.id,
    category: category.id,
    ...(item.subcategory ? { subcategory: item.subcategory } : {}),
    panel: category.panel,
    editors: item.editors,
    kind: item.template.kind,
    ratio: Math.round(item.ratio * 1000) / 1000,
    names: localized(item.label, translate),
    ...(item.tags ? { tags: item.tags } : {}),
    ...(slots.length > 0 ? { slots } : {}),
    colors,
    source: item.source,
    ...(item.template.kind === "asset" ? { asset: item.template.asset } : {}),
  };
}

async function readyLists(categories: readonly LibraryCategory[]): Promise<(readonly LibraryItem[])[]> {
  setAssetImporter(() => Promise.resolve(crypto.randomUUID()));
  const lists = await Promise.all(categories.map(loadItems));
  const missing = (await Promise.all(lists.flat().map(async (item) => ((await readyItem(item)) ? null : item.id)))).filter((id): id is string => id !== null);
  if (missing.length > 0) throw new Error(`the library items ${missing.join(", ")} could not load their drawings`);
  return lists;
}

export function fixtureItems(category: LibraryCategory, items: readonly LibraryItem[]): readonly LibraryItem[] {
  if (category.fixture !== "sample") return items;
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.subcategory ?? "";
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function catalogFile(categories: readonly LibraryCategory[], translate: LocaleTranslate): Promise<CatalogFile> {
  const lists = await readyLists(categories);
  return {
    version: CATALOG_VERSION,
    categories: categories.map((category) => ({
      id: category.id,
      panel: category.panel,
      names: localized(category.label, translate),
      ...(category.subcategories ? { subcategories: category.subcategories.map((sub) => ({ id: sub.id, names: localized(sub.label, translate) })) } : {}),
      ...(category.fixture ? { fixture: category.fixture } : {}),
    })),
    items: lists.flatMap((items, index) => items.map((item) => catalogItem(item, categories[index], translate))),
  };
}

export function stableIds(json: string): string {
  const seen = new Map<string, string>();
  return json.replace(UUID, (uuid) => {
    const known = seen.get(uuid);
    if (known) return known;
    const next = `00000000-0000-4000-8000-${String(seen.size + 1).padStart(12, "0")}`;
    seen.set(uuid, next);
    return next;
  });
}

export function imageFixture(items: readonly LibraryItem[], translate: LocaleTranslate): ImageDocument {
  const empty = emptyImageDocument(CATALOG_CANVAS);
  const board = empty.artboards[0];
  const request = requestOf(translate, board.canvas);
  const contents = items.flatMap((item) => imageContent(item, request) ?? []);
  const merged = { layers: contents.flatMap((content) => content.layers), groups: contents.flatMap((content) => content.groups ?? []) };
  return editArtboard(empty, board.id, (surface) => insertImageContent(surface, merged).document);
}

export const FIXTURE_PHOTO = "library-photo";

const FIXTURE_STEP_MS = 1000;

function framedFixture(doc: VideoDocument, item: LibraryItem, atMs: number): VideoDocument {
  const photos = Array.from({ length: framingSlots(item) }, () => newMediaClip("image", FIXTURE_PHOTO, atMs, DEFAULT_OVERLAY_MS));
  const placed = insertVideoClips(doc, photos);
  const framed = placed ? frameWithItem(placed.document, item, placed.ids) : null;
  if (!framed?.ok) throw new Error(`the library item ${item.id} could not frame clips in a video`);
  return framed.document;
}

export function videoFixture(items: readonly LibraryItem[], translate: LocaleTranslate): VideoDocument {
  const request = requestOf(translate, CATALOG_CANVAS);
  return items
    .filter((item) => supports(item, "video"))
    .reduce((doc, item, index) => {
      const atMs = index * FIXTURE_STEP_MS;
      if (framesItem(item)) return framedFixture(doc, item, atMs);
      const clips = videoClips(item, { ...request, atMs, documentMs: doc.durationMs });
      const placed = clips ? insertVideoClips(doc, clips) : null;
      if (!placed) throw new Error(`the library item ${item.id} could not be placed in a video`);
      return placed.document;
    }, emptyVideoDocument("square"));
}

export function fixtureJson(doc: ImageDocument | VideoDocument): string {
  return `${stableIds(JSON.stringify(doc, null, 2))}\n`;
}

type CatalogBody = Omit<CatalogItem, "id" | "subcategory">;

const VARIANT_FIELDS = ["id", "subcategory", "names"] as const;

function bodyOf(item: CatalogItem, names: LocalizedText): CatalogBody {
  const body: Partial<CatalogItem> = { ...item, names };
  delete body.id;
  delete body.subcategory;
  return body as CatalogBody;
}

function variantKey(item: CatalogItem): string {
  return JSON.stringify(Object.entries(item).filter(([field]) => !(VARIANT_FIELDS as readonly string[]).includes(field)));
}

function sharedBodies(items: readonly CatalogItem[]): { shared: string[]; entries: string[] } {
  const keys = items.map(variantKey);
  const first = new Map<string, CatalogItem>();
  const uses = new Map<string, number>();
  for (const [i, key] of keys.entries()) {
    uses.set(key, (uses.get(key) ?? 0) + 1);
    if (!first.has(key)) first.set(key, items[i]);
  }
  const shared: string[] = [];
  const index = new Map<string, number>();
  const entries = items.map((item, i) => {
    const key = keys[i];
    if ((uses.get(key) ?? 0) < 2) return JSON.stringify(item);
    const base = first.get(key)!;
    if (!index.has(key)) {
      index.set(key, shared.length);
      shared.push(JSON.stringify(bodyOf(base, base.names)));
    }
    const names = JSON.stringify(item.names) === JSON.stringify(base.names) ? {} : { names: item.names };
    return JSON.stringify({ id: item.id, ...(item.subcategory ? { subcategory: item.subcategory } : {}), base: index.get(key), ...names });
  });
  return { shared, entries };
}

function jsonList(name: string, lines: readonly string[]): string {
  return `  "${name}": [\n${lines.map((line) => `    ${line}`).join(",\n")}\n  ]`;
}

export function catalogJson(file: CatalogFile): string {
  const head = JSON.stringify({ version: file.version, categories: file.categories }, null, 2);
  const { shared, entries } = sharedBodies(file.items);
  const lists = [...(shared.length > 0 ? [jsonList("shared", shared)] : []), jsonList("items", entries)];
  return `${head.slice(0, -2)},\n${lists.join(",\n")}\n}\n`;
}

export const CATALOG_PATHS = {
  catalog: "vozko-back/domain/studio/library/catalog.json",
  image: "vozko-back/domain/studio/testdata/editor_library_image.json",
  video: "vozko-back/domain/studio/testdata/editor_library_video.json",
} as const;

export async function catalogFiles(categories: readonly LibraryCategory[], messages: LocalizedMessages): Promise<Record<keyof typeof CATALOG_PATHS, string>> {
  const translate = translatorOf(messages);
  const lists = await readyLists(categories);
  const items = lists.flatMap((list, index) => fixtureItems(categories[index], list));
  return {
    catalog: catalogJson(await catalogFile(categories, translate)),
    image: fixtureJson(imageFixture(items, translate)),
    video: fixtureJson(videoFixture(items, translate)),
  };
}
