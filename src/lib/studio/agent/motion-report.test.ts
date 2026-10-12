import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newOverlayClip, type Clip, type Layer, type Transform, type VideoDocument } from "../document";
import type { Keyframe } from "../keyframes";
import type { Effect } from "../layer-paint";
import { motionReport } from "./motion-report";

const at = (x: number, y: number, w = 0.6, h = 0.1): Transform => ({ x, y, w, h, rotation: 0, opacity: 1 });
const key = (atMs: number, value: number, easing: Keyframe["easing"] = "easeOut"): Keyframe => ({ atMs, value, easing });

function text(id: string, value: string, transform: Transform, startMs: number, durationMs: number, extra: Partial<Clip> = {}, layer: Partial<Layer> = {}): Clip {
  return { ...newOverlayClip({ id: `${id}-layer`, type: "text", text: value, fontSize: 0.05, fill: "#ffffff", transform: transform, ...layer }, startMs, durationMs, transform), id, ...extra };
}

function film(clips: Clip[], durationMs = 4000, background = "#1e293b"): VideoDocument {
  const doc = emptyVideoDocument("story", background);
  doc.tracks = [{ id: "v1", kind: "visual", clips }, ...doc.tracks.slice(1)];
  doc.durationMs = durationMs;
  return doc;
}

function kinds(doc: VideoDocument): string[] {
  return motionReport(doc).findings.map((f) => `${f.kind}:${f.ids.join(",")}`);
}

