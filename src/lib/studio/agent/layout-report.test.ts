import { describe, expect, it } from "vitest";

import type { ImageSurface, Layer, Transform } from "../document";
import { layoutReport, sceneLayout } from "./layout-report";
import { imageScene } from "./scene";
import { estimateTextWidth, type TextMeasure } from "./text-ink";

const at = (x: number, y: number, w: number, h: number, rotation = 0): Transform => ({ x, y, w, h, rotation, opacity: 1 });
const text = (id: string, transform: Transform, fontSize: number, extra: Partial<Layer> = {}): Layer => ({ id, type: "text", text: "Coleção de Outono", fontSize, fill: "#2b1d12", align: "left", transform, ...extra });
const rect = (id: string, transform: Transform, fill = "#ffffff"): Layer => ({ id, type: "shape", shape: "rect", fill, transform });

function surface(layers: Layer[]): ImageSurface {
  return { canvas: { width: 1080, height: 1350, background: "#f4efe6" }, layers };
}

function placed(layers: Layer[]) {
  return layoutReport(surface(layers)).findings.filter((finding) => finding.kind !== "empty_band");
}

function kinds(layers: Layer[]): string[] {
  return placed(layers).map((finding) => `${finding.kind}:${finding.ids.join(",")}`);
}

const title = text("title", at(0.5, 0.12, 0.84, 0.1), 0.07);
const subtitle = text("subtitle", at(0.5, 0.2, 0.84, 0.05), 0.035);

describe("layout report", () => {
  it("finds nothing in a tidy column and states margins, levels and reading order", () => {
    const report = layoutReport(surface([title, subtitle]));
    expect(placed([title, subtitle])).toEqual([]);
    expect(report.levels).toBe("texto em 2 níveis: 0.07 (title) > 0.035 (subtitle) 2x");
    expect(report.reading).toBe("ordem de leitura: title, subtitle");
    expect(report.margins).toMatch(/^menor respiro: esquerda 86 px \(title, subtitle\)/);
  });

  it("points at the layer that sits a few pixels off a shared edge", () => {
    const off = { ...subtitle, transform: at(0.515, 0.2, 0.84, 0.05) };
    const footer = text("footer", at(0.5, 0.9, 0.84, 0.04), 0.03);
    expect(kinds([title, off, footer])).toEqual(["misalign:subtitle,footer,title"]);
  });

  it("does not blame the top of a button that already shares its middle with a neighbour, nor a faint contact shadow", () => {
    const button = rect("cta", at(0.26, 0.84, 0.36, 0.07), "#c2410c");
    const footer = text("footer", at(0.72, 0.84, 0.4, 0.04), 0.03, { align: "right", text: "loja.exemplo" });
    const product = rect("product", at(0.5, 0.48, 0.44, 0.36));
    const contact: Layer = { id: "contact", type: "shape", shape: "ellipse", fill: "#0f172a", transform: { ...at(0.5, 0.7, 0.4, 0.035), opacity: 0.25 } };
    expect(kinds([title, button, footer, product, contact])).toEqual([]);
  });

  it("compares text by its alignment edge and middle only, since the line box top is not where the letters start", () => {
    const badge = rect("badge", at(0.82, 0.27, 0.2, 0.16), "#dc2626");
    const sub = text("sub", at(0.5, 0.2, 0.84, 0.05), 0.035, { align: "center", text: "Som que acompanha você" });
    expect(kinds([badge, { ...sub, transform: at(0.5, 0.205, 0.84, 0.05) }])).toEqual([]);
  });

  it("leaves a text inside its button alone", () => {
    const button = rect("cta", at(0.3, 0.8, 0.36, 0.07), "#c2410c");
    const label = text("cta_text", at(0.3, 0.8, 0.32, 0.05), 0.032, { align: "center", text: "Ver" });
    expect(kinds([title, subtitle, button, label])).toEqual([]);
  });

  it("finds a layer crowding the edge but not one that bleeds", () => {
    expect(kinds([title, rect("tag", at(0.9, 0.5, 0.18, 0.1))])).toContain("crowded_margin:tag");
    expect(kinds([title, rect("band", at(0.5, 0.5, 1.2, 0.1))])).toEqual([]);
  });

  it("finds two layers that almost touch", () => {
    const card = rect("card", at(0.21, 0.48, 0.26, 0.36));
    const button = rect("cta", at(0.26, 0.698, 0.36, 0.07), "#c2410c");
    expect(kinds([title, card, button])).toContain("tangent:cta,card");
  });

  it("finds panels that collide and text that spills out of its panel", () => {
    expect(kinds([title, rect("a", at(0.3, 0.5, 0.26, 0.36)), rect("b", at(0.45, 0.5, 0.26, 0.36))])).toContain("overlap:b,a");
    const button = rect("cta", at(0.5, 0.85, 0.44, 0.07), "#0f172a");
    const spill = text("cta_text", at(0.66, 0.85, 0.4, 0.05), 0.032, { align: "center", text: "Comprar agora", fill: "#ffffff" });
    expect(kinds([title, button, spill])).toContain("overlap:cta_text,cta");
  });

  it("finds two top text levels that are almost the same size", () => {
    const close = { ...subtitle, fontSize: 0.066, transform: at(0.5, 0.215, 0.84, 0.08) };
    expect(kinds([title, close])).toEqual(["hierarchy:subtitle,title"]);
  });

  it("compares tilted texts by their real corners, not by the upright box around them", () => {
    const strip = rect("strip", at(0.5, 0.45, 0.95, 0.07, -12), "#c2255c");
    const label = text("strip_text", at(0.5, 0.45, 0.9, 0.045, -12), 0.03, { align: "center", text: "DOCES BOLOS TORTAS DOCES BOLOS TORTAS", fill: "#ffffff" });
    expect(kinds([title, strip, label]).filter((kind) => kind.startsWith("overlap"))).toEqual([]);
    const crossing = text("crossing", at(0.5, 0.45, 0.9, 0.045, -4), 0.03, { align: "center", text: "DOCES BOLOS TORTAS DOCES BOLOS TORTAS", fill: "#ffffff" });
    expect(kinds([title, label, crossing])).toContain("overlap:crossing,strip_text");
  });

  it("finds tilted layers that are almost but not quite parallel", () => {
    expect(kinds([title, rect("a", at(0.3, 0.5, 0.3, 0.2, -8)), rect("b", at(0.7, 0.5, 0.3, 0.2, -10.5))])).toEqual(["near_parallel:a,b"]);
  });
});

