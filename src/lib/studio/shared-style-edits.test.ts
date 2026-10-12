import { describe, expect, it } from "vitest";

import { imageDocument, type Artboard, type ImageDocument, type Layer } from "./document";
import { applyStyle, createStyle, deleteStyle, detachStyle, mergedStyles, styleUses, updateStyle } from "./shared-style-edits";
import type { StudioStyle } from "./shared-styles";
import { documentIssue } from "./validate";

const box = { x: 0.5, y: 0.5, w: 0.6, h: 0.2, rotation: 0, opacity: 1 };
const title: Layer = { id: "title", type: "text", text: "Oferta", fontId: "montserrat", fontWeight: 800, fontSize: 72 / 1080, lineHeight: 1.05, fill: "#e4003a", shadow: { color: "#00000059", blur: 24, x: 0, y: 8 }, transform: box };
const story: Layer = { ...title, id: "story-title", fontSize: 0.03, fill: "#111111", shadow: undefined };
const card: Layer = { id: "card", type: "shape", shape: "rect", fill: "#111111", stroke: "#000000", strokeWidth: 4, transform: box };

function doc(styles: StudioStyle[] = []): ImageDocument {
  const feed: Artboard = { id: "feed", x: 0, y: 0, canvas: { width: 1080, height: 1080, background: "#ffffff" }, layers: [title, card] };
  const tall: Artboard = { id: "story", x: 1180, y: 0, canvas: { width: 1080, height: 1920, background: "#ffffff" }, layers: [story] };
  return { ...imageDocument([feed, tall]), ...(styles.length > 0 ? { styles } : {}) };
}

function layer(d: ImageDocument, id: string): Layer {
  return d.artboards.flatMap((a) => a.layers).find((l) => l.id === id)!;
}

function created(d: ImageDocument, input: Parameters<typeof createStyle>[1]) {
  const result = createStyle(d, input);
  if (!result.ok) throw new Error(result.reason);
  expect(documentIssue("image", result.document)).toBeNull();
  return result;
}

describe("creating styles", () => {
  it("captures a layer and links it", () => {
    const text = created(doc(), { kind: "text", name: "Título", role: "heading", from: { layerId: "title" } });
    expect(text.document.styles?.[0]).toEqual({ id: text.styleId, kind: "text", name: "Título", role: "heading", fontId: "montserrat", fontWeight: 800, fontSizePx: 72, lineHeight: 1.05 });
    expect(layer(text.document, "title").textStyleId).toBe(text.styleId);
    const color = created(text.document, { kind: "color", name: "Vermelho", from: { layerId: "title" } });
    expect(color.document.styles?.[1]).toMatchObject({ kind: "color", color: "#e4003a" });
    expect(layer(color.document, "title").fillStyleId).toBe(color.styleId);
    const outline = created(doc(), { kind: "color", name: "Contorno", from: { layerId: "card", slot: "stroke" }, link: false });
    expect(outline.document.styles?.[0]).toMatchObject({ color: "#000000" });
    expect(layer(outline.document, "card").strokeStyleId).toBeUndefined();
    const shadow = created(doc(), { kind: "effect", name: "Suave", from: { layerId: "title" } });
    expect(shadow.document.styles?.[0]).toMatchObject({ shadow: { color: "#00000059", blur: 24, x: 0, y: 8 } });
  });

  it("takes explicit values and refuses invalid ones", () => {
    const font = created(doc(), { kind: "text", name: "Fonte", values: { fontId: "inter" } });
    expect(font.document.styles?.[0]).toEqual({ id: font.styleId, kind: "text", name: "Fonte", fontId: "inter" });
    expect(createStyle(doc(), { kind: "color", name: "Nada", values: {} })).toEqual({ ok: false, reason: "invalid", ids: [] });
    expect(createStyle(doc(), { kind: "color", name: " ", values: { color: "#ffffff" } })).toEqual({ ok: false, reason: "invalid", ids: [] });
    expect(createStyle(doc(), { kind: "effect", name: "Sem sombra", from: { layerId: "card" } })).toEqual({ ok: false, reason: "slot", ids: [] });
  });
});

describe("applying styles", () => {
  const heading: StudioStyle = { id: "h1", kind: "text", name: "Título", fontId: "montserrat", fontWeight: 800, fontSizePx: 72 };
  const red: StudioStyle = { id: "red", kind: "color", name: "Vermelho", color: "#e4003a" };

  it("writes the values in each surface's units and the link", () => {
    const result = applyStyle(doc([heading, red]), "h1", [{ kind: "layer", layerId: "story-title" }]);
    if (!result.ok) throw new Error(result.reason);
    expect(layer(result.document, "story-title")).toMatchObject({ fontSize: 72 / 1920, textStyleId: "h1" });
    const painted = applyStyle(result.document, "red", [{ kind: "layer", layerId: "card" }, { kind: "background", artboardId: "story" }]);
    if (!painted.ok) throw new Error(painted.reason);
    expect(layer(painted.document, "card")).toMatchObject({ fill: "#e4003a", fillStyleId: "red" });
    expect(painted.document.artboards[1].canvas).toMatchObject({ background: "#e4003a", backgroundStyleId: "red" });
    expect(documentIssue("image", painted.document)).toBeNull();
  });

  it("refuses a slot the layer does not paint, a size out of range and a locked layer", () => {
    expect(applyStyle(doc([heading, red]), "h1", [{ kind: "layer", layerId: "card" }])).toEqual({ ok: false, reason: "slot", ids: ["card"] });
    const huge = { ...heading, fontSizePx: 1500 };
    expect(applyStyle(doc([huge]), "h1", [{ kind: "layer", layerId: "title" }])).toEqual({ ok: false, reason: "range", ids: ["title"] });
    const locked = { ...doc([red]), artboards: doc([red]).artboards.map((a) => ({ ...a, layers: a.layers.map((l) => ({ ...l, locked: true })) })) };
    expect(applyStyle(locked, "red", [{ kind: "layer", layerId: "card" }])).toEqual({ ok: false, reason: "locked", ids: ["card"] });
    expect(applyStyle(doc([red]), "ghost", [{ kind: "layer", layerId: "card" }])).toEqual({ ok: false, reason: "missing", ids: [] });
  });
});