describe("motion report", () => {
  it("summarises each animated clip and finds nothing in a clean slide in", () => {
    const report = motionReport(film([text("t1", "Oferta de verão", at(0.5, 0.4), 0, 3000, { keyframes: { x: [key(0, 0.3), key(600, 0.5)], opacity: [key(0, 0, "linear"), key(300, 1, "linear")] } })]));
    expect(report.findings).toEqual([]);
    expect(report.moves).toEqual(['t1 (texto "Oferta de verão"): x 0.3→0.5 de 0 a 0.6 s (easeOut); opacity 0→1 de 0 a 0.3 s (linear)']);
  });

  it("finds a jump of a third of the frame between two frames", () => {
    expect(kinds(film([text("t1", "Pulo", at(0.5, 0.4), 0, 3000, { keyframes: { x: [key(1000, 0.2, "linear"), key(1033, 0.8, "linear")] } })]))).toContain("motion_jump:t1");
  });

  it("finds a clip that leaves the frame mid animation and comes back, but not an entrance from outside", () => {
    const out = text("t1", "Escapa", at(0.5, 0.4), 0, 3000, { keyframes: { x: [key(500, 0.5, "easeInOut"), key(1200, 0.95, "easeInOut"), key(1900, 0.5, "easeInOut")] } });
    expect(kinds(film([out]))).toContain("leaves_frame:t1");
    const entrance = text("t1", "Entra", at(0.5, 0.4), 0, 3000, { keyframes: { x: [key(0, -0.4), key(600, 0.5)] } });
    expect(kinds(film([entrance]))).not.toContain("leaves_frame:t1");
  });

  it("counts flashes and warns past three per second", () => {
    const blink: Keyframe[] = Array.from({ length: 20 }, (_, i) => key(i * 100, i % 2, "hold"));
    const strobe = { ...newOverlayClip({ id: "s-layer", type: "shape", shape: "rect", fill: "#ffffff", transform: at(0.5, 0.5, 1, 1) }, 0, 2000, at(0.5, 0.5, 1, 1)), id: "strobe", keyframes: { opacity: blink } };
    expect(kinds(film([strobe], 2000, "#000000"))).toContain("flash:strobe");
  });

  it("finds two texts that cross each other while they move", () => {
    const a = text("a", "Primeiro", at(0.5, 0.3), 0, 2000, { keyframes: { y: [key(0, 0.3, "linear"), key(2000, 0.7, "linear")] } });
    const b = text("b", "Segundo", at(0.5, 0.7), 0, 2000, { keyframes: { y: [key(0, 0.7, "linear"), key(2000, 0.3, "linear")] } });
    expect(kinds(film([a, b]))).toContain("moving_overlap:a,b");
  });

  it("points at a long linear move", () => {
    expect(kinds(film([text("t1", "Desliza", at(0.5, 0.4), 0, 3000, { keyframes: { x: [key(0, 0.2, "linear"), key(800, 0.6, "linear")] } })]))).toEqual(["linear_motion:t1"]);
  });

  it("finds the clip whose shadow falls against the light of the others", () => {
    const shadow = (y: number): Effect[] => [{ id: "d", type: "drop-shadow", color: "#000000", opacity: 0.4, x: 0, y, blur: 12, spread: 0 }];
    const clips = [text("a", "Um", at(0.5, 0.2), 0, 1000, { effects: shadow(10) }), text("b", "Dois", at(0.5, 0.2), 1000, 1000, { effects: shadow(10) }), text("c", "Três", at(0.5, 0.2), 2000, 1000, { effects: shadow(-10) })];
    expect(kinds(film(clips, 3000))).toEqual(["shadow_direction:c"]);
  });

  it("counts easings, entrance kinds and travel directions against the animated clips", () => {
    const clips = [
      text("a", "Um", at(0.5, 0.2), 0, 1500, { keyframes: { x: [key(0, 0.3), key(600, 0.5)] } }),
      text("b", "Dois", at(0.5, 0.4), 500, 1500, { keyframes: { scale: [key(0, 0.6, "backOut"), key(500, 1)] } }),
      text("c", "Três", at(0.5, 0.6), 1000, 1500, { keyframes: { y: [key(0, 0.7, "easeInOut"), key(600, 0.6)], opacity: [key(0, 0, "linear"), key(300, 1)] } }),
      text("d", "Quatro", at(0.5, 0.8), 0, 3000),
    ];
    const report = motionReport(film(clips, 3000));
    expect(report.variety).toBe("variedade de movimento em 3 clipes animados: 4 easings (easeOut, backOut, easeInOut, linear); 3 tipos de entrada (deslize, escala, deslize + fade); 2 direções de trajeto (para a direita, para cima)");
    expect(kinds(film(clips, 3000))).toEqual([]);
  });

  it("notes, without forbidding, when every animated clip enters the same way with the same easing", () => {
    const pop = { keyframes: { scale: [key(0, 0.6), key(500, 1)], opacity: [key(0, 0), key(300, 1)] } };
    const clips = [text("a", "Um", at(0.5, 0.5), 0, 1500, pop), text("b", "Dois", at(0.5, 0.5), 1500, 1500, pop), text("c", "Três", at(0.5, 0.5), 3000, 1000, pop)];
    const report = motionReport(film(clips, 4000));
    expect(kinds(film(clips, 4000))).toEqual(["motion_variety:a,b,c"]);
    expect(report.findings[0].text).toBe("os 3 clipes animados entram do mesmo jeito (escala + fade) e usam um só easing (easeOut); isso tende a ler como preset, pode ser intencional");
  });

  it("notes when all travel runs on one axis even with mixed entrances and easings", () => {
    const clips = [
      text("a", "Um", at(0.5, 0.2), 0, 1500, { keyframes: { x: [key(0, 0.3), key(600, 0.5)] } }),
      text("b", "Dois", at(0.5, 0.4), 500, 1500, { keyframes: { x: [key(0, 0.7, "backOut"), key(500, 0.5)], scale: [key(0, 0.8, "backOut"), key(500, 1)] } }),
      text("c", "Três", at(0.5, 0.6), 1000, 1500, { motionIn: { edge: "left", durationMs: 500 } }),
    ];
    expect(motionReport(film(clips, 3000)).findings.map((f) => f.text)).toEqual(["os 3 clipes animados têm todo o trajeto no eixo horizontal; isso tende a ler como preset, pode ser intencional"]);
  });

  it("leaves the variety line out when nothing moves", () => {
    expect(motionReport(film([text("a", "Parado", at(0.5, 0.5), 0, 2000)])).variety).toBeNull();
  });
});
