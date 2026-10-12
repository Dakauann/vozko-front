import { STUDIO_LIMITS, type VideoDocument } from "../document";
import { insertNull, setParents, type ParentRefusal } from "../parent-edit";
import { findClip } from "../timeline";

export const PARENT_OPERATIONS = ["parent_clip", "add_null"] as const;

export type ParentOpName = (typeof PARENT_OPERATIONS)[number];

export interface AgentParentFields {
  parent_id?: string;
  unparent?: boolean;
  keep_position?: boolean;
}

export interface ParentOpInput extends AgentParentFields {
  op: string;
  clip_id?: string;
  clip_ids?: string[];
  track_id?: string;
  at_ms?: number;
  duration_ms?: number;
  x?: number;
  y?: number;
}

export type ParentOpResult = { ok: true; document: VideoDocument; clipId: string; changed: string[]; created: string[] } | { ok: false; reason: string };

const READ_AGAIN = "leia o projeto de novo com studio_read";

export function isParentOp(name: string): name is ParentOpName {
  return (PARENT_OPERATIONS as readonly string[]).includes(name);
}

function refuse(reason: string): ParentOpResult {
  return { ok: false, reason };
}

function idsOf(op: ParentOpInput): string[] {
  if (op.clip_ids && op.clip_ids.length > 0) return op.clip_ids;
  return op.clip_id ? [op.clip_id] : [];
}

export function parentRefusalText(reason: ParentRefusal, parentId: string | null): string {
  switch (reason) {
    case "missing":
      return `um dos clipes ou o pai ${parentId ?? ""} não existe; ${READ_AGAIN}`;
    case "locked":
      return "um dos clipes está numa faixa travada; destrave com update_track antes";
    case "notParentable":
      return "só clipes de vídeo, imagem, texto, forma, ícone e nulos seguem ou conduzem outro clipe; som e clipes de efeito ficam de fora";
    case "self":
      return "um clipe não pode seguir a si mesmo";
    case "cycle":
      return `o pai ${parentId} já segue esse clipe, direta ou indiretamente; um vínculo em círculo não existe`;
    case "degenerate":
      return "a escala do pai está em zero nesse instante, então não dá para manter o lugar; use keep_position false ou outro at_ms";
    case "outOfRange":
      return "mantendo o lugar, a posição ou o tamanho no espaço do pai passariam do limite (posição de -1 a 2, tamanho até 4); aproxime o clipe do pai, use outro pai ou keep_position false";
    case "noRoom":
      return `o nulo precisa de pelo menos ${STUDIO_LIMITS.minClipMs} ms antes do fim do vídeo, que vai até ${STUDIO_LIMITS.maxVideoMs} ms; use um at_ms menor`;
    case "noTracker":
      return `o clipe ${parentId ?? ""} não tem esse ponto rastreado; o campo trackers do clipe em studio_read lista os ids`;
    case "invalid":
      return "o resultado deixaria o projeto inválido";
  }
}

function parentClip(doc: VideoDocument, op: ParentOpInput, playheadMs: number): ParentOpResult {
  const ids = idsOf(op);
  if (ids.length === 0) return refuse("parent_clip precisa de clip_id ou clip_ids");
  if ((op.parent_id === undefined) === (op.unparent !== true)) return refuse("parent_clip precisa de parent_id (o clipe que conduz) ou de unparent true para soltar, nunca dos dois");
  const missing = ids.find((id) => !findClip(doc, id));
  if (missing) return refuse(`o clipe ${missing} não existe; ${READ_AGAIN}`);
  const parentId = op.unparent ? null : op.parent_id!;
  const edit = setParents(doc, ids, parentId, { keepVisual: op.keep_position ?? true, atMs: op.at_ms ?? playheadMs });
  if (!edit.ok) return refuse(parentRefusalText(edit.reason, parentId));
  return { ok: true, document: edit.document, clipId: ids[0], changed: ids, created: [] };
}

function addNull(doc: VideoDocument, op: ParentOpInput, playheadMs: number): ParentOpResult {
  const startMs = Math.max(0, Math.round(op.at_ms ?? playheadMs));
  for (const [name, value] of [["x", op.x], ["y", op.y]] as const) if (value !== undefined && !(value >= 0 && value <= 1)) return refuse(`${name} vai de 0 a 1`);
  if (op.track_id && !doc.tracks.some((track) => track.id === op.track_id)) return refuse(`a faixa ${op.track_id} não existe; ${READ_AGAIN}`);
  const added = insertNull(doc, { startMs, durationMs: op.duration_ms === undefined ? undefined : Math.round(op.duration_ms), x: op.x, y: op.y, trackId: op.track_id });
  if (!added.ok) return refuse(parentRefusalText(added.reason, null));
  return { ok: true, document: added.document, clipId: added.clipId, changed: [], created: [added.clipId] };
}

export function parentOperation(doc: VideoDocument, op: ParentOpInput, playheadMs: number): ParentOpResult | null {
  if (!isParentOp(op.op)) return null;
  return op.op === "parent_clip" ? parentClip(doc, op, playheadMs) : addNull(doc, op, playheadMs);
}
