import { createTranslator } from "use-intl";

import { requestMediaGenerationAction } from "@/app/actions/media-generation";
import { assetNaturalSize } from "@/components/studio/canvas/asset-images";
import { captureArtboard, captureBackdrop, captureVideo, PLAIN_LOOK } from "@/components/studio/agent/frame-capture";
import { createAgentPresence } from "@/components/studio/agent/presence";
import { measureText } from "@/components/studio/agent/text-measure";
import { createHugMeasure } from "@/components/studio/canvas/hug-measure";
import { createImageCommands } from "@/components/studio/image/commands";
import { createEditorUiStore } from "@/components/studio/image/editor-state";
import { createImageAgent } from "@/components/studio/image/image-agent";
import { libraryItems } from "@/components/studio/library/registry";
import { AgentFollower } from "@/components/studio/video/agent-follow";
import { createVideoExporter } from "@/components/studio/video/export/video-exporter";
import { browserFrames } from "@/components/studio/video/playback-controller";
import { createVideoEditorRuntime } from "@/components/studio/video/runtime";
import type { FrameExtractor } from "@/components/studio/video/timeline/frame-extractor";
import { createVideoAgent } from "@/components/studio/video/video-agent";
import pt from "@/i18n/messages/pt.json";
import { createScreenRegistry, type ScreenCommand, type ScreenHandler, type ScreenReply } from "@/lib/aichat/screen";
import { depthReport, sceneDepth } from "@/lib/studio/agent/depth-report";
import { imageDesignChecks, videoDesignChecks } from "@/lib/studio/agent/design-check";
import type { LibraryLookup } from "@/lib/studio/agent/element-ops";
import { grayOf, replicationScore, ssim, type ReplicationScore } from "@/lib/studio/agent/evals/replication-score";
import { lookPlan } from "@/lib/studio/agent/frames";
import { layoutReport, sceneLayout } from "@/lib/studio/agent/layout-report";
import { legibilityReport } from "@/lib/studio/agent/legibility";
import { motionReport } from "@/lib/studio/agent/motion-report";
import type { PerceptionFinding } from "@/lib/studio/agent/perception";
import { imageScene, videoSceneAt } from "@/lib/studio/agent/scene";
import { relayoutDocument } from "@/lib/studio/auto-layout";
import { perceivedSurface, resolvedSurface } from "@/lib/studio/components";
import { emptyImageDocument, emptyVideoDocument, type ImageDocument, type ImageSurface, type StudioDocument, type VideoDocument } from "@/lib/studio/document";
import { visibleLayers } from "@/lib/studio/image-edits";
import { settleImage } from "@/lib/studio/image-settle";
import { labelText, libraryLocale } from "@/lib/studio/library/catalog";
import { createStudioStore } from "@/lib/studio/store";
import { parseDocument } from "@/lib/studio/validate";

import { BENCH_ARTBOARD_ID, VIDEO_SAMPLE_FRAMES, type Finding, type Inspection, type OpenSpec } from "./model";

const SSIM_WIDTH = 256;
const LOCALE = "pt";
const translate = createTranslator({ locale: LOCALE, messages: pt });
const noFrames = { request: async () => null, cancel: () => undefined } as unknown as FrameExtractor;

function library(): Promise<LibraryLookup> {
  return libraryItems().then((items) => ({ items, text: (label) => labelText(label, (key) => translate(key as never), libraryLocale(LOCALE)), locale: LOCALE }));
}

const registry = createScreenRegistry();
let current: { document: () => StudioDocument; release: () => void } | null = null;

function imageEditor(spec: Extract<OpenSpec, { kind: "image" }>): { handler: ScreenHandler; document: () => StudioDocument } {
  const base = emptyImageDocument({ width: spec.width, height: spec.height }, spec.background);
  const initial: ImageDocument = { ...base, artboards: [{ ...base.artboards[0], id: BENCH_ARTBOARD_ID, name: "Arte" }] };
  let relayout = () => undefined;
  const measure = createHugMeasure(() => relayout());
  const store = createStudioStore(initial, { settle: (before, after) => settleImage(before, after, measure) });
  relayout = () => void store.getState().applyAs("hug-fonts", (doc) => relayoutDocument(doc, measure));
  const ui = createEditorUiStore();
  const commands = createImageCommands(store, ui, { requestJob: requestMediaGenerationAction, naturalSize: assetNaturalSize, measure });
  const handler = createImageAgent({ store, ui, commands, naturalSize: assetNaturalSize, measure, presence: createAgentPresence(), label: (action) => action, reduceMotion: () => true, library, projectId: "bench", projectName: "Avaliação", exportTitle: () => "Avaliação" });
  return { handler, document: () => store.getState().document };
}

