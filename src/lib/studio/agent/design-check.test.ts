import { describe, expect, it } from "vitest";

import { emptyArtboard, emptyVideoDocument, newShapeLayer, newTextLayer, type ImageSurface, type Layer, type Transform, type VideoDocument } from "../document";
import { overlayClip } from "../media-clips";
import { imageDesignChecks, MAX_CHECK_LINES, videoDesignChecks } from "./design-check";

const box = (x: number, y: number, w: number, h: number): Transform => ({ x, y, w, h, rotation: 0, opacity: 1 });

function text(id: string, words: string, patch: Partial<Layer> = {}): Layer {
  return { ...newTextLayer(words, "heading", box(0.5, 0.5, 0.8, 0.14)), id, fontSize: 0.07, fill: "#111111", ...patch };
}

function shape(id: string, fill: string, transform: Transform = box(0.5, 0.5, 1, 1)): Layer {
  return { ...newShapeLayer("rect", transform), id, fill };
}

function art(layers: Layer[], background = "#ffffff"): ImageSurface {
  return { ...emptyArtboard({ width: 1080, height: 1080 }, background), layers };
}

function joined(lines: string[]): string {
  return lines.join("\n");
}

describe("image design checks", () => {
  it("stays quiet for a clean, legible composition", () => {
    expect(imageDesignChecks(art([text("t", "Oferta")]))).toEqual([]);
  });

  it("flags text hidden behind an opaque layer stacked above it", () => {
    const report = joined(imageDesignChecks(art([text("t", "Oferta"), shape("bg", "#0b0f12")])));
    expect(report).toContain("erro");
    expect(report).toContain("t");
    expect(report).toContain("atrás de bg");
  });

  it("measures contrast against what is really behind the text", () => {
    expect(joined(imageDesignChecks(art([text("t", "Tempo de menos", { fill: "#12b5a5", fontSize: 0.04 })])))).toContain("contraste");
    expect(imageDesignChecks(art([shape("bg", "#0b0f12"), text("t", "Oferta", { fill: "#ffffff" })]))).toEqual([]);
  });

  it("flags a heavy black shadow that turns into a smudge on a dark background", () => {
    const smudge = text("t", "Uma plataforma", { fill: "#ffffff", shadow: { color: "#000000", blur: 18, x: 0, y: 4 } });
    expect(joined(imageDesignChecks(art([shape("bg", "#0b0f12"), smudge])))).toContain("sombra");
  });

  it("flags tiny text, text leaving the art and text that does not fit its box", () => {
    expect(joined(imageDesignChecks(art([text("t", "Oferta", { fontSize: 0.015 })])))).toContain("pequeno");
    expect(joined(imageDesignChecks(art([text("t", "Oferta", { transform: box(0.95, 0.5, 0.4, 0.14) })])))).toContain("sai da arte");
    const long = "Uma plataforma unificada com CRM ligações Meta Ads editor de vídeo e agentes de inteligência artificial";
    expect(joined(imageDesignChecks(art([text("t", long, { transform: box(0.5, 0.5, 0.5, 0.1) })])))).toContain("não cabe");
  });

  it("flags texts drawn on top of each other", () => {
    expect(joined(imageDesignChecks(art([text("a", "Oferta"), text("b", "Hoje")])))).toContain("se sobrepõem");
  });

  it("keeps the report short", () => {
    const crowd = Array.from({ length: 30 }, (_, i) => text(`t${i}`, "Oferta", { fontSize: 0.015 }));
    const report = imageDesignChecks(art(crowd));
    expect(report.length).toBeLessThanOrEqual(MAX_CHECK_LINES + 1);
    expect(report[report.length - 1]).toContain("mais");
  });
});

function film(): VideoDocument {
  const d = emptyVideoDocument("square");
  d.durationMs = 6000;
  return d;
}

function timed(layer: Layer, startMs: number, durationMs: number, transform: Transform) {
  return { ...overlayClip(layer, startMs, transform), id: layer.id, startMs, durationMs };
}

describe("video design checks", () => {
  it("flags a background that covers a text while both are on screen", () => {
    const d = film();
    d.tracks = [
      { id: "v1", kind: "visual", clips: [timed(text("t", "Ferramentas soltas"), 0, 3000, box(0.5, 0.4, 0.88, 0.18))] },
      { id: "v2", kind: "visual", clips: [timed(shape("bg", "#0b0f12"), 1000, 4000, box(0.5, 0.5, 1, 1))] },
    ];
    const report = joined(videoDesignChecks(d));
    expect(report).toContain("atrás de bg");
    expect(report).toMatch(/em \d+(\.\d)? s/);
  });

  it("flags a text that leaves the screen before it can be read", () => {
    const d = film();
    d.tracks = [{ id: "v1", kind: "visual", clips: [timed(text("t", "Gerencie campanhas crie vídeos e atenda clientes em um só lugar"), 0, 900, box(0.5, 0.5, 0.9, 0.3))] }];
    expect(joined(videoDesignChecks(d))).toContain("pouco tempo");
  });

  it("does not ask subtitles to stay longer than the speech they follow", () => {
    const d = film();
    const cue = (i: number) => timed(text(`c${i}`, "vamos falar de como vender mais", { fill: "#ffffff", stroke: "#000000", strokeWidth: 6, fontSize: 0.04 }), i * 800, 800, box(0.5, 0.6, 0.9, 0.1));
    d.tracks = [{ id: "v1", kind: "visual", name: "Legendas", clips: [0, 1, 2, 3].map(cue) }];
    expect(joined(videoDesignChecks(d))).not.toContain("pouco tempo");
  });

  it("stays quiet when texts sit above their background", () => {
    const d = film();
    d.tracks = [
      { id: "v1", kind: "visual", clips: [timed(shape("bg", "#0b0f12"), 0, 6000, box(0.5, 0.5, 1, 1))] },
      { id: "v2", kind: "visual", clips: [timed(text("t", "Uma plataforma", { fill: "#ffffff" }), 500, 3000, box(0.5, 0.45, 0.9, 0.18))] },
    ];
    expect(videoDesignChecks(d)).toEqual([]);
  });
});
