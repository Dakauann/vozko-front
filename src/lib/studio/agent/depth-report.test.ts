import { describe, expect, it } from "vitest";

import type { ImageSurface, Layer, Transform } from "../document";
import type { Effect } from "../layer-paint";
import { depthReport } from "./depth-report";

const at = (x: number, y: number, w: number, h: number, rotation = 0): Transform => ({ x, y, w, h, rotation, opacity: 1 });
const drop = (x: number, y: number, extra: Partial<Effect> = {}): Effect => ({ id: "d", type: "drop-shadow", color: "#5a3a1a", opacity: 0.22, x, y, blur: 30, spread: 0, ...extra });
const card = (id: string, transform: Transform, effects: Effect[] = [drop(0, 14)]): Layer => ({ id, type: "shape", shape: "rect", fill: "#ffffff", transform, effects });
const label = (id: string, transform: Transform): Layer => ({ id, type: "text", text: "Malhas", fontSize: 0.03, fill: "#2b1d12", transform });

function surface(layers: Layer[], background = "#f4efe6"): ImageSurface {
  return { canvas: { width: 1080, height: 1350, background }, layers };
}

const row = [card("a", at(0.21, 0.48, 0.26, 0.36)), card("b", at(0.5, 0.48, 0.26, 0.36)), card("c", at(0.79, 0.48, 0.26, 0.36))];

function kinds(doc: ImageSurface): string[] {
  return depthReport(doc).findings.map((finding) => `${finding.kind}:${finding.ids.join(",")}`);
}

describe("depth report", () => {
  it("states the light of a consistent set of shadows and finds nothing wrong", () => {
    const report = depthReport(surface(row));
    expect(report.findings).toEqual([]);
    expect(report.light).toMatch(/^3 sombras caem para baixo \(90°\), concordância 1$/);
    expect(report.shadows).toHaveLength(3);
  });

  it("blames the shadow that falls against the others", () => {
    const flipped = [row[0], card("b", at(0.5, 0.48, 0.26, 0.36), [drop(0, -14)]), row[2]];
    expect(kinds(surface(flipped))).toEqual(["shadow_direction:b"]);
  });

  it("draws one arrow per shadow, marking the one against the light, and the edge that cuts a shadow", () => {
    const flipped = [row[0], card("b", at(0.5, 0.48, 0.26, 0.36), [drop(0, -14)]), card("c", at(0.79, 0.961, 0.26, 0.07))];
    const { shapes } = depthReport(surface(flipped));
    expect(shapes.filter((s) => s.kind === "arrow").map((s) => s.tone)).toEqual(["ok", "bad", "ok"]);
    expect(shapes.filter((s) => s.kind === "segment")).toEqual([{ kind: "segment", from: [0.66, 1], to: [0.92, 1], tone: "bad" }]);
  });

  it("explains a shadow that turned with its tilted layer", () => {
    const turned = [row[0], row[1], card("c", at(0.79, 0.48, 0.26, 0.36, 60))];
    const [finding] = depthReport(surface(turned)).findings;
    expect(finding.kind).toBe("shadow_direction");
    expect(finding.text).toContain("gira junto com a camada");
  });

  it("finds a shadow the artboard edge cuts while the layer itself stays inside", () => {
    const low = [row[0], row[1], card("c", at(0.79, 0.961, 0.26, 0.07))];
    expect(kinds(surface(low))).toContain("shadow_clipped:c");
    const bleeding = [row[0], row[1], card("c", at(0.79, 0.99, 0.26, 0.07))];
    expect(kinds(surface(bleeding))).not.toContain("shadow_clipped:c");
  });

  it("finds an opaque black shadow", () => {
    const heavy = [card("a", at(0.21, 0.48, 0.26, 0.36), [drop(0, 26, { color: "#000000", opacity: 1, blur: 4 })]), row[1], row[2]];
    expect(kinds(surface(heavy))).toEqual(["shadow_heavy:a"]);
  });

  it("finds a dark shadow lost on a dark ground", () => {
    const dark = surface([{ ...row[0], fill: "#172554", effects: [drop(0, 14, { color: "#000000", opacity: 0.5 })] }], "#0b1026");
    expect(kinds(dark)).toEqual(["shadow_invisible:a"]);
  });

  it("finds a neutral gray shadow on a saturated ground", () => {
    const orange = surface([{ ...row[0], effects: [drop(10, 16, { color: "#000000", opacity: 0.32 })] }], "#f97316");
    expect(kinds(orange)).toEqual(["shadow_neutral:a"]);
    const tinted = surface([{ ...row[0], effects: [drop(10, 16, { color: "#7c2d12", opacity: 0.3 })] }], "#f97316");
    expect(kinds(tinted)).toEqual([]);
  });

  it("reads the ground right under the edge a tilted layer casts from, not a far corner of its upright box", () => {
    const band: Layer = { id: "band", type: "shape", shape: "rect", fill: "#ff3c00", transform: at(0.5, 0.5, 1.6, 0.28, -12) };
    const title: Layer = { id: "title", type: "shape", shape: "rect", fill: "#ffffff", transform: at(0.5, 0.465, 1, 0.12, -12), effects: [drop(8, 10, { color: "#3d0d00", opacity: 0.3, blur: 20 })] };
    expect(kinds(surface([band, title], "#0b0f19"))).toEqual([]);
    const ball: Layer = { id: "ball", type: "shape", shape: "ellipse", fill: "#ff7a00", transform: at(0.86, 0.12, 0.16, 0.128, -12), effects: [drop(8, 10, { color: "#000000", opacity: 0.4, blur: 20 })] };
    expect(kinds(surface([band, ball], "#0b0f19"))).toEqual(["shadow_invisible:ball"]);
  });

  it("lists what each opaque layer hides and blames a small layer hidden under a bigger one", () => {
    const hidden = surface([row[0], label("label", at(0.5, 0.58, 0.22, 0.05)), row[1]]);
    const report = depthReport(hidden);
    expect(report.covered).toEqual(['label (texto "Malhas") 100% coberto por b, que está acima']);
    expect(report.findings.map((finding) => finding.kind)).toEqual(["hidden_layer"]);
  });

  it("does not blame a full bleed background a band covers in part", () => {
    const photo: Layer = { id: "photo", type: "image", assetId: "p", transform: at(0.5, 0.3, 1, 0.6) };
    const band: Layer = { id: "band", type: "shape", shape: "rect", fill: "#0f172a", transform: at(0.5, 0.8, 1, 0.4) };
    expect(depthReport(surface([photo, band])).findings).toEqual([]);
  });
});
