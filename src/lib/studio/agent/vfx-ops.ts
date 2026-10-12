import { newStudioId, type VideoDocument } from "../document";
import { isEasing, type Easing } from "../keyframes";
import { findClip } from "../timeline";
import { isValidColor } from "../validate";
import { isKeyedParam, isVfxKind, keyedParams, listensToTrack, newVfx, paramSpec, refusedOnEffectClips, randomSeed, VFX_KINDS, VFX_SEED_RANGE, vfxColors, vfxParams, type Vfx, type VfxColor, type VfxKind, type VfxParam } from "../vfx";
import { audioTracksOf } from "../vfx-tracks";
import { vfxParamHint } from "./keyframe-text";
import { addClipVfx, animateClipVfx, moveClipVfx, patchVfx, removeClipVfx, timelineOf, updateClipVfx, type VfxEdit, type VfxEditRefusal, type VfxPatch } from "../vfx-edit";

const DEFAULT_KEY_EASING: Easing = "easeInOut";

export type AgentVfxParams = Partial<Record<VfxParam, number>> & Partial<Record<VfxColor, string>>;

export interface AgentVfxFields {
  vfx_id?: string;
  vfx_kind?: VfxKind;
  vfx_property?: VfxParam;
  vfx_params?: AgentVfxParams;
  vfx_seed?: number;
  vfx_hidden?: boolean;
  vfx_track_id?: string;
}

export interface VfxOpInput extends AgentVfxFields {
  op: string;
  clip_id?: string;
  at_ms?: number;
  to_index?: number;
  keys?: { at_ms: number; value?: number; easing?: Easing }[];
}

export type VfxOpResult = { ok: true; document: VideoDocument; vfxId: string } | { ok: false; reason: string };

function rangesOf(kind: VfxKind): string {
  return vfxParams(kind)
    .map((name) => {
      const spec = paramSpec(kind, name)!;
      return `${name} de ${spec.range[0]} a ${spec.range[1]}`;
    })
    .join(", ");
}

function refusalText(reason: VfxEditRefusal, op: VfxOpInput): string {
  switch (reason) {
    case "missing":
      return `o clipe ${op.clip_id ?? "(sem id)"} não existe; leia o projeto de novo com studio_read`;
    case "locked":
      return `o clipe ${op.clip_id} está numa faixa travada; destrave com update_track antes`;
    case "notVisual":
      return `o clipe ${op.clip_id} é áudio; efeitos visuais valem só para clipes com imagem e clipes de efeito`;
    case "vfxMissing":
      return `o efeito ${op.vfx_id ?? "(sem id)"} não existe no clipe ${op.clip_id}; leia o projeto de novo com studio_read`;
    case "animated":
      return "esse valor do efeito tem chaves; mande at_ms (ms dentro do clipe) para gravar uma chave nesse momento, ou troque as chaves com animate_vfx";
    case "outside":
      return `as chaves precisam ficar entre 0 e a duração do clipe ${op.clip_id}`;
    case "paced":
      return `${op.vfx_property} marca um ritmo e não recebe chaves; anime um de: ${op.vfx_kind ? keyedParams(op.vfx_kind).join(", ") : "amount e os outros valores de intensidade"}`;
    case "invalid":
      return "o efeito ficaria inválido; leia os limites de vfx_params";
    case "noSound":
      return "audioSpectrum e audioWaveform precisam de vfx_track_id com uma faixa de áudio da mesma linha do tempo do clipe (dentro de um grupo, uma faixa do grupo)";
  }
}

export function vfxPatchOf(kind: VfxKind, params: AgentVfxParams | undefined): VfxPatch | string {
  const patch: Required<Pick<VfxPatch, "params" | "colors">> = { params: {}, colors: {} };
  for (const [name, value] of Object.entries(params ?? {})) {
    if (value === undefined) continue;
    if ((vfxColors(kind) as string[]).includes(name)) {
      if (typeof value !== "string" || !isValidColor(value, true) || value.length !== 7) return `${name} precisa ser uma cor #rrggbb`;
      patch.colors[name as VfxColor] = value;
      continue;
    }
    const spec = paramSpec(kind, name as VfxParam);
    if (!spec) return `${name} não vale para ${kind}; ${kind} aceita ${[...vfxParams(kind), ...vfxColors(kind)].join(", ")}`;
    if (typeof value !== "number" || !(value >= spec.range[0] && value <= spec.range[1])) return `${name} de ${kind} vai de ${spec.range[0]} a ${spec.range[1]} (${vfxParamHint(name as VfxParam)})`;
    patch.params[name as VfxParam] = value;
  }
  return patch;
}

