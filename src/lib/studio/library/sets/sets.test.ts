import { describe, expect, it } from "vitest";

import { pathToSubpaths } from "../../path-nodes";
import { layerIssue } from "../../validate";
import { imageContent, readyItem, videoClips } from "../instantiate";
import { LIBRARY_ID_PATTERN, LIBRARY_INK, LIBRARY_LOCALES, type LibraryItem, type LocalizedText } from "../model";
import { layerColors } from "../placement";
import { chunkedData } from "./chunks";
import { emojiItems, EMOJI_CATEGORY } from "./emoji-set";
import { ICON_CHUNKS } from "./data/loaders";
import { SET_NOTICES } from "./data/notices";
import { EMOJI_GROUPS, ICON_WEIGHTS, type IconPaths } from "./format";
import { iconSetItems } from "./icon-set";

const SQUARE = { width: 1000, height: 1000 };
const request = { canvas: SQUARE, locale: "pt", text: () => "" };
const EVERY = 40;

function labelOf(item: LibraryItem): LocalizedText {
  if (!("text" in item.label)) throw new Error(`${item.id} should carry its own names`);
  return item.label.text;
}

function sampled(items: readonly LibraryItem[]): LibraryItem[] {
  return items.filter((_, index) => index % EVERY === 0);
}

describe("the icon set", () => {
  it("offers every icon in all six weights with names in four languages and tags in Portuguese and English", { timeout: 30_000 }, async () => {
    const items = await iconSetItems();
    expect(items.length % ICON_WEIGHTS.length).toBe(0);
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
    for (const weight of ICON_WEIGHTS) expect(items.filter((item) => item.subcategory === weight)).toHaveLength(items.length / ICON_WEIGHTS.length);
    for (const item of items) {
      expect(item.id, item.id).toMatch(LIBRARY_ID_PATTERN);
      expect(item.id.length, item.id).toBeLessThanOrEqual(64);
      expect(LIBRARY_LOCALES.every((locale) => labelOf(item)[locale].trim() !== ""), item.id).toBe(true);
      expect(item.tags?.pt?.length, item.id).toBeGreaterThan(0);
      expect(item.tags?.en?.length, item.id).toBeGreaterThan(0);
    }
  });

  it("reads every drawing of every weight into vector outlines", { timeout: 60_000 }, async () => {
    for (const weight of ICON_WEIGHTS) {
      const chunks = chunkedData<IconPaths[]>(ICON_CHUNKS[weight]);
      const lists = await Promise.all(ICON_CHUNKS[weight].map((_, index) => chunks.load(index)));
      for (const paths of lists.flat()) {
        expect(paths.length).toBeGreaterThan(0);
        for (const part of paths) expect(pathToSubpaths(typeof part === "string" ? part : part[0]).length).toBeGreaterThan(0);
      }
    }
  });

  it("inserts editable vector layers in the editor ink that the validator accepts", { timeout: 60_000 }, async () => {
    const items = sampled(await iconSetItems());
    expect((await Promise.all(items.map(readyItem))).every(Boolean)).toBe(true);
    for (const item of items) {
      const content = imageContent(item, request)!;
      expect(content.layers.length, item.id).toBeGreaterThan(0);
      for (const layer of content.layers) {
        expect(layer, item.id).toMatchObject({ type: "shape", shape: "path", fill: LIBRARY_INK.image });
        expect(layerIssue(layer), item.id).toBeNull();
      }
      expect(layerColors(content.layers)).toEqual([...item.palette!("image")]);
      const clips = videoClips(item, { ...request, atMs: 0, documentMs: 0 })!;
      expect(clips.every((clip) => clip.layer?.fill === LIBRARY_INK.video), item.id).toBe(true);
    }
  });

  it("draws duotone icons as a faint back shape under the line, grouped", async () => {
    const duotone = (await iconSetItems()).find((item) => item.id === "icon-heart-duotone")!;
    await readyItem(duotone);
    const content = imageContent(duotone, { ...request, name: "Coração" })!;
    expect(content.layers).toHaveLength(2);
    expect(content.layers[0].transform.opacity).toBeCloseTo(0.2);
    expect(content.groups?.[0]).toMatchObject({ name: "Coração" });
  });

  it("previews an icon as a mask drawing once its chunk loads", async () => {
    const heart = (await iconSetItems()).find((item) => item.id === "icon-heart-bold")!;
    if (heart.preview.kind !== "deferred") throw new Error("the icon preview should load on demand");
    const preview = await heart.preview.load();
    expect(preview.kind).toBe("svg");
    expect(preview.kind === "svg" && preview.markup).toContain('fill="currentColor"');
  });
});

