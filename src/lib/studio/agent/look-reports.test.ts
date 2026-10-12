import { describe, expect, it } from "vitest";

import { perceivedSurface, resolvedSurface } from "../components";
import { emptyVideoDocument, imageDocument, newOverlayClip, type Clip, type Layer, type VideoDocument } from "../document";
import { estimateTextWidth } from "./text-ink";
import { lookReports, videoLookReports } from "./look-reports";

function text(id: string, x: number, y: number): Clip {
  return { ...newOverlayClip({ id: `${id}-layer`, type: "text", text: "Oferta de verão", fontSize: 0.04, fill: "#ffffff", align: "center", transform: { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 } }, 0, 3000, { x, y, w: 0.6, h: 0.06, rotation: 0, opacity: 1 }), id };
}

function film(clips: Clip[]): VideoDocument {
  const doc = emptyVideoDocument("story", "#0f172a");
  doc.tracks = [{ id: "v1", kind: "visual", clips }, ...doc.tracks.slice(1)];
  doc.durationMs = 3000;
  return doc;
}

describe("video look reports", () => {
  it("measures the layout at every sampled frame and draws its marks per frame", () => {
    const doc = film([text("a", 0.5, 0.3), text("b", 0.512, 0.5), text("c", 0.5, 0.6)]);
    const { data, shapes } = videoLookReports("guides", doc, [500, 2000], null, estimateTextWidth);
    expect(data.layout).toEqual([expect.objectContaining({ at_ms: 500, findings: [expect.stringMatching(/^aviso: b está 13 px fora da linha de a, c pelo centro/)] }), expect.objectContaining({ at_ms: 2000 })]);
    expect(shapes).toHaveLength(2);
    expect(shapes[0].length).toBeGreaterThan(0);
  });

  it("brings the frame problems into the plain look as timed alerts", () => {
    const doc = film([text("a", 0.5, 0.3), text("b", 0.512, 0.5), text("c", 0.5, 0.6)]);
    const { data } = videoLookReports("render", doc, [500], null, estimateTextWidth);
    expect(data.alerts).toEqual([expect.stringMatching(/^aviso: em 0.5 s: b está 13 px fora/)]);
  });

  it("carries the motion variety line inside the windowed motion report", () => {
    const moving = { ...text("a", 0.5, 0.3), keyframes: { x: [{ atMs: 0, value: 0.3, easing: "easeOut" as const }, { atMs: 600, value: 0.5, easing: "easeOut" as const }] } };
    const { data } = videoLookReports("render", film([moving]), [500], { fromMs: 0, toMs: 1000 }, estimateTextWidth);
    expect(data.motion_report).toEqual(expect.objectContaining({ variety: "variedade de movimento em 1 clipe animado: 1 easing (easeOut); 1 tipo de entrada (deslize); 1 direção de trajeto (para a direita)" }));
  });
});

describe("image look reports", () => {
  const sales: Layer = {
    id: "bars",
    type: "chart",
    transform: { x: 0.5, y: 0.6, w: 0.78, h: 0.31, rotation: 0, opacity: 1 },
    chart: { kind: "bar", data: { labels: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"], series: [{ name: "Vendas", values: [52, 61, 70, 83, 98, 118] }] }, style: { palette: ["#2563eb"], fontId: "inter", fontSize: 0.05, textColor: "#334155", gridColor: "#e2e8f0", axes: true, gridlines: true, legend: "none", valueLabels: true, barRadius: 0.3, barGap: 0.35, lineWidth: 0.006, smooth: false, points: false, hole: 0.62 }, format: { locale: "pt-BR", decimals: 0, percent: false } },
  };
  const title: Layer = { id: "title", type: "text", text: "Vendas do semestre", fontSize: 0.05, fill: "#0f172a", align: "left", transform: { x: 0.5, y: 0.3, w: 0.78, h: 0.06, rotation: 0, opacity: 1 } };

  it("reads a chart as one element, so its bars, ticks and grid raise no alerts of their own", () => {
    const document = imageDocument([{ id: "post", x: 0, y: 0, canvas: { width: 1080, height: 1350, background: "#f8fafc" }, layers: [title, sales] }]);
    const board = document.artboards[0];
    const alerts = (surface: typeof board) => (lookReports("render", surface, estimateTextWidth).data.alerts as string[] | undefined) ?? [];
    expect(alerts(resolvedSurface(document, board)).some((line) => line.includes("bars;"))).toBe(true);
    expect(alerts(perceivedSurface(document, board)).filter((line) => line.includes("bars;"))).toEqual([]);
  });
});
