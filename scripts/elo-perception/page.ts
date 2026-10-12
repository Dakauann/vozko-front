import { captureArtboard, captureBackdrop, captureVideo, PLAIN_LOOK } from "@/components/studio/agent/frame-capture";
import type { FrameExtractor } from "@/components/studio/video/timeline/frame-extractor";
import { lookPlan } from "@/lib/studio/agent/frames";
import { motionReport } from "@/lib/studio/agent/motion-report";
import { findingLines } from "@/lib/studio/agent/perception";
import { measureText } from "@/components/studio/agent/text-measure";
import { rasterizeRegion } from "@/components/studio/canvas/rasterize";
import type { Artboard, Layer } from "@/lib/studio/document";
import { imageMarkTargets } from "@/lib/studio/agent/marks";
import { legibilityReport } from "@/lib/studio/agent/legibility";
import { imageDesignChecks, videoDesignChecks } from "@/lib/studio/agent/design-check";
import { guideReport } from "@/lib/studio/agent/look-views";

import { perceptionCorpus } from "./corpus";
import { videoCorpus } from "./video-corpus";
import { channelOutputs } from "./channels";

const PROBE_SIZE = 400;

async function darkCentroid(layers: Layer[]): Promise<{ x: number; y: number }> {
  const canvas = await rasterizeRegion(layers, PROBE_SIZE, PROBE_SIZE, { x: 0, y: 0, width: PROBE_SIZE, height: PROBE_SIZE }, { background: "#ffffff" });
  const data = canvas.getContext("2d")!.getImageData(0, 0, PROBE_SIZE, PROBE_SIZE).data;
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let y = 0; y < PROBE_SIZE; y++) {
    for (let x = 0; x < PROBE_SIZE; x++) {
      const i = (y * PROBE_SIZE + x) * 4;
      if (data[i] < 60 && data[i + 1] < 60 && data[i + 2] < 60) {
        sx += x;
        sy += y;
        n += 1;
      }
    }
  }
  return n === 0 ? { x: -1, y: -1 } : { x: Math.round(sx / n), y: Math.round(sy / n) };
}

async function probe(): Promise<Record<string, unknown>> {
  const body = (rotation: number, extra: Partial<Layer>): Layer => ({ id: "probe", type: "shape", shape: "rect", transform: { x: 0.5, y: 0.5, w: 0.3, h: 0.3, rotation, opacity: 1 }, fill: "#ff0000", ...extra });
  const legacy = { shadow: { color: "#000000", blur: 0, x: 0, y: 80 } };
  const effect = { effects: [{ id: "e", type: "drop-shadow" as const, color: "#000000", opacity: 1, x: 0, y: 80, blur: 0, spread: 0 }] };
  return {
    legacyUpright: await darkCentroid([body(0, legacy)]),
    legacyTurned: await darkCentroid([body(90, legacy)]),
    effectUpright: await darkCentroid([body(0, effect)]),
    effectTurned: await darkCentroid([body(90, effect)]),
  };
}

const corpus = perceptionCorpus();

async function render(index: number): Promise<Record<string, unknown>> {
  const item = corpus[index];
  const surface: Artboard = item.artboard;
  const targets = imageMarkTargets(surface);
  const image = await captureArtboard(surface, PLAIN_LOOK, null);
  const marked = await captureArtboard(surface, { view: "render", targets, numbered: true }, null);
  const grid = await captureBackdrop(surface);
  const legibility = legibilityReport(surface, grid);
  const checks = imageDesignChecks(surface, measureText);
  const guides = guideReport(targets, surface.canvas);
  const channels = await channelOutputs(surface, measureText);
  return { id: item.id, image, marked, legibility, checks, guides, channels };
}

const videos = videoCorpus();
const STRIP_FRAMES = 16;
const noFrames = { request: async () => null, cancel: () => undefined } as unknown as FrameExtractor;

async function renderVideo(index: number): Promise<Record<string, unknown>> {
  const item = videos[index];
  const doc = item.doc;
  const plan = lookPlan(doc, { count: 6 });
  if (!plan.ok) throw new Error(plan.reason);
  const strip = Array.from({ length: STRIP_FRAMES }, (_, i) => Math.round(((i + 0.5) * doc.durationMs) / STRIP_FRAMES));
  const look = (times: readonly number[]) => captureVideo(doc, { times, dense: false, region: null, marks: null, view: "render" }, noFrames, new AbortController().signal);
  const sheet = await look(plan.times);
  const film = await look(strip);
  const report = motionReport(doc);
  return {
    id: item.id,
    sheet: sheet.image,
    strip: film.image,
    sheetNotes: sheet.notes,
    stripNotes: film.notes,
    approximate: sheet.approximate,
    checks: videoDesignChecks(doc, measureText),
    motion: { moves: report.moves, findings: findingLines(report.findings) },
    structured: report.findings,
  };
}

declare global {
  interface Window {
    perception: { count: number; videos: number; probe: () => Promise<Record<string, unknown>>; render: (index: number) => Promise<Record<string, unknown>>; renderVideo: (index: number) => Promise<Record<string, unknown>> };
  }
}

window.perception = { count: corpus.length, videos: videos.length, probe, render, renderVideo };
