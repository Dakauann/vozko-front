import { describe, expect, it } from "vitest";

import { gradeBriefRun } from "./brief-grade";

const simple = [
  {
    operations: [
      { op: "update_artboard", artboard_id: "ab-1", background: "#f6efe6" },
      { op: "add_text", ref: "titulo", text: "Café da manhã", font_id: "fraunces", font_weight: 800, font_size: 0.075, fill: "#2b1a10", align: "left", x: 0.42, y: 0.2, w: 0.72, h: 0.18 },
      { op: "add_text", ref: "apoio", text: "Todo sábado, das 8h às 11h", font_id: "dm-sans", font_size: 0.035, fill: "#5a3b28", align: "left", x: 0.42, y: 0.33, w: 0.72, h: 0.06 },
      { op: "add_shape", ref: "botao", shape: "rect", radius: 1, fill: "#2b1a10", x: 0.27, y: 0.86, w: 0.42, h: 0.08 },
      { op: "add_text", ref: "cta", text: "Reserve sua mesa", font_id: "dm-sans", font_weight: 700, font_size: 0.032, fill: "#f6efe6", align: "center", x: 0.27, y: 0.86, w: 0.4, h: 0.06 },
    ],
  },
];

const advanced = [
  {
    operations: [
      { op: "update_artboard", artboard_id: "ab-1", gradient: { kind: "linear", from: "#0b1026", via: "#1b2a6b", to: "#3a1c71", angle: 90 } },
      { op: "add_shape", ref: "halo", shape: "ellipse", x: 0.5, y: 0.45, w: 0.9, h: 0.72, gradient: { kind: "radial", from: "#7c5cff99", to: "#7c5cff00" }, blend_mode: "screen" },
      { op: "add_shape", ref: "cartao", shape: "rect", radius: 0.15, fill: "#ffffff", x: 0.5, y: 0.5, w: 0.72, h: 0.42 },
      { op: "update_layer", layer_id: "@cartao", effects: [{ type: "drop-shadow", color: "#0b102659", x: 6, y: 10, blur: 18 }, { type: "drop-shadow", color: "#0b102633", x: 18, y: 30, blur: 60 }] },
      { op: "add_text", ref: "preco", text: "R$ 49,90", font_id: "space-grotesk", font_weight: 700, font_size: 0.09, fill: "#0b1026", align: "center", x: 0.5, y: 0.47, w: 0.62, h: 0.12 },
      { op: "add_text", ref: "plano", text: "Plano mensal", font_id: "space-grotesk", font_size: 0.036, fill: "#3a3f5c", align: "center", x: 0.5, y: 0.6, w: 0.62, h: 0.06 },
      { op: "add_text", ref: "titulo", text: "Treine sem limite", font_id: "space-grotesk", font_weight: 800, font_size: 0.07, fill: "#ffffff", align: "center", x: 0.5, y: 0.15, w: 0.86, h: 0.1, shadow: { color: "#00000059", blur: 18, x: 0, y: 6 } },
      { op: "add_vfx", artboard_id: "ab-1", vfx_kind: "grain", vfx_seed: 7, vfx_params: { amount: 0.25 } },
    ],
  },
];

const curvy = [
  {
    operations: [
      { op: "update_artboard", artboard_id: "ab-1", background: "#fff4ea" },
      {
        op: "add_shape",
        ref: "bolha",
        shape: "path",
        path: "M0.5 0.02 C0.8 0.02 0.98 0.25 0.96 0.52 C0.94 0.82 0.7 0.98 0.45 0.96 C0.18 0.94 0.02 0.74 0.04 0.47 C0.06 0.2 0.24 0.02 0.5 0.02 Z",
        fill: "#ffb38a",
        x: 0.66,
        y: 0.42,
        w: 0.7,
        h: 0.56,
      },
      { op: "add_shape", ref: "onda", shape: "path", path: "M0 0.35 C0.17 0.05 0.33 0.05 0.5 0.35 S0.83 0.65 1 0.35 L1 1 L0 1 Z", fill: "#ff7a45", x: 0.5, y: 0.92, w: 1.02, h: 0.18 },
      { op: "add_shape", ref: "selo", shape: "path", path: "M0.5 0 C0.92 0 1 0.08 1 0.5 C1 0.92 0.92 1 0.5 1 C0.08 1 0 0.92 0 0.5 C0 0.08 0.08 0 0.5 0 Z", fill: "#2d1b4e", x: 0.8, y: 0.2, w: 0.2, h: 0.16 },
      { op: "add_shape", ref: "linha", shape: "path", path: "M0 0.8 C0.3 0.1 0.7 0.1 1 0.6", fill: "#00000000", stroke: "#2d1b4e", stroke_width: 6, arrow_end_kind: "openArrow", x: 0.36, y: 0.56, w: 0.3, h: 0.12 },
      { op: "add_text", ref: "titulo", text: "Verão leve", font_id: "fraunces", font_weight: 800, font_size: 0.08, fill: "#2d1b4e", align: "left", x: 0.36, y: 0.32, w: 0.62, h: 0.2 },
      { op: "add_text", text: "Coleção nova nas lojas", font_id: "dm-sans", font_size: 0.034, fill: "#2d1b4e", align: "left", x: 0.36, y: 0.46, w: 0.62, h: 0.06 },
    ],
  },
];