function videoEditor(spec: Extract<OpenSpec, { kind: "video" }>): { handler: ScreenHandler; document: () => StudioDocument } {
  const runtime = createVideoEditorRuntime(emptyVideoDocument(spec.aspect, spec.background));
  const follower = new AgentFollower({ view: runtime.view, seek: (ms) => runtime.playback.seek(ms), frames: browserFrames, now: () => performance.now(), reduceMotion: () => true });
  const exporter = createVideoExporter({
    document: () => runtime.root.getState().document,
    commit: () => runtime.root.getState().commitTransaction(),
    flush: async () => undefined,
    committed: () => ({ version: 1, settled: true }),
    lutReadable: async () => true,
    local: () => new Promise(() => undefined),
    refreshLibrary: () => undefined,
  });
  const handler = createVideoAgent({ editor: { ...runtime, store: runtime.root }, exporter, presence: createAgentPresence(), follower, captionTrackName: "Legendas", label: (action) => action, reduceMotion: () => true, library });
  return { handler, document: () => runtime.root.getState().document };
}

function open(projectId: string, spec: OpenSpec): void {
  current?.release();
  const editor = spec.kind === "image" ? imageEditor(spec) : videoEditor(spec);
  current = { document: editor.document, release: registry.register(projectId, editor.handler) };
}

function run(command: ScreenCommand): Promise<ScreenReply> {
  return registry.run(command);
}

function documentNow(): StudioDocument {
  if (!current) throw new Error("no project is open");
  return current.document();
}

function surfaceOf(doc: ImageDocument): ImageSurface {
  return resolvedSurface(doc, doc.artboards[0]);
}

function asFindings(findings: readonly PerceptionFinding[]): Finding[] {
  return findings.map(({ kind, level, text }) => ({ kind, level, text }));
}

function sampleTimes(doc: VideoDocument): number[] {
  return Array.from({ length: VIDEO_SAMPLE_FRAMES }, (_, i) => Math.round(((i + 0.5) * doc.durationMs) / VIDEO_SAMPLE_FRAMES));
}

async function inspectImage(doc: ImageDocument): Promise<Inspection> {
  const surface = surfaceOf(doc);
  const perceived = perceivedSurface(doc, doc.artboards[0]);
  const image = await captureArtboard(surface, PLAIN_LOOK, null);
  const hasText = visibleLayers(surface.layers).some((layer) => layer.type === "text" && layer.text?.trim());
  return {
    image,
    findings: [...asFindings(depthReport(perceived).findings), ...asFindings(layoutReport(perceived, measureText).findings)],
    checks: imageDesignChecks(surface, measureText),
    legibility: hasText ? legibilityReport(surface, await captureBackdrop(surface)) : [],
    valid: parseDocument("image", doc).ok,
  };
}

async function videoSheet(doc: VideoDocument, times: readonly number[]): Promise<string> {
  const shot = await captureVideo(doc, { times, dense: false, region: null, marks: null, view: "render" }, noFrames, new AbortController().signal);
  return shot.image;
}

async function inspectVideo(doc: VideoDocument): Promise<Inspection> {
  const plan = lookPlan(doc, { count: VIDEO_SAMPLE_FRAMES });
  const times = plan.ok ? plan.times : sampleTimes(doc);
  const frames = times.flatMap((atMs) => {
    const scene = videoSceneAt(doc, atMs);
    return [...sceneDepth(scene).findings, ...sceneLayout(scene, measureText).findings];
  });
  const once = [...new Map(asFindings(frames).map((finding) => [finding.text, finding])).values()];
  return {
    image: doc.durationMs > 0 ? await videoSheet(doc, times) : "",
    findings: [...asFindings(motionReport(doc).findings), ...once],
    checks: videoDesignChecks(doc, measureText),
    legibility: [],
    valid: parseDocument("video", doc).ok,
  };
}

