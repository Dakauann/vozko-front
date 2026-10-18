import type { VideoDocument } from "../document";
import { groupClips, ungroupClip, type GroupRefusal, type KeptProperty } from "../group-edits";
import { insidePath, isGroupClip, pathOfId, type GroupPath } from "../group-scope";
import { findClip } from "../timeline";

export const GROUP_OPERATIONS = ["group_clips", "ungroup_clips"] as const;

export interface AgentGroupFields {
  group_id?: string;
}

interface GroupOpInput extends AgentGroupFields {
  op: string;
  clip_id?: string;
  clip_ids?: string[];
  name?: string;
}

type GroupOpResult = { ok: true; document: VideoDocument; clipId: string; created: string[]; changed: string[]; notes: string[] } | { ok: false; reason: string };

const READ_AGAIN = "leia o projeto de novo com studio_read";

const SCOPED_FIELDS = ["clip_id", "clip_ids", "track_id", "to_clip_id", "transition_id", "parent_id", "trigger_track_ids"] as const;

function listed(ids: readonly string[]): string {
  return ids.length > 0 ? ` (${ids.join(", ")})` : "";
}

function groupRefusalText(reason: GroupRefusal, ids: readonly string[]): string {
  switch (reason) {
    case "empty":
      return "group_clips precisa de clip_ids com pelo menos um clipe";
    case "missing":
      return `os clipes${listed(ids)} não estão nesta linha do tempo; ${READ_AGAIN} ou use group_id para agrupar dentro de um grupo`;
    case "locked":
      return `os clipes${listed(ids)} estão em faixas travadas; destrave com update_track antes`;
    case "nothingVisible":
      return "um grupo precisa de pelo menos um clipe visual (vídeo, imagem, texto, forma, ícone, efeito ou outro grupo); som e nulos sozinhos não viram grupo";
    case "transitionCut":
      return `a transição entre${listed(ids)} ficaria cortada pela borda do grupo; inclua os dois clipes ou remova a transição com remove_transition`;
    case "interleaved":
      return `o clipe${listed(ids)} fica entre as faixas escolhidas no mesmo instante, então o empilhamento mudaria; inclua esse clipe ou mova-o de faixa`;
    case "seesThrough":
      return `o clipe${listed(ids)} mistura, recorta ou é um clipe de efeito sobre clipes que ficariam fora do grupo, e dentro do grupo deixaria de ver esses clipes; inclua os clipes de baixo ou tire a mistura, o recorte ou o efeito`;
    case "matteAbove":
      return `o recorte${listed(ids)} logo acima passaria a recortar o grupo inteiro; inclua o recorte no grupo ou desligue o matte`;
    case "ducking":
      return "a redução automática de volume ligaria faixas dentro e fora do grupo; inclua todas as faixas da regra inteiras ou asse a redução com bake_ducking antes";
  }
}

const KEPT_TEXT: Record<KeptProperty, string> = {
  opacity: "a opacidade ou as chaves de opacidade",
  fades: "os fades",
  volume: "o volume (passaria de 200% nos sons de dentro)",
  masks: "as máscaras",
  matte: "o recorte (matte)",
  blend: "o modo de mistura",
  vfx: "os efeitos visuais",
  color: "a correção de cor",
  blur: "o desfoque",
  motion: "o efeito de entrada ou saída",
  transitionIn: "a transição de entrada",
  transitionOut: "a transição de saída",
  cutTransition: "a transição de corte com o clipe vizinho",
  scaleAxes: "as chaves de scaleX e scaleY",
  anchor: "a âncora fora do centro",
  flip: "o espelhamento",
  tilt: "a rotação 3D (rotationX e rotationY)",
  shape: "a caixa fora da proporção do quadro",
  scaledLooks: "o desfoque ou os efeitos dentro de um grupo escalado",
  effectClips: "os clipes de efeito dentro de um grupo movido",
  speed: "a velocidade diferente de 1",
};

function keptText(properties: readonly KeptProperty[]): string {
  return `para desagrupar mantendo o resultado, tire do grupo antes: ${properties.map((property) => KEPT_TEXT[property]).join(", ")}`;
}

function grouped(doc: VideoDocument, op: GroupOpInput): GroupOpResult {
  const ids = op.clip_ids && op.clip_ids.length > 0 ? op.clip_ids : op.clip_id ? [op.clip_id] : [];
  const result = groupClips(doc, ids, op.name);
  if (!result.ok) return { ok: false, reason: groupRefusalText(result.reason, result.clipIds) };
  const extra = result.clipIds.filter((id) => !ids.includes(id));
  const notes = extra.length > 0 ? [`entraram junto, por estarem ligados ou vinculados aos escolhidos: ${extra.join(", ")}`] : [];
  return { ok: true, document: result.document, clipId: result.groupId, created: [result.groupId], changed: result.clipIds, notes };
}

function ungrouped(doc: VideoDocument, op: GroupOpInput): GroupOpResult {
  const id = op.clip_id ?? op.clip_ids?.[0];
  if (!id) return { ok: false, reason: "ungroup_clips precisa do clip_id do grupo" };
  if (!isGroupClip(findClip(doc, id)?.clip)) return { ok: false, reason: `o clipe ${id} não é um grupo nesta linha do tempo; ${READ_AGAIN}` };
  const result = ungroupClip(doc, id);
  if (result.ok) return { ok: true, document: result.document, clipId: result.clipIds[0] ?? id, created: result.nullId ? [result.nullId] : [], changed: result.clipIds, notes: result.nullId ? [`o nulo ${result.nullId} ficou com a posição, a rotação e a escala do grupo, e o conteúdo segue esse nulo`] : [] };
  if (result.reason === "keeps") return { ok: false, reason: keptText(result.properties) };
  if (result.reason === "locked") return { ok: false, reason: "o grupo ou uma faixa de dentro está travada; destrave com update_track antes" };
  if (result.reason === "seesThrough") return { ok: false, reason: `o clipe${listed(result.clipIds)} misturaria, recortaria ou aplicaria efeito também em clipes de fora do grupo; tire isso antes de desagrupar` };
  return { ok: false, reason: `o grupo ${id} não existe; ${READ_AGAIN}` };
}

export function groupOperation(doc: VideoDocument, op: GroupOpInput): GroupOpResult | null {
  if (op.op === "group_clips") return grouped(doc, op);
  if (op.op === "ungroup_clips") return ungrouped(doc, op);
  return null;
}

export function operationScope(doc: VideoDocument, op: GroupOpInput & Record<string, unknown>): GroupPath | string {
  if (op.group_id !== undefined) return insidePath(doc, op.group_id) ?? `o grupo ${op.group_id} não existe ou não é um grupo; ${READ_AGAIN}`;
  const ids = SCOPED_FIELDS.flatMap((field) => {
    const value = op[field];
    return typeof value === "string" ? [value] : Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  });
  const paths = ids.map((id) => pathOfId(doc, id));
  if (paths.length === 0 || paths.some((path) => path === null)) return [];
  const first = paths[0]!;
  const same = paths.every((path) => path!.length === first.length && path!.every((step, i) => step === first[i]));
  return same ? first : "os ids desta operação estão em linhas do tempo diferentes (dentro e fora de um grupo); faça uma operação por linha do tempo, com group_id para a de dentro";
}
