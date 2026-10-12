import { ALIGNMENTS, DISTRIBUTE_AXES, type Alignment, type DistributeAxis } from "../arrange";
import { STUDIO_LIMITS, type VideoDocument } from "../document";
import { ALIGN_TO, alignClips, distributeClips, type AlignTo, type FrameLayoutResult } from "../frame-layout";
import { sequenceClips, staggerClips, type TimingResult } from "../timing-edits";
import { isTransitionKind, TRANSITION_KINDS, type TransitionKind } from "../transitions";

export const LAYOUT_OPERATIONS = ["align_clips", "distribute_clips", "sequence_clips", "stagger_clips"] as const;

export type LayoutOpName = (typeof LAYOUT_OPERATIONS)[number];

export interface AgentLayoutFields {
  frame_align?: Alignment;
  axis?: DistributeAxis;
  relative_to?: AlignTo;
  gap_ms?: number;
  step_ms?: number;
}

export interface LayoutOpInput extends AgentLayoutFields {
  op: string;
  clip_id?: string;
  clip_ids?: string[];
  at_ms?: number;
  transition_kind?: TransitionKind;
  duration_ms?: number;
}

export type LayoutOpResult = { ok: true; document: VideoDocument; changed: string[]; created: string[]; notes: string[]; clipId: string } | { ok: false; reason: string };

const READ_AGAIN = "leia o projeto de novo com studio_read";

function isLayoutOp(name: string): name is LayoutOpName {
  return (LAYOUT_OPERATIONS as readonly string[]).includes(name);
}

function refuse(reason: string): LayoutOpResult {
  return { ok: false, reason };
}

function idsOf(op: LayoutOpInput): string[] {
  if (op.clip_ids && op.clip_ids.length > 0) return op.clip_ids;
  return op.clip_id ? [op.clip_id] : [];
}

function frameRefusal(result: Extract<FrameLayoutResult, { ok: false }>, atMs: number): string {
  switch (result.reason) {
    case "missing":
      return `o clipe ${result.clipId} não existe; ${READ_AGAIN}`;
    case "locked":
      return `o clipe ${result.clipId} está numa faixa travada; destrave com update_track antes`;
    case "notVisual":
      return "alinhar e distribuir valem para clipes de vídeo, imagem, texto, forma e ícone; os clipes escolhidos são só de som ou de efeito";
    case "keyframeOutside":
      return `o clipe ${result.clipId} anima a posição e não está na tela em ${atMs} ms; use at_ms dentro dele para gravar a chave nesse instante`;
    case "outOfRange":
      return `o centro do clipe ${result.clipId} sairia do quadro (x e y vão de 0 a 1); diminua o clipe antes de alinhar`;
    case "tooFew":
      return "distribute_clips precisa de pelo menos três clipes visuais em clip_ids";
    case "invalid":
      return "o resultado deixaria o projeto inválido";
  }
}

function frameOutcome(result: FrameLayoutResult, atMs: number, ids: readonly string[]): LayoutOpResult {
  if (!result.ok) return refuse(frameRefusal(result, atMs));
  const notes = [
    ...(result.keyed.length > 0 ? [`gravei uma chave de posição em ${atMs} ms em ${result.keyed.join(", ")}, que já eram animados`] : []),
    ...(result.skipped.length > 0 ? [`${result.skipped.join(", ")} ficaram de fora: som e efeitos não têm posição no quadro`] : []),
    ...(result.changed.length === 0 ? ["os clipes já estavam assim; nada mudou"] : []),
  ];
  return { ok: true, document: result.document, changed: result.changed, created: [], notes, clipId: result.changed[0] ?? ids[0] };
}