describe("editing, detaching and deleting styles", () => {
  function linked(): ImageDocument {
    const heading: StudioStyle = { id: "h1", kind: "text", name: "Título", fontId: "montserrat", fontSizePx: 72 };
    const result = applyStyle(doc([heading]), "h1", [{ kind: "layer", layerId: "title" }, { kind: "layer", layerId: "story-title" }]);
    if (!result.ok) throw new Error(result.reason);
    return result.document;
  }

  it("propagates an edit to every consumer in its own units", () => {
    const result = updateStyle(linked(), "h1", { values: { fontSizePx: 96, fontWeight: 900 } });
    if (!result.ok) throw new Error(result.reason);
    expect(layer(result.document, "title")).toMatchObject({ fontSize: 96 / 1080, fontWeight: 900, textStyleId: "h1" });
    expect(layer(result.document, "story-title")).toMatchObject({ fontSize: 96 / 1920, fontWeight: 900 });
    expect(result.changed).toEqual(["title", "story-title"]);
    expect(documentIssue("image", result.document)).toBeNull();
  });

  it("removes a field from a partial style and refuses an edit a consumer cannot take", () => {
    const smaller = updateStyle(linked(), "h1", { name: "Títulos", values: { fontSizePx: null } });
    if (!smaller.ok) throw new Error(smaller.reason);
    expect(smaller.document.styles?.[0]).toEqual({ id: "h1", kind: "text", name: "Títulos", fontId: "montserrat" });
    expect(updateStyle(linked(), "h1", { values: { fontSizePx: 700 } })).toEqual({ ok: false, reason: "range", ids: ["title"] });
    expect(updateStyle(linked(), "h1", { values: { fontId: null, fontSizePx: null } })).toEqual({ ok: false, reason: "invalid", ids: [] });
  });

  it("detaches links and deletes styles without touching any value", () => {
    const detached = detachStyle(linked(), [{ kind: "layer", layerId: "title" }]);
    expect(layer(detached, "title").textStyleId).toBeUndefined();
    expect(layer(detached, "title").fontSize).toBeCloseTo(72 / 1080);
    expect(styleUses(detached, "h1")).toEqual([{ artboardId: "story", layerId: "story-title", slot: "text" }]);
    const deleted = deleteStyle(linked(), "h1");
    expect(deleted.styles).toBeUndefined();
    expect(layer(deleted, "story-title").textStyleId).toBeUndefined();
    expect(layer(deleted, "story-title").fontSize).toBeCloseTo(72 / 1920);
  });

  it("merges pasted styles the project lacks and keeps the ones it has", () => {
    const red: StudioStyle = { id: "red", kind: "color", name: "Vermelho", color: "#e4003a" };
    const other: StudioStyle = { id: "red", kind: "color", name: "Outro", color: "#000000" };
    const blue: StudioStyle = { id: "blue", kind: "color", name: "Azul", color: "#0000ff" };
    expect(mergedStyles(doc([red]), [other, blue]).styles).toEqual([red, blue]);
    const same = doc([red]);
    expect(mergedStyles(same, [red])).toBe(same);
  });
});

describe("styles on styled parts of a text", () => {
  it("takes over the fields the style governs in every part and keeps the rest", () => {
    const rich = { ...title, runs: [{ start: 0, end: 3, fontWeight: 400, fill: "#00ff00", underline: true }] };
    const base: ImageDocument = { ...doc(), artboards: doc().artboards.map((a) => (a.id === "feed" ? { ...a, layers: [rich, card] } : a)) };
    const text = created(base, { kind: "text", name: "Corpo", values: { fontId: "inter", fontWeight: 700 }, link: false });
    const applied = applyStyle(text.document, text.styleId, [{ kind: "layer", layerId: "title" }], "text");
    if (!applied.ok) throw new Error(applied.reason);
    expect(layer(applied.document, "title").runs).toEqual([{ start: 0, end: 3, fill: "#00ff00", underline: true }]);
    const color = created(applied.document, { kind: "color", name: "Azul", values: { color: "#0000ff" }, link: false });
    const painted = applyStyle(color.document, color.styleId, [{ kind: "layer", layerId: "title" }], "fill");
    if (!painted.ok) throw new Error(painted.reason);
    expect(layer(painted.document, "title").runs).toEqual([{ start: 0, end: 3, underline: true }]);
    expect(documentIssue("image", painted.document)).toBeNull();
  });
});
