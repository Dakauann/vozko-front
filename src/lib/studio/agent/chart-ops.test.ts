import { describe, expect, it } from "vitest";

import { emptyVideoDocument, imageDocument, type ImageDocument, type VideoDocument } from "../document";
import { findClip } from "../timeline";
import { documentIssue } from "../validate";
import { planBatch } from "./batch";
import { chartAnimatorFrom, chartOutline, chartSpecFrom } from "./chart-ops";
import { applyImageOperation, IMAGE_ID_FIELDS, imageIds, type ImageOpContext, type ImageOperation } from "./image-ops";
import { imageOutline, outlineClip } from "./outline";
import { applyVideoOperation, VIDEO_ID_FIELDS, videoIds, type VideoOpContext, type VideoOperation } from "./video-ops";

const IMAGE_CTX: ImageOpContext = { naturalSize: () => undefined, icons: [], activeArtboard: "a1" };

const VIDEO_CTX: VideoOpContext = {
  playheadMs: 500,
  magnetic: false,
  mediaType: () => null,
  sourceDuration: () => undefined,
  captions: () => undefined,
  captionTrackName: "Legendas",
  icons: [],
  speech: () => undefined,
  loudness: () => undefined,
};

const SALES = {
  chart_kind: "barGrouped",
  chart_labels: ["Jan", "Fev", "Mar"],
  chart_series: [
    { name: "2025", values: [120, 180, null] },
    { name: "2026", values: [140, 210, 190] },
  ],
};

function artboard(styles?: ImageDocument["styles"]): ImageDocument {
  return { ...imageDocument([{ id: "a1", x: 0, y: 0, canvas: { width: 1000, height: 1000, background: "#ffffff" }, layers: [] }]), ...(styles ? { styles } : {}) };
}

function image(ops: ImageOperation[], start: ImageDocument = artboard()) {
  return planBatch(start, ops, (doc, op) => applyImageOperation(doc, op, IMAGE_CTX), IMAGE_ID_FIELDS, imageIds);
}

function video(ops: VideoOperation[], start: VideoDocument = emptyVideoDocument("landscape")) {
  return planBatch(start, ops, (doc, op) => applyVideoOperation(doc, op, VIDEO_CTX), VIDEO_ID_FIELDS, videoIds);
}

