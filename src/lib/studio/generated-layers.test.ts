import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { resolvedSurface } from "./components";
import type { ImageDocument, Layer } from "./document";
import { generatedColors, generatedPartLayers, isGeneratedLayer, recoloredGenerated } from "./generated-layers";
import { documentIssue, layerIssue } from "./validate";
import { exportScene } from "./export-scene";
import { sceneToSvg } from "./svg-export";

const TESTDATA = resolve(__dirname, "../../../../vozko-back/domain/studio/testdata");

function fixture<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(TESTDATA, name), "utf8")) as T;
}

describe("table and qr contract", () => {
  it("accepts the shared editor documents", () => {
    expect(documentIssue("image", fixture("editor_table_qr.json"))).toBeNull();
    expect(documentIssue("video", fixture("editor_table_qr_video.json"))).toBeNull();
  });

  it.each(fixture<{ name: string; layer: Layer; code: string | null }[]>("generated_layer_cases.json").map((entry) => [entry.name, entry] as const))("%s", (_, entry) => {
    expect(layerIssue(entry.layer)).toBe(entry.code);
  });
});

describe("generated layers", () => {
  it("expands tables and codes into ordinary locked parts on the artboard", () => {
    const doc = fixture<ImageDocument>("editor_table_qr.json");
    const board = doc.artboards[0];
    const resolved = resolvedSurface(doc, board);
    const parts = resolved.layers.filter((layer) => layer.id.startsWith("prices;"));
    expect(parts.length).toBeGreaterThan(10);
    expect(parts.every((part) => part.locked && ["shape", "text"].includes(part.type))).toBe(true);
    expect(resolved.layers.some((layer) => layer.id === "scan-wa;logo" && layer.type === "image" && layer.assetId === "media-logo")).toBe(true);
    expect(resolved.layers.filter((layer) => layer.id.startsWith("scan-text;")).every((layer) => layer.hidden)).toBe(true);
    expect(resolved.layers.filter((layer) => layer.id.startsWith("scan-url;")).every((layer) => layer.groupId === "codes")).toBe(true);
    expect(resolved.layers.some(isGeneratedLayer)).toBe(false);
  });

  it("draws no parts for layers that generate nothing", () => {
    expect(generatedPartLayers({ id: "t", type: "text", text: "a", transform: { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 } }, { width: 100, height: 100 })).toEqual([]);
  });
});

describe("generated layers in vector exports", () => {
  it("keeps code modules and table fills and borders as vector paths in SVG and PDF scenes, with cell text as text patches", () => {
    const doc = fixture<ImageDocument>("editor_table_qr.json");
    const board = { ...doc.artboards[0], layers: doc.artboards[0].layers.filter((layer) => layer.id === "scan-short" || layer.id === "prices") };
    const scene = exportScene(resolvedSurface(doc, board), { transparent: false });
    const vectors = scene.items.filter((item) => item.kind === "vector");
    const rasters = scene.items.filter((item) => item.kind === "raster");
    expect(vectors.length).toBeGreaterThan(5);
    expect(rasters.flatMap((item) => (item.kind === "raster" ? item.layerIds : [])).every((id) => id.startsWith("prices;cell-"))).toBe(true);
    const svg = sceneToSvg({ ...scene, items: vectors }, new Map());
    expect(svg).toContain('fill="#111111"');
    expect((svg.match(/<path/g) ?? []).length).toBeGreaterThan(5);
  });
});

describe("generated layer colors", () => {
  it("lists and swaps the colors of tables and codes for library recoloring", () => {
    const doc = fixture<ImageDocument>("editor_table_qr.json");
    const [table, code] = doc.artboards[0].layers;
    expect(generatedColors(table)).toEqual(expect.arrayContaining(["#111111", "#ffffff", "#1111110f", "#11111140", "#2563eb"]));
    expect(generatedColors(code)).toEqual(["#111111", "#ffffff"]);
    const swap = (color: string) => (color === "#111111" ? "#1e3a8a" : color);
    const recolored = { ...table, ...recoloredGenerated(table, swap) };
    expect(recolored.table?.style).toMatchObject({ textColor: "#1e3a8a", headerFill: "#1e3a8a", headerText: "#ffffff" });
    expect({ ...code, ...recoloredGenerated(code, swap) }.qr).toMatchObject({ dark: "#1e3a8a", light: "#ffffff" });
    expect(layerIssue({ ...code, ...recoloredGenerated(code, swap) })).toBeNull();
  });
});