function inspect(doc: StudioDocument): Promise<Inspection> {
  return "artboards" in doc ? inspectImage(doc) : inspectVideo(doc);
}

async function grayAt(dataUrl: string): Promise<ReturnType<typeof grayOf>> {
  const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
  const width = SSIM_WIDTH;
  const height = Math.max(1, Math.round((bitmap.height * width) / bitmap.width));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d")!;
  context.drawImage(bitmap, 0, 0, width, height);
  return grayOf(context.getImageData(0, 0, width, height));
}

async function similarity(a: string, b: string): Promise<number> {
  const [left, right] = await Promise.all([grayAt(a), grayAt(b)]);
  return ssim(left, right);
}

function averageScores(scores: readonly ReplicationScore[]): ReplicationScore {
  const mean = (pick: (s: ReplicationScore) => number) => scores.reduce((sum, s) => sum + pick(s), 0) / scores.length;
  return {
    blockMatch: mean((s) => s.blockMatch),
    text: { exact: mean((s) => s.text.exact), total: mean((s) => s.text.total), similarity: mean((s) => s.text.similarity) },
    positionError: mean((s) => s.positionError),
    sizeError: mean((s) => s.sizeError),
    colorError: mean((s) => s.colorError),
    rotationError: mean((s) => s.rotationError),
    backgroundError: mean((s) => s.backgroundError),
    matched: mean((s) => s.matched),
    referenceElements: mean((s) => s.referenceElements),
    resultElements: mean((s) => s.resultElements),
    missing: [...new Set(scores.flatMap((s) => s.missing))],
    invented: [...new Set(scores.flatMap((s) => s.invented))],
  };
}

async function compare(reference: StudioDocument, result: StudioDocument): Promise<{ score: ReplicationScore; ssim: number }> {
  if ("artboards" in reference && "artboards" in result) {
    const ref = surfaceOf(reference);
    const got = surfaceOf(result);
    const [a, b] = await Promise.all([captureArtboard(ref, PLAIN_LOOK, null), captureArtboard(got, PLAIN_LOOK, null)]);
    return { score: replicationScore(imageScene(ref), imageScene(got)), ssim: await similarity(a, b) };
  }
  if (!("artboards" in reference) && !("artboards" in result)) {
    const times = sampleTimes(reference);
    const scores = times.map((t) => replicationScore(videoSceneAt(reference, t), videoSceneAt(result, t)));
    const pairs = await Promise.all(times.map(async (t) => similarity(await videoSheet(reference, [t]), await videoSheet(result, [t]))));
    return { score: averageScores(scores), ssim: pairs.reduce((sum, v) => sum + v, 0) / pairs.length };
  }
  throw new Error("the result is not the same kind of project as the reference");
}

async function sideBySide(left: string, right: string): Promise<string> {
  const [a, b] = await Promise.all([left, right].map(async (url) => createImageBitmap(await (await fetch(url)).blob())));
  const height = Math.min(a.height, b.height, 900);
  const wa = Math.round((a.width * height) / a.height);
  const wb = Math.round((b.width * height) / b.height);
  const gap = 24;
  const canvas = new OffscreenCanvas(wa + wb + gap, height);
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#808080";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(a, 0, 0, wa, height);
  context.drawImage(b, wa + gap, 0, wb, height);
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.88 });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:image/jpeg;base64,${btoa(binary)}`;
}

function validate(kind: "image" | "video", raw: unknown): string | null {
  const parsed = parseDocument(kind, raw);
  return parsed.ok ? null : `${parsed.issue.field}: ${parsed.issue.code}`;
}

declare global {
  interface Window {
    bench: {
      open: typeof open;
      run: typeof run;
      document: typeof documentNow;
      inspect: typeof inspect;
      compare: typeof compare;
      sideBySide: typeof sideBySide;
      validate: typeof validate;
    };
  }
}

window.bench = { open, run, document: documentNow, inspect, compare, sideBySide, validate };
