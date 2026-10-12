import type { ImageSurface, VideoDocument } from "../document";
import type { TextMeasure } from "./text-ink";
import { sceneDepth } from "./depth-report";
import { sceneLayout } from "./layout-report";
import type { LookView } from "./look-views";
import { motionReport, type MotionWindow } from "./motion-report";
import { findingLines, rounded, type PerceptionFinding, type PerceptionShape } from "./perception";
import { imageScene, videoSceneAt, type SceneGround } from "./scene";

export interface LookReports {
  data: Record<string, unknown>;
  shapes: PerceptionShape[];
}

interface SceneReport {
  report: Record<string, unknown> | null;
  findings: PerceptionFinding[];
  shapes: PerceptionShape[];
}

function sceneReport(view: LookView, scene: SceneGround, measure: TextMeasure): SceneReport {
  if (view === "wireframe") return { report: null, findings: [], shapes: [] };
  if (view === "depth") {
    const depth = sceneDepth(scene);
    return { report: { light: depth.light, shadows: depth.shadows, covered: depth.covered, findings: findingLines(depth.findings) }, findings: depth.findings, shapes: depth.shapes };
  }
  const layout = sceneLayout(scene, measure);
  if (view === "guides") return { report: { margins: layout.margins, levels: layout.levels, reading: layout.reading, balance: layout.balance, findings: findingLines(layout.findings) }, findings: layout.findings, shapes: layout.shapes };
  return { report: null, findings: [...sceneDepth(scene).findings, ...layout.findings], shapes: [] };
}

const REPORT_KEYS: Partial<Record<LookView, string>> = { depth: "depth", guides: "layout" };

export interface PerceptionLayers {
  depth: boolean;
  layout: boolean;
}

export function perceptionShapes(scene: SceneGround, layers: PerceptionLayers, measure: TextMeasure): PerceptionShape[] {
  return [...(layers.depth ? sceneDepth(scene).shapes : []), ...(layers.layout ? sceneLayout(scene, measure).shapes : [])];
}

export function lookReports(view: LookView, surface: ImageSurface, measure: TextMeasure): LookReports {
  const { report, findings, shapes } = sceneReport(view, imageScene(surface), measure);
  const key = REPORT_KEYS[view];
  if (key && report) return { data: { [key]: report }, shapes };
  const alerts = view === "render" ? findingLines(findings) : [];
  return { data: alerts.length > 0 ? { alerts } : {}, shapes };
}

export interface VideoLookReports {
  data: Record<string, unknown>;
  shapes: PerceptionShape[][];
}

export function videoLookReports(view: LookView, doc: VideoDocument, times: readonly number[], window: MotionWindow | null, measure: TextMeasure): VideoLookReports {
  const frames = times.map((atMs) => ({ atMs, ...sceneReport(view, videoSceneAt(doc, atMs), measure) }));
  const motion = motionReport(doc, window);
  const key = REPORT_KEYS[view];
  const perFrame = key ? { [key]: frames.map(({ atMs, report }) => ({ at_ms: atMs, ...report })) } : {};
  const motionData = window ? { motion_report: { moves: motion.moves, ...(motion.variety ? { variety: motion.variety } : {}), findings: findingLines(motion.findings) } } : {};
  const frameAlerts = view === "render" ? frames.flatMap(({ atMs, findings }) => findingLines(findings).map((line) => line.replace(/^(erro|aviso): /, `$1: em ${rounded(atMs / 1000, 1)} s: `))) : [];
  const alerts = window ? frameAlerts : [...findingLines(motion.findings), ...frameAlerts];
  return { data: { ...perFrame, ...motionData, ...(alerts.length > 0 ? { alerts } : {}) }, shapes: frames.map(({ shapes }) => shapes) };
}