describe("the emoji set", () => {
  it("names every emoji in four languages, groups it and keeps ids unique", async () => {
    const items = await emojiItems();
    expect(items.length).toBeGreaterThan(1000);
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
    const groups = new Set(items.map((item) => item.subcategory));
    for (const group of groups) expect(EMOJI_GROUPS).toContain(group);
    expect(EMOJI_CATEGORY.subcategories?.map((sub) => sub.id)).toEqual([...EMOJI_GROUPS]);
    for (const item of items) {
      expect(item.id, item.id).toMatch(LIBRARY_ID_PATTERN);
      expect(LIBRARY_LOCALES.every((locale) => labelOf(item)[locale].trim() !== ""), item.id).toBe(true);
    }
  });

  it("inserts each emoji as a named group of editable colored layers the validator accepts", { timeout: 60_000 }, async () => {
    const items = sampled(await emojiItems());
    expect((await Promise.all(items.map(readyItem))).every(Boolean)).toBe(true);
    for (const item of items) {
      const content = imageContent(item, { ...request, name: "emoji" })!;
      expect(content.layers.length, item.id).toBeGreaterThan(0);
      for (const layer of content.layers) expect(layerIssue(layer), item.id).toBeNull();
      expect(layerColors(content.layers), item.id).toEqual([...item.palette!("image")]);
      expect(item.palette!("image")).not.toContain(LIBRARY_INK.image);
    }
  });

  it("recolors an emoji through the shared color swap", async () => {
    const face = (await emojiItems()).find((item) => item.id === "emoji-grinning-face")!;
    await readyItem(face);
    const [yellow] = face.palette!("image");
    const content = imageContent(face, { ...request, colors: [{ from: yellow, to: "#00ff00" }] })!;
    expect(layerColors(content.layers)).toContain("#00ff00");
    expect(layerColors(content.layers)).not.toContain(yellow);
  });
});

describe("loading on demand", () => {
  it("refuses to build an item whose drawing failed to load and retries the chunk later", async () => {
    let attempts = 0;
    const chunks = chunkedData<string[]>([
      async () => {
        attempts++;
        if (attempts === 1) throw new Error("offline");
        return { default: JSON.stringify(["M0 0 L1 1"]) };
      },
    ]);
    const item: LibraryItem = {
      id: "test-lazy",
      category: "icons",
      editors: ["image"],
      ratio: 1,
      label: { text: { pt: "a", en: "a", es: "a", de: "a" } },
      preview: { kind: "svg", markup: "" },
      source: { set: "test", license: "MIT" },
      assets: { loaded: () => chunks.get(0) !== undefined, load: async () => void (await chunks.load(0)) },
      template: { kind: "layers", build: () => ({ layers: [] }) },
    };
    expect(imageContent(item, request)).toBeNull();
    expect(await readyItem(item)).toBe(false);
    expect(imageContent(item, request)).toBeNull();
    expect(await readyItem(item)).toBe(true);
    expect(attempts).toBe(2);
  });
});

describe("the notices", () => {
  it("keeps the license text of every bundled third party set", () => {
    expect(SET_NOTICES.map((notice) => notice.id)).toEqual(["icons", "emoji", "emoji-names"]);
    for (const notice of SET_NOTICES) {
      expect(notice.text.length, notice.id).toBeGreaterThan(500);
      expect(notice.url, notice.id).toMatch(/^https:\/\/github\.com\//);
    }
    expect(SET_NOTICES[0].text).toContain("Permission is hereby granted");
    expect(SET_NOTICES[2].text).toContain("UNICODE LICENSE V3");
  });
});