describe("text that its own box hides", () => {
  it("names the hidden words of a clipped text, as an error when the text is really measured", () => {
    const price = text("price", at(0.5, 0.5, 0.25, 0.07), 0.05, { text: "R$ 189,90" });
    const measured: TextMeasure = (words, layer, fontPx) => estimateTextWidth(words, layer, fontPx);
    const clipped = layoutReport(surface([price]), measured).findings.filter((finding) => finding.kind === "text_clipped");
    expect(clipped).toEqual([{ kind: "text_clipped", level: "erro", ids: ["price"], text: expect.stringMatching(/^o texto price esconde a linha "189,90": a caixa só mostra 1 de 2 linhas/) }]);
    expect(layoutReport(surface([price])).findings.filter((finding) => finding.kind === "text_clipped").map((finding) => finding.level)).toEqual(["aviso"]);
  });

  it("names a single word wider than its box, which the editor splits mid-word", () => {
    const mark = text("mark", at(0.5, 0.5, 0.309, 0.14), 0.1, { text: "ELORA", fontWeight: 500 });
    const measured: TextMeasure = (words, layer, fontPx) => estimateTextWidth(words, layer, fontPx);
    const clipped = layoutReport(surface([mark]), measured).findings.filter((finding) => finding.kind === "text_clipped");
    expect(clipped).toEqual([{ kind: "text_clipped", level: "erro", ids: ["mark"], text: expect.stringMatching(/^o texto mark tem a palavra "ELORA" mais larga que a caixa .*use font_size [\d.]+/) }]);
  });

  it("leaves a box that shows every line alone", () => {
    const price = text("price", at(0.5, 0.5, 0.25, 0.14), 0.05, { text: "R$ 189,90" });
    expect(layoutReport(surface([price])).findings.filter((finding) => finding.kind === "text_clipped")).toEqual([]);
  });
});