const diagonal = [
  {
    operations: [
      { op: "update_artboard", artboard_id: "ab-1", background: "#111111" },
      { op: "add_shape", ref: "faixa", shape: "rect", fill: "#ffd400", rotation: -12, x: 0.5, y: 0.55, w: 1.45, h: 0.16 },
      { op: "add_text", ref: "titulo", text: "BLACK FRIDAY", font_id: "anton", font_size: 0.085, fill: "#111111", align: "center", rotation: -12, x: 0.5, y: 0.55, w: 0.8, h: 0.1 },
      { op: "add_shape", ref: "veloc", shape: "rect", fill: "#ffd400", opacity: 0.5, rotation: -12, x: 0.3, y: 0.3, w: 0.36, h: 0.006 },
      { op: "add_text", ref: "data", text: "Só até domingo", font_id: "dm-sans", font_weight: 700, font_size: 0.036, fill: "#ffffff", align: "left", x: 0.32, y: 0.85, w: 0.5, h: 0.06 },
    ],
  },
];

describe("design briefs the editor must take as Elo would send them", () => {
  it("builds a simple poster without a single error line", () => {
    const grade = gradeBriefRun(simple);
    expect(grade.failures).toEqual([]);
    expect(grade.ignored).toEqual([]);
    expect(grade.errors).toEqual([]);
    expect(grade.layers).toBe(4);
  });

  it("builds an advanced layered piece with a two shadow elevation that shares one light", () => {
    const grade = gradeBriefRun(advanced);
    expect(grade.failures).toEqual([]);
    expect(grade.ignored).toEqual([]);
    expect(grade.errors).toEqual([]);
    const card = grade.document.artboards[0].layers.find((layer) => layer.effects?.length === 2);
    expect(card?.effects?.every((effect) => effect.x > 0 && effect.y > 0)).toBe(true);
    expect(grade.document.artboards[0].canvas.vfx?.length).toBe(1);
  });

  it("builds a curvy piece out of continuous vector paths", () => {
    const grade = gradeBriefRun(curvy);
    expect(grade.failures).toEqual([]);
    expect(grade.ignored).toEqual([]);
    expect(grade.errors).toEqual([]);
    expect(grade.paths).toBe(4);
  });

  it("builds a diagonal piece where every tilted element shares one angle", () => {
    const grade = gradeBriefRun(diagonal);
    expect(grade.failures).toEqual([]);
    expect(grade.ignored).toEqual([]);
    expect(grade.errors).toEqual([]);
    expect(grade.angles).toEqual([{ degrees: -12, ids: expect.any(Array) }]);
    expect(grade.angles[0].ids).toHaveLength(3);
    expect(grade.angleNotes).toEqual([]);
  });

  it("catches a batch that would fail in the editor and an angle that is almost parallel", () => {
    const broken = gradeBriefRun([{ operations: [{ op: "add_shape", shape: "path", path: "M0 0 Q", x: 0.5, y: 0.5, w: 0.2, h: 0.2 }] }]);
    expect(broken.ok).toBe(false);
    const sloppy = gradeBriefRun([
      {
        operations: [
          { op: "add_shape", shape: "rect", fill: "#ffd400", rotation: -12, x: 0.5, y: 0.55, w: 1.45, h: 0.16 },
          { op: "add_shape", shape: "rect", fill: "#ffd400", rotation: -14, x: 0.3, y: 0.3, w: 0.36, h: 0.01 },
        ],
      },
    ]);
    expect(sloppy.angleNotes).toHaveLength(1);
  });

  it("maps the ids the eval editor invented back to the real ones in later batches", () => {
    const grade = gradeBriefRun([
      { operations: [{ op: "add_shape", ref: "caixa", shape: "rect", fill: "#ffffff", x: 0.5, y: 0.5, w: 0.3, h: 0.3 }] },
      { operations: [{ op: "update_layer", layer_id: "caixa-eval", fill: "#000000" }] },
    ]);
    expect(grade.failures).toEqual([]);
    expect(grade.document.artboards[0].layers[0].fill).toBe("#000000");
  });
});