describe("chart operations in the image editor", () => {
  it("adds a chart layer with the data, style and number format asked", () => {
    const plan = image([{ op: "add_chart", ref: "grafico", ...SALES, chart_style: { legend: "top", value_labels: true }, chart_format: { prefix: "R$ ", decimals: 1 }, x: 0.5, y: 0.4, w: 0.8, name: "Vendas" }]);
    if (!plan.ok) throw new Error(plan.reason);
    const layer = plan.final.artboards[0].layers[0];
    expect(layer).toMatchObject({ type: "chart", name: "Vendas" });
    expect(layer.transform).toMatchObject({ x: 0.5, y: 0.4, w: 0.8 });
    expect(layer.chart).toMatchObject({ kind: "barGrouped", data: { labels: ["Jan", "Fev", "Mar"] }, style: { legend: "top", valueLabels: true, textColor: "#111111" }, format: { prefix: "R$ ", decimals: 1, locale: "pt-BR" } });
    expect(layer.chart!.data.series[0].values).toEqual([120, 180, null]);
    expect(plan.created.grafico).toEqual([layer.id]);
    expect(documentIssue("image", plan.final)).toBeNull();
  });

  it("takes its colors from the project color styles when there are any", () => {
    const plan = image([{ op: "add_chart", ...SALES }], artboard([{ id: "brand", kind: "color", name: "Marca", color: "#ff0066" }]));
    if (!plan.ok) throw new Error(plan.reason);
    expect(plan.final.artboards[0].layers[0].chart!.style.palette[0]).toBe("#ff0066");
  });

  it("updates only what is sent and keeps the rest", () => {
    const plan = image([
      { op: "add_chart", ref: "grafico", ...SALES, chart_format: { prefix: "R$ " } },
      { op: "update_chart_data", layer_id: "@grafico", chart_series: [{ name: "2025", values: [1, 2, 3] }], chart_kind: "pie" },
    ]);
    if (!plan.ok) throw new Error(plan.reason);
    const chart = plan.final.artboards[0].layers[0].chart!;
    expect(chart.kind).toBe("pie");
    expect(chart.data).toEqual({ labels: ["Jan", "Fev", "Mar"], series: [{ name: "2025", values: [1, 2, 3] }] });
    expect(chart.format).toMatchObject({ prefix: "R$ ", percent: true });
    expect(chart.style.legend).toBe("right");
  });

  it("expands a chart into plain shapes and text", () => {
    const plan = image([{ op: "add_chart", ref: "grafico", ...SALES }, { op: "expand_chart", layer_id: "@grafico" }]);
    if (!plan.ok) throw new Error(plan.reason);
    const layers = plan.final.artboards[0].layers;
    expect(layers.some((layer) => layer.type === "chart")).toBe(false);
    expect(layers.some((layer) => layer.type === "text" && layer.text === "Jan")).toBe(true);
    expect(documentIssue("image", plan.final)).toBeNull();
  });

  it("refuses what would draw nothing or break the chart", () => {
    const refusals: [ImageOperation, string][] = [
      [{ op: "add_chart", chart_kind: "bar" }, "chart_labels"],
      [{ op: "add_chart", ...SALES, chart_kind: "stream" }, "chart_kind"],
      [{ op: "add_chart", ...SALES, chart_series: [{ name: "x", values: [1] }] }, "3 valores"],
      [{ op: "add_chart", ...SALES, chart_kind: "scatter", chart_series: [{ name: "x", values: [1, 2, 3] }] }, "scatter"],
      [{ op: "add_chart", ...SALES, chart_style: { legend: "left" } }, "legend"],
      [{ op: "add_chart", ...SALES, chart_style: { font_size: 0.5 } }, "inválido"],
      [{ op: "add_chart", ...SALES, chart_format: { locale: "fr-FR" } }, "locale"],
      [{ op: "update_chart_data", layer_id: "nope", chart_kind: "bar" }, "não existe"],
    ];
    for (const [op, reason] of refusals) {
      const plan = image([op]);
      expect(plan.ok, JSON.stringify(op)).toBe(false);
      if (!plan.ok) expect(plan.reason).toContain(reason);
    }
  });

  it("refuses update_chart_data on a layer that is not a chart and without changes", () => {
    const plan = image([{ op: "add_text", ref: "t", text: "Oi" }, { op: "update_chart_data", layer_id: "@t", chart_kind: "bar" }]);
    expect(plan.ok).toBe(false);
    const empty = image([{ op: "add_chart", ref: "g", ...SALES }, { op: "update_chart_data", layer_id: "@g" }]);
    expect(empty.ok).toBe(false);
  });

  it("points edits of a drawn chart part to the chart operations", () => {
    const plan = image([{ op: "add_chart", ref: "g", ...SALES }]);
    if (!plan.ok) throw new Error(plan.reason);
    const id = plan.created.g[0];
    const refused = applyImageOperation(plan.final, { op: "update_layer", layer_id: `${id};bar-0-0`, fill: "#000000" }, IMAGE_CTX);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.reason).toContain("update_chart_data");
  });

  it("shows the chart in the outline in the shape the operations take", () => {
    const plan = image([{ op: "add_chart", ...SALES }]);
    if (!plan.ok) throw new Error(plan.reason);
    const outline = imageOutline(plan.final, { detail: "brief", selection: [], activeArtboard: "a1", asset: () => undefined, jobs: [], playheadMs: 0 } as never);
    expect(outline.artboards[0].layers[0].chart).toMatchObject({ kind: "barGrouped", labels: ["Jan", "Fev", "Mar"], series: [{ name: "2025", values: [120, 180, null] }, { name: "2026", values: [140, 210, 190] }], format: { locale: "pt-BR", decimals: 0, percent: false } });
  });
});