describe("empty bands", () => {
  const story = (layers: Layer[]): ImageSurface => ({ canvas: { width: 1080, height: 1920, background: "#0f2a4a" }, layers });
  const kicker = text("kicker", at(0.5, 0.2, 0.84, 0.03), 0.026, { align: "center", text: "LIQUIDA DE INVERNO", fill: "#bfe3ff" });
  const big = text("big", at(0.5, 0.33, 0.9, 0.16), 0.15, { align: "center", text: "60%", fill: "#ffffff" });
  const cta = rect("cta", at(0.5, 0.6, 0.56, 0.05));
  const bands = (layers: Layer[], canvas = story) => layoutReport(canvas(layers)).findings.filter((finding) => finding.kind === "empty_band");

  it("finds the lower part of a story left with only the background", () => {
    expect(bands([kicker, big, cta])).toEqual([{ kind: "empty_band", level: "aviso", ids: [], text: expect.stringMatching(/^faixa vazia de y 0\.63 a 1 \(38% da altura\)/) }]);
    const shapes = layoutReport(story([kicker, big, cta])).shapes.filter((shape) => shape.kind === "area");
    expect(shapes).toContainEqual({ kind: "area", points: [[0, 0.625], [1, 0.625], [1, 1], [0, 1]], tone: "bad" });
  });

  it("counts a band that a photo, a texture or a decoration crosses as filled", () => {
    const wave: Layer = { id: "wave", type: "shape", shape: "path", path: "M0 0.4 C0.2 0.1 0.4 0.1 0.55 0.35 S0.85 0.6 1 0.3 L1 1 L0 1 Z", fill: "#ffffff", transform: { ...at(0.5, 0.85, 1.02, 0.3), opacity: 0.4 } };
    expect(bands([kicker, big, cta, wave])).toEqual([]);
    const photo: Layer = { id: "photo", type: "image", assetId: "a1", transform: at(0.5, 0.5, 1, 1) };
    expect(bands([photo, kicker, big, cta])).toEqual([]);
  });

  it("leaves the open space beside a strong hero alone", () => {
    const house = text("house", at(0.5, 0.1, 0.7, 0.04), 0.026, { align: "center", text: "MAISON ÉLAN" });
    const hero = text("hero", at(0.5, 0.6, 0.8, 0.14), 0.12, { align: "center", text: "Aurora" });
    expect(bands([house, hero], surface)).toEqual([]);
  });
});

const misaligned = (layers: Layer[]) => kinds(layers).filter((kind) => kind.startsWith("misalign"));

describe("symmetry and centering", () => {
  const centered = (id: string, y: number, value: string, size: number) => text(id, at(0.5, y, 0.84, 0.08), size, { align: "center", text: value });
  const headline = centered("headline", 0.12, "Fone Aurora", 0.075);
  const sub = centered("sub", 0.2, "Som que acompanha você", 0.035);
  const button = rect("cta", at(0.5, 0.85, 0.44, 0.07), "#0f172a");
  const label = text("cta_text", at(0.5, 0.85, 0.4, 0.05), 0.032, { align: "center", text: "Comprar agora" });
  const symmetry = (layers: Layer[]) => placed(layers).filter((finding) => finding.kind === "symmetry");

  it("notes a composition where every element sits on the vertical axis, as information only", () => {
    expect(symmetry([headline, sub, button, label])).toEqual([{ kind: "symmetry", level: "aviso", ids: ["headline", "sub", "cta", "cta_text"], text: "a composição está toda centrada no eixo vertical (headline, sub, cta, cta_text); isso tende a ler estático, pode ser intencional" }]);
  });

  it("notes a left and right mirror, pairing elements by their reflected centers even when their words differ", () => {
    const card = (id: string, x: number) => rect(id, at(x, 0.6, 0.36, 0.2), "#172554");
    const name = (id: string, x: number, value: string) => text(id, at(x, 0.6, 0.3, 0.05), 0.036, { align: "center", text: value });
    const layers = [headline, card("card1", 0.29), card("card2", 0.71), name("name1", 0.29, "Ana Lima"), name("name2", 0.71, "Rui Costa")];
    expect(symmetry(layers)).toEqual([{ kind: "symmetry", level: "aviso", ids: ["headline", "card1", "card2", "name1", "name2"], text: "a composição está espelhada entre esquerda e direita (card1 e card2, name1 e name2; no eixo: headline); isso tende a ler estático, pode ser intencional" }]);
  });

  it("stays quiet when one element breaks the axis or there are too few elements to call it a composition", () => {
    const badge = rect("badge", at(0.82, 0.27, 0.2, 0.16), "#dc2626");
    expect(symmetry([headline, sub, button, label, badge])).toEqual([]);
    expect(symmetry([headline, sub])).toEqual([]);
    expect(symmetry([title, subtitle, button])).toEqual([]);
  });

  it("only reads it on a still artboard, not on every sampled frame of a video", () => {
    const scene = { ...imageScene(surface([headline, sub, button, label])), still: false };
    expect(sceneLayout(scene).findings.filter((finding) => finding.kind === "symmetry")).toEqual([]);
  });
});

