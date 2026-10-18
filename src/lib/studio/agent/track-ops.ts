import { boxPointAt } from "../clip-placement";
import { localAtSource, sourceAt } from "../clip-time";
import { canvasAspect, newStudioId, type Clip, type VideoDocument } from "../document";
import { worldPlacementIn } from "../parenting";
import { baseAspect, boxFractionOf, DEFAULT_TRACK_SIZE, frameWindowAt, trackerSummary, TRACKER_LIMITS, type BoxTrackRequest, type PointTracker } from "../point-track";
import { attachToTracker, putTracker, removeTracker, stabilizeClip, unstabilizeClip, ATTACH_MODES, type AttachMode, type TrackEditRefusal } from "../track-edit";
import { trackerFromOutcome, type TrackFailure, type TrackOutcome } from "../tracking/track-outcome";
import { TRACK_DIRECTIONS, type TrackDirection, type TrackLoss } from "../tracking/track-run";
import { clipEnd, findClip } from "../timeline";
import { parentRefusalText } from "./parent-ops";

export const TRACK_OPERATIONS = ["track_point", "attach_to_track", "stabilize_clip", "remove_tracker"] as const;

export interface AgentPoint {
  x: number;
  y: number;
}

export interface AgentTrackFields {
  point?: AgentPoint;
  track_size?: number;
  from_ms?: number;
  to_ms?: number;
  track_direction?: TrackDirection;
  tracker_id?: string;
  second_tracker_id?: string;
  keep_partial?: boolean;
  attach_mode?: AttachMode;
  stabilize_rotation?: boolean;
  stabilize_scale?: boolean;
  smooth_ms?: number;
  zoom?: number;
  unstabilize?: boolean;
}

interface TrackOpInput extends AgentTrackFields {
  op: string;
  clip_id?: string;
  clip_ids?: string[];
  parent_id?: string;
  at_ms?: number;
  keep_position?: boolean;
  name?: string;
}

export type TrackOutcomes = (key: string) => TrackOutcome | undefined;

type TrackOpResult = { ok: true; document: VideoDocument; clipId: string; changed: string[]; created: string[]; notes: string[] } | { ok: false; reason: string };

interface TrackPlan {
  key: string;
  clipId: string;
  assetId: string;
  request: BoxTrackRequest;
}

const READ_AGAIN = "leia o projeto de novo com studio_read";

function refuse(reason: string): TrackOpResult {
  return { ok: false, reason };
}

