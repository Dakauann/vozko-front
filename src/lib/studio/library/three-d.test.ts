import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";

import { emptyArtboard, emptyVideoDocument } from "../document";
import { documentIssue, surfaceIssue } from "../validate";
import { setAssetImporter } from "./asset-import";
import { GRAPHICS_CATEGORY } from "./builtin/graphics";
import { THREE_D_CATEGORY } from "./builtin/three-d";
import { imageContent, insertImageContent, insertVideoClips, readyItem, videoClips, type LibraryRequest } from "./instantiate";
import type { LibraryItem } from "./model";
import { LIBRARY_NOTICES } from "./notices";
import { loadItems } from "./store";

const PUBLIC = resolve(__dirname, "../../../../public");
const SQUARE = { width: 1080, height: 1080 };
const MEDIA = "8d0c2f9e-6b1a-4c3d-9e8f-0a1b2c3d4e5f";

function request(): LibraryRequest {
  return { canvas: SQUARE, locale: "pt", text: () => "" };
}

async function pictures(): Promise<readonly LibraryItem[]> {
  return loadItems(THREE_D_CATEGORY);
}

afterEach(() => setAssetImporter(null));

describe("3D pictures", () => {
  it("ship the exact files the catalog names, under licenses that allow it", async () => {
    const items = await pictures();
    expect(items.length).toBeGreaterThanOrEqual(130);
    expect(new Set(items.map((item) => item.subcategory))).toEqual(new Set(["icons", "emoji"]));
    for (const item of items) {
      if (item.template.kind !== "asset") throw new Error(`${item.id} is not a picture`);
      const { asset } = item.template;
      const bytes = readFileSync(resolve(PUBLIC, asset.path));
      expect(createHash("sha256").update(bytes).digest("hex"), item.id).toBe(asset.sha256);
      expect(bytes.toString("ascii", 8, 12), item.id).toBe("WEBP");
      expect(["CC0-1.0", "MIT"], item.id).toContain(item.source.license);
      expect(item.preview, item.id).toEqual({ kind: "image", src: `/${asset.path}` });
    }
  });

  it("insert nothing while the picture cannot reach the workspace library", async () => {
    const [first] = await pictures();
    expect(await readyItem(first)).toBe(false);
    expect(imageContent(first, request())).toBeNull();
    setAssetImporter(() => Promise.reject(new Error("offline")));
    expect(await readyItem(first)).toBe(false);
  });

  it("insert the imported media as an image layer and as an image clip", async () => {
    const asked: string[] = [];
    setAssetImporter(async (itemId) => {
      asked.push(itemId);
      return MEDIA;
    });
    const [first] = await pictures();
    expect(await readyItem(first)).toBe(true);
    expect(await readyItem(first)).toBe(true);
    expect(asked).toEqual([first.id]);
    const content = imageContent(first, request())!;
    expect(content.layers).toHaveLength(1);
    expect(content.layers[0]).toMatchObject({ type: "image", assetId: MEDIA });
    expect(surfaceIssue(insertImageContent({ ...emptyArtboard(SQUARE), layers: [] }, content).document)).toBeNull();
    const clips = videoClips(first, { ...request(), atMs: 0, documentMs: 0 })!;
    expect(clips[0]).toMatchObject({ type: "image", assetId: MEDIA, fit: "contain" });
    expect(documentIssue("video", insertVideoClips(emptyVideoDocument("square"), clips)!.document)).toBeNull();
  });
});

describe("credits", () => {
  it("carry a notice and a localized use for every open set the new categories bring", async () => {
    const items = [...(await pictures()), ...(await loadItems(GRAPHICS_CATEGORY))].filter((item) => item.source.license !== "own");
    const sets = new Set(items.map((item) => item.source.set));
    const notices = new Map(LIBRARY_NOTICES.map((notice) => [notice.id, notice]));
    for (const set of sets) {
      const notice = notices.get(set);
      expect(notice, set).toBeDefined();
      expect(notice!.text.length, set).toBeGreaterThan(40);
      for (const messages of [pt, en, es, de]) expect((messages.studio.library.credits.use as Record<string, string>)[set], set).toBeTruthy();
    }
    expect(notices.get("fluent-emoji-3d")!.text).toContain("Permission is hereby granted");
    expect(notices.get("3dicons")!.text).toContain("CC0 1.0 Universal");
  });
});