describe("chart operations in the video editor", () => {
  it("adds a chart overlay at the asked time and animates it", () => {
    const plan = video([
      { op: "add_chart", ref: "grafico", ...SALES, at_ms: 1000, duration_ms: 4000 },
      { op: "animate_chart", clip_id: "@grafico", chart_entrance: "grow", chart_order: "category", duration_ms: 600, stagger_ms: 100, easing: "backOut" },
    ]);
    if (!plan.ok) throw new Error(plan.reason);
    const clip = findClip(plan.final, plan.created.grafico[0])!.clip;
    expect(clip).toMatchObject({ type: "overlay", startMs: 1000, durationMs: 4000 });
    expect(clip.layer).toMatchObject({ type: "chart", chart: { kind: "barGrouped", style: { textColor: "#ffffff" } } });
    expect(clip.chartIn).toEqual({ style: "grow", order: "category", durationMs: 600, staggerMs: 100, easing: "backOut" });
    expect(documentIssue("video", plan.final)).toBeNull();
    const outline = outlineClip(clip, { detail: "brief", selection: [], asset: () => undefined, jobs: [], playheadMs: 0 } as never);
    expect(outline.chart?.labels).toEqual(["Jan", "Fev", "Mar"]);
    expect(outline.chart_animation).toEqual({ entrance: "grow", order: "category", duration_ms: 600, stagger_ms: 100, easing: "backOut" });
  });

  it("changes the data of a chart clip and removes its animation with none", () => {
    const plan = video([
      { op: "add_chart", ref: "grafico", ...SALES, at_ms: 0 },
      { op: "animate_chart", clip_id: "@grafico", chart_entrance: "fade" },
      { op: "update_chart_data", clip_id: "@grafico", chart_labels: ["A", "B", "C"] },
      { op: "animate_chart", clip_id: "@grafico", chart_entrance: "none" },
    ]);
    if (!plan.ok) throw new Error(plan.reason);
    const clip = findClip(plan.final, plan.created.grafico[0])!.clip;
    expect(clip.layer?.chart?.data.labels).toEqual(["A", "B", "C"]);
    expect(clip.chartIn).toBeUndefined();
  });

  it("refuses animation outside its ranges and on clips that are not charts", () => {
    expect(video([{ op: "add_chart", ref: "g", ...SALES, at_ms: 0 }, { op: "animate_chart", clip_id: "@g", chart_entrance: "grow", duration_ms: 50 }]).ok).toBe(false);
    expect(video([{ op: "add_chart", ref: "g", ...SALES, at_ms: 0 }, { op: "animate_chart", clip_id: "@g" }]).ok).toBe(false);
    expect(video([{ op: "add_text", ref: "t", text: "Oi", at_ms: 0 }, { op: "animate_chart", clip_id: "@t", chart_entrance: "grow" }]).ok).toBe(false);
  });
});

describe("chart argument helpers", () => {
  it("builds a fresh spec with defaults and merges an update", () => {
    const fresh = chartSpecFrom(SALES, null, { locale: "en", ink: "#111111" });
    if (!fresh.ok) throw new Error(fresh.reason);
    expect(fresh.value.format.locale).toBe("en-US");
    const updated = chartSpecFrom({ chart_style: { smooth: true } }, fresh.value, { locale: "pt", ink: "#111111" });
    if (!updated.ok) throw new Error(updated.reason);
    expect(updated.value).toEqual({ ...fresh.value, style: { ...fresh.value.style, smooth: true } });
    expect(chartOutline(updated.value).style.smooth).toBe(true);
  });

  it("keeps the current animation fields when only some are sent", () => {
    const current = { style: "draw" as const, order: "series" as const, durationMs: 900, staggerMs: 200, easing: "easeOut" as const };
    expect(chartAnimatorFrom({ stagger_ms: 50 }, current, "line")).toEqual({ ok: true, value: { ...current, staggerMs: 50 } });
    expect(chartAnimatorFrom({ chart_entrance: "sweep" }, undefined, "pie")).toMatchObject({ ok: true, value: { style: "sweep", order: "category" } });
  });
});
