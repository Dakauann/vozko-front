import type { Clip, Track } from "../document";
import { coveringTransition, EDGE_TRANSITION_KINDS, edgeLengthMs, edgeOptionsOf, edgeTransition, edgeTransitionOf, edgeTransitionPatch, isEdgeTransitionKind, type EdgeIssue } from "../edge-transitions";
import type { MotionSide } from "../motion";
import type { ClipPatch } from "../timeline";
import { AUDIO_TRANSITION_KINDS, isTransitionKind, optionsOf, shownOptions, TRANSITION_KINDS, TRANSITION_LIMITS, type TransitionKind, type TransitionOption, type TransitionOptions, type TransitionRefusal } from "../transitions";
import type { VideoOpContext, VideoOperation } from "./video-ops";

const TRANSITION_FIELDS: Record<TransitionOption, keyof VideoOperation & string> = {
  direction: "direction",
  moving: "moving",
  color: "color",
  angle: "angle",
  shape: "iris_shape",
  originX: "origin_x",
  originY: "origin_y",
  clockwise: "clockwise",
  orientation: "orientation",
  reverse: "reverse",
  amount: "amount",
  softness: "softness",
  size: "piece_size",
  map: "wipe_map",
  mapAssetId: "wipe_map_media_id",
};

export function transitionOptions(op: VideoOperation): TransitionOptions {
  const options: TransitionOptions = {};
  for (const [option, field] of Object.entries(TRANSITION_FIELDS) as [TransitionOption, keyof VideoOperation][]) {
    if (op[field] !== undefined) Object.assign(options, { [option]: op[field] });
  }
  return options;
}

export function agentOptions(transition: { kind: TransitionKind } & TransitionOptions, allowed: readonly TransitionOption[] = optionsOf(transition.kind)): Record<string, string | number | boolean> {
  return Object.fromEntries(Object.entries(shownOptions(transition, allowed)).map(([option, value]) => [TRANSITION_FIELDS[option as TransitionOption], value as string | number | boolean]));
}

function optionText(kind: TransitionKind | undefined, allowed: readonly TransitionOption[], op: VideoOperation | undefined, base: string): string {
  const fields = allowed.map((option) => TRANSITION_FIELDS[option]);
  const extra = op ? Object.values(TRANSITION_FIELDS).filter((field) => op[field] !== undefined && !fields.includes(field)) : [];
  const accepted = `${kind ?? "a transição"} aceita só ${fields.length > 0 ? fields.join(", ") : base}`;
  if (extra.length > 0) return `${extra.join(", ")} não vale para ${kind}; ${accepted}`;
  return `um valor de opção está fora do permitido (wipe_map e wipe_map_media_id não vão juntos); ${accepted}`;
}

export function transitionRefusal(reason: TransitionRefusal, kind: TransitionKind | undefined, op?: VideoOperation): string {
  switch (reason) {
    case "apart":
      return "os dois clipes precisam se encostar na mesma faixa, o fim de um no início do outro; aproxime com move_clip ou trim_clip antes";
    case "kind":
      return `transition_kind precisa ser um de: ${TRANSITION_KINDS.join(", ")} entre clipes de faixas visuais, ou ${AUDIO_TRANSITION_KINDS.join(", ")} (cruzamento de som) entre clipes de faixas de áudio`;
    case "duration":
      return `duration_ms vai de ${TRANSITION_LIMITS.minMs} a ${TRANSITION_LIMITS.maxMs} e a transição não pode passar da metade de cada clipe`;
    case "alignment":
      return "alignment start ou end não vale para dipToColor, zoom e whip, que trocam de clipe no meio; use center";
    case "easing":
      return "easing hold não vale para transições; use outra curva";
    case "option":
      return optionText(kind, kind && isTransitionKind(kind) ? optionsOf(kind) : [], op, "duration_ms, alignment e easing");
    case "covered":
      return "um dos dois clipes tem entrada ou saída própria nessa borda; troque com entrance ou exit effect none antes";
    case "missing":
      return "a transição ou o clipe não existe; veja os ids com studio_read";
    case "locked":
      return "a faixa está travada";
  }
}

function sideName(side: MotionSide): string {
  return side === "in" ? "a entrada" : "a saída";
}

function edgeRefusal(reason: EdgeIssue, kind: TransitionKind, op: VideoOperation): string {
  switch (reason) {
    case "kind":
      return `transition_kind de entrada e saída precisa ser um de: ${EDGE_TRANSITION_KINDS.join(", ")}; para dissolver use effect fade`;
    case "duration":
      return `duration_ms vai de ${TRANSITION_LIMITS.minMs} a ${TRANSITION_LIMITS.maxMs}`;
    case "easing":
      return "easing hold não vale para transições; use outra curva";
    case "option":
      return optionText(kind, isEdgeTransitionKind(kind) ? edgeOptionsOf(kind) : [], op, "duration_ms e easing");
  }
}

export function mapMediaRefusal(op: VideoOperation, ctx: VideoOpContext): string | null {
  if (op.wipe_map_media_id === undefined || ctx.mediaType(op.wipe_map_media_id) === "image") return null;
  return `wipe_map_media_id precisa ser uma imagem da biblioteca; ${op.wipe_map_media_id} não é`;
}

interface EdgeChange {
  patch: ClipPatch;
  notes: string[];
}

export function edgeTransitionChange(track: Track, clip: Clip, side: MotionSide, op: VideoOperation, ctx: VideoOpContext): EdgeChange | string {
  const kind = op.transition_kind!;
  if (clip.type !== "video" && clip.type !== "image" && clip.type !== "overlay") return `o clipe ${clip.id} é ${clip.type === "audio" ? "áudio" : "um clipe de efeito"}: entrada e saída com transição valem só para vídeo, imagem, texto, forma e ícone`;
  if (!isEdgeTransitionKind(kind)) return edgeRefusal("kind", kind, op);
  const covering = coveringTransition(track, clip.id, side);
  if (covering) return `${side === "in" ? "o início" : "o fim"} do clipe ${clip.id} já tem a transição ${covering.id} com o clipe vizinho; troque com update_transition ou tire com remove_transition antes`;
  const map = mapMediaRefusal(op, ctx);
  if (map) return map;
  const transition = edgeTransition({ kind, durationMs: op.duration_ms, easing: op.easing, ...transitionOptions(op) }, edgeTransitionOf(clip, side));
  if (typeof transition === "string") return edgeRefusal(transition, kind, op);
  const room = clip.durationMs - edgeLengthMs(clip, side === "in" ? "out" : "in");
  if (room < TRANSITION_LIMITS.minMs) return `o clipe ${clip.id} não tem espaço para ${sideName(side)}: o outro lado ocupa o clipe quase todo; encurte o outro lado antes`;
  const fitted = Math.min(transition.durationMs, room);
  const notes = fitted < transition.durationMs ? [`${sideName(side)} do clipe ${clip.id} ficou com ${fitted} ms, o espaço que sobra no clipe`] : [];
  return { patch: edgeTransitionPatch(side, { ...transition, durationMs: fitted }), notes };
}