function unit(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

type TrackPlanRefusal = "missing" | "notVideo" | "frozen" | "momentOutside" | "noPoint" | "size" | "span" | "direction" | "pointOutside";

interface TrackAim {
  clipId: string;
  point?: AgentPoint;
  size: number;
  atMs: number;
  fromMs?: number;
  toMs?: number;
  direction: TrackDirection;
}

export function planTrack(doc: VideoDocument, aim: TrackAim): TrackPlan | TrackPlanRefusal {
  const found = findClip(doc, aim.clipId);
  if (!found) return "missing";
  const clip = found.clip;
  if (clip.type !== "video" || !clip.assetId) return "notVideo";
  if (clip.freeze) return "frozen";
  const end = clipEnd(clip);
  const atMs = Math.round(aim.atMs);
  if (atMs < clip.startMs || atMs >= end) return "momentOutside";
  if (!aim.point || !unit(aim.point.x) || !unit(aim.point.y)) return "noPoint";
  if (!(aim.size >= TRACKER_LIMITS.size[0] && aim.size <= TRACKER_LIMITS.size[1])) return "size";
  const fromMs = Math.round(aim.fromMs ?? clip.startMs);
  const toMs = Math.round(aim.toMs ?? end);
  if (fromMs < clip.startMs || toMs > end || fromMs > atMs || toMs <= atMs) return "span";
  if (!TRACK_DIRECTIONS.includes(aim.direction)) return "direction";
  const aspect = canvasAspect(doc);
  const placed = worldPlacementIn(doc, clip, atMs - clip.startMs);
  const inBox = boxFractionOf(clip, boxPointAt(placed, aim.point, aspect));
  if (!unit(inBox.x) || !unit(inBox.y)) return "pointOutside";
  const local = (ms: number) => sourceAt(clip, Math.min(clip.durationMs, Math.max(0, ms - clip.startMs)));
  const spanA = local(fromMs);
  const spanB = local(toMs);
  const referenceMs = local(atMs);
  const window = frameWindowAt(clip, referenceMs);
  const flipped: Record<TrackDirection, TrackDirection> = { both: "both", forward: "backward", backward: "forward" };
  const request: BoxTrackRequest = {
    boxPoint: inBox,
    boxSize: aim.size / placed.h,
    boxAspect: baseAspect(clip, aspect),
    fit: clip.fit ?? "cover",
    ...(window ? { window } : {}),
    atMs: referenceMs,
    fromMs: Math.min(spanA, spanB),
    toMs: Math.max(spanA, spanB),
    direction: clip.reverse ? flipped[aim.direction] : aim.direction,
  };
  return { key: JSON.stringify([clip.id, clip.assetId, request]), clipId: clip.id, assetId: clip.assetId, request };
}

function planText(reason: TrackPlanRefusal, doc: VideoDocument, op: TrackOpInput, atMs: number): string {
  const clip = op.clip_id ? findClip(doc, op.clip_id)?.clip : undefined;
  switch (reason) {
    case "missing":
      return `o clipe ${op.clip_id ?? "(sem id)"} não existe; ${READ_AGAIN}`;
    case "notVideo":
      return `o clipe ${op.clip_id} não é vídeo; só clipes de vídeo têm pontos para rastrear`;
    case "frozen":
      return `o clipe ${op.clip_id} é um quadro congelado e não se move; rastreie o clipe de vídeo original`;
    case "momentOutside":
      return `at_ms ${atMs} fica fora do clipe ${op.clip_id}, que vai de ${clip?.startMs} a ${clip ? clipEnd(clip) : ""} ms`;
    case "noPoint":
      return "track_point precisa de point {x, y}, de 0 a 1 no quadro do vídeo, no instante at_ms";
    case "size":
      return `track_size vai de ${TRACKER_LIMITS.size[0]} a ${TRACKER_LIMITS.size[1]} da altura do quadro`;
    case "span":
      return `from_ms e to_ms ficam dentro do clipe (${clip?.startMs} a ${clip ? clipEnd(clip) : ""} ms), com from_ms <= at_ms < to_ms`;
    case "direction":
      return "track_direction vai em both, forward ou backward";
    case "pointOutside":
      return `o ponto (${op.point?.x}, ${op.point?.y}) fica fora do clipe ${op.clip_id} em ${atMs} ms; olhe o quadro com studio_look e escolha um ponto em cima do vídeo`;
  }
}

export function trackPlanOf(doc: VideoDocument, op: TrackOpInput, playheadMs: number): TrackPlan | string {
  const atMs = Math.round(op.at_ms ?? playheadMs);
  const plan = planTrack(doc, { clipId: op.clip_id ?? "", point: op.point, size: op.track_size ?? DEFAULT_TRACK_SIZE, atMs, fromMs: op.from_ms, toMs: op.to_ms, direction: op.track_direction ?? "both" });
  return typeof plan === "string" ? planText(plan, doc, op, atMs) : plan;
}

export function trackPlans(doc: VideoDocument, operations: readonly TrackOpInput[], playheadMs: number): TrackPlan[] {
  const plans = new Map<string, TrackPlan>();
  for (const op of operations) {
    if (op.op !== "track_point") continue;
    const plan = trackPlanOf(doc, op, playheadMs);
    if (typeof plan !== "string") plans.set(plan.key, plan);
  }
  return [...plans.values()];
}

function timelineMs(clip: Clip, sourceMs: number): number {
  return Math.round(clip.startMs + Math.min(clip.durationMs, Math.max(0, localAtSource(clip, sourceMs))));
}

function trackFailureText(reason: TrackFailure, loss: TrackLoss | undefined, clip: Clip | null): string {
  switch (reason) {
    case "lost": {
      const at = clip && loss ? timelineMs(clip, loss.atMs) : null;
      return `o rastreio perdeu o ponto ${loss?.direction === "backward" ? "voltando" : "seguindo"}${at === null ? "" : ` em ${at} ms`} (confiança ${loss?.confidence ?? 0}, abaixo de 0.6); escolha um ponto com mais contraste, um track_size maior, um trecho menor com from_ms e to_ms, ou keep_partial true para guardar o trecho rastreado`;
    }
    case "flat":
      return "o ponto escolhido não tem detalhe para seguir (uma área lisa); escolha uma quina, um olho, uma letra ou outra marca com contraste";
    case "outside":
      return "o ponto fica fora do quadro do vídeo";
    case "empty":
      return "o vídeo não tem quadros nesse trecho";
    case "undecodable":
    case "unsupported":
      return "este navegador não consegue ler os quadros desse vídeo para rastrear";
    case "slow":
      return "o rastreio passou do tempo de uma edição; rastreie um trecho menor com from_ms e to_ms e depois o resto com tracker_id do mesmo ponto";
    case "cancelled":
    case "failed":
      return "o rastreio não terminou; tente de novo";
  }
}

function trackEditText(reason: TrackEditRefusal, parentId: string | null): string {
  switch (reason) {
    case "notVideo":
      return "só clipes de vídeo têm pontos rastreados";
    case "frozen":
      return "um quadro congelado não se move; use o clipe de vídeo original";
    case "needsSecond":
      return "girar ou escalar para estabilizar pede dois pontos: passe second_tracker_id";
    case "tooMuchMotion":
      return `o movimento é grande demais para esconder as bordas com até ${TRACKER_LIMITS.zoom[1]}x de zoom; use smooth_ms para suavizar em vez de travar, ou rastreie um trecho menor`;
    case "noOverlap":
      return "o clipe não fica na tela junto com o vídeo rastreado, então não há quadros para seguir";
    case "outOfRange":
      return `zoom vai de ${TRACKER_LIMITS.zoom[0]} a ${TRACKER_LIMITS.zoom[1]}, smooth_ms de ${TRACKER_LIMITS.smoothMs[0]} a ${TRACKER_LIMITS.smoothMs[1]}; seguindo o ponto, a posição passaria de -1 a 2`;
    default:
      return parentRefusalText(reason, parentId);
  }
}

function trackerNote(clip: Clip, tracker: PointTracker, loss: TrackLoss | null): string {
  const summary = trackerSummary(tracker);
  const span = `de ${timelineMs(clip, tracker.samples[0].atMs)} a ${timelineMs(clip, tracker.samples[tracker.samples.length - 1].atMs)} ms`;
  const kept = loss ? `; perdeu o ponto em ${timelineMs(clip, loss.atMs)} ms (confiança ${loss.confidence}) e guardou o trecho até ali` : "";
  return `ponto ${tracker.id} rastreado ${span}: ${summary.frames} quadros, confiança média ${summary.meanConfidence}, mínima ${summary.lowestConfidence}${kept}`;
}

function trackPoint(doc: VideoDocument, op: TrackOpInput, playheadMs: number, outcomes: TrackOutcomes): TrackOpResult {
  const plan = trackPlanOf(doc, op, playheadMs);
  if (typeof plan === "string") return refuse(plan);
  const clip = findClip(doc, plan.clipId)!.clip;
  if (op.tracker_id && !clip.trackers?.some((tracker) => tracker.id === op.tracker_id)) return refuse(`o clipe ${clip.id} não tem o ponto ${op.tracker_id}; deixe tracker_id vazio para criar um ponto novo`);
  const outcome = outcomes(plan.key);
  if (!outcome) return refuse("o rastreio não rodou para esse pedido; rastreie um clipe que já existia antes deste lote, num lote próprio");
  const id = op.tracker_id ?? newStudioId("pt");
  const result = trackerFromOutcome(outcome, { id, name: op.name, keepPartial: op.keep_partial === true });
  if (!result.ok) return refuse(trackFailureText(result.reason, result.loss, clip));
  const edit = putTracker(doc, clip.id, result.tracker);
  if (!edit.ok) return refuse(trackEditText(edit.reason, null));
  return { ok: true, document: edit.document, clipId: clip.id, changed: [clip.id], created: op.tracker_id ? [] : [id], notes: [trackerNote(clip, result.tracker, result.loss)] };
}

function idsOf(op: TrackOpInput): string[] {
  if (op.clip_ids && op.clip_ids.length > 0) return op.clip_ids;
  return op.clip_id ? [op.clip_id] : [];
}

function attach(doc: VideoDocument, op: TrackOpInput, playheadMs: number): TrackOpResult {
  const ids = idsOf(op);
  if (ids.length === 0) return refuse("attach_to_track precisa de clip_id ou clip_ids: os clipes que vão seguir o ponto");
  if (!op.parent_id || !op.tracker_id) return refuse("attach_to_track precisa de parent_id (o clipe de vídeo rastreado) e tracker_id (o ponto)");
  const mode = op.attach_mode ?? "link";
  if (!ATTACH_MODES.includes(mode)) return refuse("attach_mode vai em link (segue ao vivo) ou keys (grava quadros-chave de posição)");
  const missing = ids.find((id) => !findClip(doc, id));
  if (missing) return refuse(`o clipe ${missing} não existe; ${READ_AGAIN}`);
  const edit = attachToTracker(doc, ids, op.parent_id, op.tracker_id, { mode, keepVisual: op.keep_position ?? true, atMs: op.at_ms ?? playheadMs });
  if (!edit.ok) return refuse(trackEditText(edit.reason, op.parent_id));
  return { ok: true, document: edit.document, clipId: ids[0], changed: ids, created: [], notes: [] };
}

function stabilize(doc: VideoDocument, op: TrackOpInput): TrackOpResult {
  if (!op.clip_id) return refuse("stabilize_clip precisa de clip_id");
  if (op.unstabilize) {
    const edit = unstabilizeClip(doc, op.clip_id);
    return edit.ok ? { ok: true, document: edit.document, clipId: op.clip_id, changed: [op.clip_id], created: [], notes: [] } : refuse(trackEditText(edit.reason, null));
  }
  if (!op.tracker_id) return refuse("stabilize_clip precisa de tracker_id (o ponto que fica parado) ou de unstabilize true");
  const edit = stabilizeClip(doc, op.clip_id, {
    trackerId: op.tracker_id,
    ...(op.second_tracker_id ? { secondTrackerId: op.second_tracker_id } : {}),
    rotation: op.stabilize_rotation,
    scale: op.stabilize_scale,
    smoothMs: op.smooth_ms,
    zoom: op.zoom,
  });
  if (!edit.ok) return refuse(trackEditText(edit.reason, op.clip_id));
  const zoom = findClip(edit.document, op.clip_id)!.clip.stabilize!.zoom;
  return { ok: true, document: edit.document, clipId: op.clip_id, changed: [op.clip_id], created: [], notes: [`estabilizado com zoom ${zoom}x para esconder as bordas`] };
}

function remove(doc: VideoDocument, op: TrackOpInput): TrackOpResult {
  if (!op.clip_id || !op.tracker_id) return refuse("remove_tracker precisa de clip_id e tracker_id");
  const edit = removeTracker(doc, op.clip_id, op.tracker_id);
  if (!edit.ok) return refuse(trackEditText(edit.reason, op.clip_id));
  return { ok: true, document: edit.document, clipId: op.clip_id, changed: [op.clip_id], created: [], notes: [] };
}

export function trackOperation(doc: VideoDocument, op: TrackOpInput, playheadMs: number, outcomes: TrackOutcomes): TrackOpResult | null {
  switch (op.op) {
    case "track_point":
      return trackPoint(doc, op, playheadMs, outcomes);
    case "attach_to_track":
      return attach(doc, op, playheadMs);
    case "stabilize_clip":
      return stabilize(doc, op);
    case "remove_tracker":
      return remove(doc, op);
  }
  return null;
}

export interface OutlineTracker {
  id: string;
  name?: string;
  from_ms: number;
  to_ms: number;
  reference_ms: number;
  frames: number;
  mean_confidence: number;
  lowest_confidence: number;
}

export interface OutlineStabilize {
  tracker_id: string;
  second_tracker_id?: string;
  rotation?: boolean;
  scale?: boolean;
  smooth_ms?: number;
  zoom: number;
}

export function trackersOutline(clip: Clip): OutlineTracker[] {
  return (clip.trackers ?? []).map((tracker) => {
    const summary = trackerSummary(tracker);
    const ends = [timelineMs(clip, tracker.samples[0].atMs), timelineMs(clip, tracker.samples[tracker.samples.length - 1].atMs)];
    return {
      id: tracker.id,
      ...(tracker.name ? { name: tracker.name } : {}),
      from_ms: Math.min(...ends),
      to_ms: Math.max(...ends),
      reference_ms: timelineMs(clip, tracker.referenceMs),
      frames: summary.frames,
      mean_confidence: summary.meanConfidence,
      lowest_confidence: summary.lowestConfidence,
    };
  });
}

export function stabilizeOutline(clip: Clip): OutlineStabilize | undefined {
  const s = clip.stabilize;
  if (!s) return undefined;
  return { tracker_id: s.trackerId, ...(s.secondTrackerId ? { second_tracker_id: s.secondTrackerId } : {}), ...(s.rotation ? { rotation: true } : {}), ...(s.scale ? { scale: true } : {}), ...(s.smoothMs ? { smooth_ms: s.smoothMs } : {}), zoom: s.zoom };
}