function timingRefusal(result: Extract<TimingResult, { ok: false }>): string {
  switch (result.reason) {
    case "missing":
      return `o clipe ${result.clipId} não existe; ${READ_AGAIN}`;
    case "locked":
      return `o clipe ${result.clipId} está numa faixa travada; destrave com update_track antes`;
    case "tooFew":
      return "escolha pelo menos dois clipes em clip_ids (o vídeo e o som ligado contam como um)";
    case "blocked":
      return result.blockerId
        ? `o clipe ${result.clipId} cairia em cima do clipe ${result.blockerId} na mesma faixa; mova um deles para outra faixa com move_clip, ou use outro gap_ms ou step_ms`
        : "algum clipe cairia em cima de outro na mesma faixa; mova os clipes para faixas diferentes antes";
    case "range":
      return `o clipe ${result.clipId} sairia do vídeo, que vai de 0 a ${STUDIO_LIMITS.maxVideoMs} ms; use outro gap_ms ou step_ms`;
    case "apart":
      return "a transição só entra entre clipes que ficam encostados na mesma faixa; com gap_ms 0 e os clipes na mesma faixa ela entra em cada corte";
    case "transition":
      return `a transição não coube no corte antes do clipe ${result.clipId}; ela não pode passar da metade de cada clipe, então diminua duration_ms`;
    case "noClip":
    case "unchanged":
      return "nada para mudar";
  }
}

function timingOutcome(result: TimingResult, ids: readonly string[]): LayoutOpResult {
  if (!result.ok) return refuse(timingRefusal(result));
  const notes = result.changed.length === 0 ? ["os clipes já estavam assim; nada mudou"] : [];
  return { ok: true, document: result.document, changed: result.changed, created: result.transitions, notes, clipId: ids[0] };
}

function alignOp(doc: VideoDocument, op: LayoutOpInput, ids: string[], atMs: number): LayoutOpResult {
  if (!op.frame_align || !ALIGNMENTS.includes(op.frame_align)) return refuse(`align_clips precisa de frame_align: ${ALIGNMENTS.join(", ")}`);
  if (op.relative_to !== undefined && !ALIGN_TO.includes(op.relative_to)) return refuse(`relative_to é ${ALIGN_TO.join(" ou ")}`);
  return frameOutcome(alignClips(doc, ids, op.frame_align, { playheadMs: atMs, relativeTo: op.relative_to }), atMs, ids);
}

function distributeOp(doc: VideoDocument, op: LayoutOpInput, ids: string[], atMs: number): LayoutOpResult {
  if (!op.axis || !DISTRIBUTE_AXES.includes(op.axis)) return refuse(`distribute_clips precisa de axis: ${DISTRIBUTE_AXES.join(" ou ")}`);
  return frameOutcome(distributeClips(doc, ids, op.axis, { playheadMs: atMs }), atMs, ids);
}

function sequenceOp(doc: VideoDocument, op: LayoutOpInput, ids: string[]): LayoutOpResult {
  if (op.transition_kind !== undefined && !isTransitionKind(op.transition_kind)) return refuse(`transition_kind precisa ser um de: ${TRANSITION_KINDS.join(", ")}`);
  if (op.transition_kind === undefined && op.duration_ms !== undefined) return refuse("duration_ms em sequence_clips é a duração da transição; mande transition_kind junto");
  const transition = op.transition_kind ? { kind: op.transition_kind, durationMs: op.duration_ms } : undefined;
  return timingOutcome(sequenceClips(doc, ids, { gapMs: op.gap_ms, transition }), ids);
}

function staggerOp(doc: VideoDocument, op: LayoutOpInput, ids: string[]): LayoutOpResult {
  if (op.step_ms === undefined) return refuse("stagger_clips precisa de step_ms: quanto cada clipe começa depois do anterior, em ms");
  return timingOutcome(staggerClips(doc, ids, op.step_ms), ids);
}

export function layoutOperation(doc: VideoDocument, op: LayoutOpInput, playheadMs: number): LayoutOpResult | null {
  if (!isLayoutOp(op.op)) return null;
  const ids = idsOf(op);
  if (ids.length === 0) return refuse(`${op.op} precisa de clip_ids`);
  const atMs = Math.round(op.at_ms ?? playheadMs);
  switch (op.op) {
    case "align_clips":
      return alignOp(doc, op, ids, atMs);
    case "distribute_clips":
      return distributeOp(doc, op, ids, atMs);
    case "sequence_clips":
      return sequenceOp(doc, op, ids);
    case "stagger_clips":
      return staggerOp(doc, op, ids);
  }
}