export function seedIssue(seed: number | undefined): string | null {
  if (seed === undefined) return null;
  return Number.isInteger(seed) && seed >= VFX_SEED_RANGE[0] && seed <= VFX_SEED_RANGE[1] ? null : `vfx_seed é um inteiro de ${VFX_SEED_RANGE[0]} a ${VFX_SEED_RANGE[1]}`;
}

function soundTrackIssue(kind: VfxKind, trackId: string | undefined, timeline: VideoDocument | null): string | null {
  if (!listensToTrack(kind)) return trackId === undefined ? null : `vfx_track_id vale só para audioSpectrum e audioWaveform, não para ${kind}`;
  const audio = timeline ? [...audioTracksOf(timeline.tracks)] : [];
  if (trackId === undefined) return `${kind} precisa de vfx_track_id, a faixa de áudio que ele mostra${audio.length > 0 ? ` (${audio.join(", ")})` : "; o projeto não tem faixa de áudio, crie uma com add_track kind audio"}`;
  return timeline && !audio.includes(trackId) ? `${trackId} não é uma faixa de áudio dessa linha do tempo${audio.length > 0 ? `; use ${audio.join(", ")}` : ""}` : null;
}

export function agentVfx(op: AgentVfxFields, operation: string, timeline: VideoDocument | null = null): Vfx | string {
  if (!op.vfx_kind || !isVfxKind(op.vfx_kind)) return `${operation} precisa de vfx_kind: ${VFX_KINDS.join(", ")}`;
  const seed = seedIssue(op.vfx_seed);
  if (seed) return seed;
  const sound = soundTrackIssue(op.vfx_kind, op.vfx_track_id, timeline);
  if (sound) return sound;
  const patch = vfxPatchOf(op.vfx_kind, op.vfx_params);
  if (typeof patch === "string") return patch;
  const vfx = patchVfx(newVfx(op.vfx_kind, newStudioId("vfx"), op.vfx_seed ?? randomSeed()), { ...patch, ...(op.vfx_track_id !== undefined ? { trackId: op.vfx_track_id } : {}) }, null);
  return typeof vfx === "string" ? `${op.vfx_kind}: ${rangesOf(op.vfx_kind)}` : vfx;
}

function settled(result: VfxEdit, op: VfxOpInput, vfxId: string): VfxOpResult {
  return result.ok ? { ok: true, document: result.document, vfxId } : { ok: false, reason: refusalText(result.reason, op) };
}

export interface VfxHolder {
  name: string;
  missing: string;
}

export function pickVfx(list: readonly Vfx[], vfxId: string | undefined, holder: VfxHolder): { vfx: Vfx } | { reason: string } {
  const vfx = vfxId ? list.find((entry) => entry.id === vfxId) : list.length === 1 ? list[0] : undefined;
  if (vfx) return { vfx };
  if (vfxId) return { reason: holder.missing };
  return { reason: list.length === 0 ? `${holder.name} não tem efeitos; use add_vfx` : `${holder.name} tem ${list.length} efeitos; mande vfx_id (${list.map((entry) => `${entry.id} ${entry.kind}`).join(", ")})` };
}

function target(doc: VideoDocument, op: VfxOpInput): { vfx: Vfx } | { reason: string } {
  const clip = findClip(doc, op.clip_id ?? "")?.clip;
  if (!clip) return { reason: refusalText("missing", op) };
  return pickVfx(clip.vfx ?? [], op.vfx_id, { name: `o clipe ${op.clip_id}`, missing: refusalText("vfxMissing", op) });
}