describe("center and middle matches only count between comparable neighbours", () => {
  const doors = [0.12, 0.32, 0.52, 0.72].map((x, i) => rect(`door${i + 1}`, at(x, 0.6, 0.16, 0.42), "#8d6e63"));
  const label = (y: number) => text("label", at(0.9, y, 0.14, 0.06), 0.05, { text: "Sala" });

  it("ignores a short label whose middle sits a few pixels off the middle of tall doors", () => {
    expect(misaligned([...doors, label(0.6 + 14 / 1350)])).toEqual([]);
  });

  it("still flags a middle a few pixels off between a text and a shape of the same height", () => {
    const chip = rect("chip", at(0.3, 0.5, 0.2, 0.06), "#8d6e63");
    expect(misaligned([chip, text("t", at(0.62, 0.5 + 14 / 1350, 0.3, 0.06), 0.05, { text: "Sala" })])).toEqual(["misalign:t,chip"]);
  });

  const centered = (id: string, x: number, y: number) => text(id, at(x, y, 0.6, 0.06), 0.04, { align: "center", text: "Oferta de verão" });

  it("flags a center a few pixels off between two stacked texts with nothing in between", () => {
    expect(misaligned([centered("a", 0.5, 0.2), centered("b", 0.5 + 14 / 1080, 0.8)])).toEqual(["misalign:b,a"]);
  });

  it("ignores that center match when an unrelated element sits between the two texts", () => {
    expect(misaligned([centered("a", 0.5, 0.2), rect("panel", at(0.3, 0.5, 0.5, 0.1)), centered("b", 0.5 + 14 / 1080, 0.8)])).toEqual([]);
  });

  it("keeps edge alignments between elements of very different size", () => {
    const tall = rect("tall", at(0.2, 0.4, 0.2, 0.5));
    expect(misaligned([tall, text("t", at(0.1 + 14 / 1080 + 0.3, 0.85, 0.6, 0.05), 0.035, { text: "Sala" })])).toEqual(["misalign:t,tall"]);
  });
});

describe("strokes that cross a text", () => {
  const stroke = (id: string, shape: "line" | "arrow", transform: Transform): Layer => ({ id, type: "shape", shape, stroke: "#111111", strokeWidth: 6, transform });
  const findings = (layers: Layer[]) => layoutReport(surface(layers)).findings.filter((finding) => finding.kind === "overlap");

  it("sees a full width line running through a text", () => {
    expect(findings([title, stroke("rule", "line", at(0.5, 0.12, 1, 0.01))])).toEqual([{ kind: "overlap", level: "aviso", ids: ["rule", "title"], text: "a linha rule atravessa o texto title; mova um dos dois para que não se cruzem, a menos que o risco seja de propósito" }]);
  });

  it("names an arrow, a thin bar and the border of a frame", () => {
    expect(findings([title, stroke("pointer", "arrow", at(0.5, 0.12, 0.9, 0.02))]).map((f) => f.text)).toEqual([expect.stringMatching(/^a seta pointer atravessa o texto title;/)]);
    expect(findings([title, rect("bar", at(0.5, 0.12, 0.9, 0.006), "#111111")]).map((f) => f.text)).toEqual([expect.stringMatching(/^a barra bar atravessa o texto title;/)]);
    const frame: Layer = { id: "frame", type: "shape", shape: "rect", stroke: "#111111", strokeWidth: 4, transform: at(0.5, 0.2, 0.6, 0.16) };
    expect(findings([title, frame]).map((f) => f.text)).toEqual([expect.stringMatching(/^a borda de frame atravessa o texto title;/)]);
  });

  it("leaves an underline below the letters and a frame around the whole text alone", () => {
    expect(findings([title, stroke("underline", "line", at(0.5, 0.17, 0.84, 0.01))])).toEqual([]);
    const frame: Layer = { id: "frame", type: "shape", shape: "rect", stroke: "#111111", strokeWidth: 4, transform: at(0.5, 0.12, 0.9, 0.2) };
    expect(findings([title, frame])).toEqual([]);
  });
});

describe("the reference line of an alignment warning", () => {
  it("spans only the off layer and its nearest partner, dashed apart from design content", () => {
    const off = { ...subtitle, transform: at(0.515, 0.2, 0.84, 0.05) };
    const footer = text("footer", at(0.5, 0.9, 0.84, 0.04), 0.03);
    const guides = layoutReport(surface([title, off, footer])).shapes.filter((shape) => shape.kind === "guide");
    expect(guides.map((guide) => guide.tone)).toEqual(["ok", "bad"]);
    const [reference, own] = guides as Extract<(typeof guides)[number], { kind: "guide" }>[];
    expect(reference.from[0]).toBeCloseTo(0.08, 3);
    expect(Math.max(reference.from[1], reference.to[1])).toBeLessThan(0.3);
    expect(Math.min(reference.from[1], reference.to[1])).toBeGreaterThan(0.04);
    expect(own.from[0]).toBeCloseTo(0.095, 3);
  });

  it("stops at its partner instead of crossing an unrelated element that sits between the two", () => {
    const caption = text("caption", at(0.515, 0.85, 0.84, 0.05), 0.035, { text: "Peças novas" });
    const door = rect("door", at(0.12, 0.5, 0.16, 0.42), "#8d6e63");
    const guides = layoutReport(surface([title, door, caption])).shapes.filter((shape) => shape.kind === "guide");
    const [reference] = guides as Extract<(typeof guides)[number], { kind: "guide" }>[];
    expect(reference.tone).toBe("ok");
    expect(Math.max(reference.from[1], reference.to[1])).toBeLessThan(0.25);
  });
});