export const ECHO_ON_EFFECT_CLIP = "echo repete o próprio clipe em instantes anteriores e não vale num clipe de efeito; ponha o echo no clipe que se move";

function addVfx(doc: VideoDocument, op: VfxOpInput): VfxOpResult {
  const vfx = agentVfx(op, "add_vfx", timelineOf(doc, op.clip_id));
  if (typeof vfx === "string") return { ok: false, reason: vfx };
  if (findClip(doc, op.clip_id ?? "")?.clip.type === "effect" && refusedOnEffectClips(vfx.kind)) return { ok: false, reason: ECHO_ON_EFFECT_CLIP };
  return settled(addClipVfx(doc, op.clip_id ?? "", vfx, op.to_index), op, vfx.id);
}

function updateVfx(doc: VideoDocument, op: VfxOpInput): VfxOpResult {
  const found = target(doc, op);
  if ("reason" in found) return { ok: false, reason: found.reason };
  const seed = seedIssue(op.vfx_seed);
  if (seed) return { ok: false, reason: seed };
  const patch = vfxPatchOf(found.vfx.kind, op.vfx_params);
  if (typeof patch === "string") return { ok: false, reason: patch };
  if (op.vfx_track_id !== undefined && !listensToTrack(found.vfx.kind)) return { ok: false, reason: `vfx_track_id vale só para audioSpectrum e audioWaveform, não para ${found.vfx.kind}` };
  return settled(updateClipVfx(doc, op.clip_id!, found.vfx.id, { ...patch, seed: op.vfx_seed, hidden: op.vfx_hidden, trackId: op.vfx_track_id }, op.at_ms ?? null), op, found.vfx.id);
}

function animateVfx(doc: VideoDocument, op: VfxOpInput): VfxOpResult {
  const found = target(doc, op);
  if ("reason" in found) return { ok: false, reason: found.reason };
  const kind = found.vfx.kind;
  const name = op.vfx_property;
  if (!name || !paramSpec(kind, name)) return { ok: false, reason: `animate_vfx precisa de vfx_property: ${keyedParams(kind).join(", ")}` };
  if (!isKeyedParam(kind, name)) return { ok: false, reason: refusalText("paced", { ...op, vfx_kind: kind }) };
  const keys = op.keys ?? [];
  if (keys.some((key) => typeof key.value !== "number")) return { ok: false, reason: `as chaves de ${name} precisam de value` };
  if (keys.some((key) => key.easing !== undefined && !isEasing(key.easing))) return { ok: false, reason: "uma das chaves tem uma curva (easing) que não existe" };
  const [low, high] = paramSpec(kind, name)!.range;
  if (keys.some((key) => key.value! < low || key.value! > high)) return { ok: false, reason: `${name} de ${kind} vai de ${low} a ${high} (${vfxParamHint(name)})` };
  const frames = keys.map((key) => ({ atMs: Math.round(key.at_ms), value: key.value!, easing: key.easing ?? DEFAULT_KEY_EASING }));
  return settled(animateClipVfx(doc, op.clip_id!, found.vfx.id, name, frames), { ...op, vfx_kind: kind }, found.vfx.id);
}

function onTarget(doc: VideoDocument, op: VfxOpInput, edit: (vfxId: string) => VfxEdit): VfxOpResult {
  const found = target(doc, op);
  if ("reason" in found) return { ok: false, reason: found.reason };
  return settled(edit(found.vfx.id), op, found.vfx.id);
}

export function vfxOperation(doc: VideoDocument, op: VfxOpInput): VfxOpResult | null {
  switch (op.op) {
    case "add_vfx":
      return addVfx(doc, op);
    case "update_vfx":
      return updateVfx(doc, op);
    case "animate_vfx":
      return animateVfx(doc, op);
    case "move_vfx":
      return onTarget(doc, op, (vfxId) => moveClipVfx(doc, op.clip_id!, vfxId, op.to_index ?? 0));
    case "remove_vfx":
      return onTarget(doc, op, (vfxId) => removeClipVfx(doc, op.clip_id!, vfxId));
  }
  return null;
}
