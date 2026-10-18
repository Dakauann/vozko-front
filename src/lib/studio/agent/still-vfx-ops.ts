import type { ImageSurface } from "../document";
import { isStillKind, STILL_VFX_KINDS, stillParams } from "../still-vfx";
import { addingVfx, editSurfaceVfx, movingVfx, patchingVfx, removingVfx, targetVfx, type StillVfxChange, type StillVfxTarget, type SurfaceVfxRefusal } from "../still-vfx-edit";
import { vfxColors, type VfxKind } from "../vfx";
import { agentVfx, pickVfx, seedIssue, vfxPatchOf, type AgentVfxFields, type AgentVfxParams, type VfxHolder } from "./vfx-ops";

export const STILL_VFX_OPERATIONS = ["add_vfx", "update_vfx", "move_vfx", "remove_vfx"] as const;

export type StillVfxOpName = (typeof STILL_VFX_OPERATIONS)[number];

export interface AgentStillVfxFields extends Omit<AgentVfxFields, "vfx_property"> {
  to_index?: number;
}

interface StillVfxOpInput extends AgentStillVfxFields {
  op: StillVfxOpName;
  layer_id?: string;
}

type StillVfxOpResult = { ok: true; surface: ImageSurface; vfxId: string } | { ok: false; reason: string };

const KIND_LIST = STILL_VFX_KINDS.join(", ");

export function isStillVfxOperation(op: string): op is StillVfxOpName {
  return (STILL_VFX_OPERATIONS as readonly string[]).includes(op);
}

function refusalText(reason: SurfaceVfxRefusal, op: StillVfxOpInput, holder: VfxHolder): string {
  switch (reason) {
    case "missing":
      return `a camada ${op.layer_id} não existe; leia o projeto de novo com studio_read`;
    case "notImage":
      return `a camada ${op.layer_id} não é uma imagem; efeitos visuais valem para fotos e, sem layer_id, para a prancheta inteira`;
    case "locked":
      return `a camada ${op.layer_id} está travada; destrave com set_locked antes`;
    case "vfxMissing":
      return holder.missing;
    case "invalid":
      return "o efeito ficaria inválido; leia os limites de vfx_params";
  }
}

function stillParamsIssue(kind: VfxKind, params: AgentVfxParams | undefined): string | null {
  const allowed: string[] = [...stillParams(kind), ...vfxColors(kind)];
  const extra = Object.entries(params ?? {}).find(([name, value]) => value !== undefined && !allowed.includes(name));
  return extra ? `${extra[0]} não vale numa imagem parada; ${kind} aceita ${allowed.join(", ")}` : null;
}

function applied(surface: ImageSurface, target: StillVfxTarget, change: StillVfxChange, op: StillVfxOpInput, holder: VfxHolder, vfxId: string): StillVfxOpResult {
  const edit = editSurfaceVfx(surface, target, change);
  return edit.ok ? { ok: true, surface: edit.surface, vfxId } : { ok: false, reason: refusalText(edit.reason, op, holder) };
}

function added(surface: ImageSurface, op: StillVfxOpInput, target: StillVfxTarget, holder: VfxHolder): StillVfxOpResult {
  if (!op.vfx_kind || !isStillKind(op.vfx_kind)) return { ok: false, reason: `add_vfx numa imagem precisa de vfx_kind: ${KIND_LIST}` };
  const extra = stillParamsIssue(op.vfx_kind, op.vfx_params);
  if (extra) return { ok: false, reason: extra };
  const vfx = agentVfx(op, "add_vfx");
  if (typeof vfx === "string") return { ok: false, reason: vfx };
  return applied(surface, target, addingVfx(vfx, op.to_index), op, holder, vfx.id);
}

export function stillVfxOperation(surface: ImageSurface, op: StillVfxOpInput, target: StillVfxTarget, holder: VfxHolder): StillVfxOpResult {
  const reachable = editSurfaceVfx(surface, target, (list) => list);
  if (!reachable.ok) return { ok: false, reason: refusalText(reachable.reason, op, holder) };
  if (op.op === "add_vfx") return added(surface, op, target, holder);
  const found = pickVfx(targetVfx(surface, target) ?? [], op.vfx_id, holder);
  if ("reason" in found) return { ok: false, reason: found.reason };
  const { vfx } = found;
  switch (op.op) {
    case "update_vfx": {
      const seed = seedIssue(op.vfx_seed);
      if (seed) return { ok: false, reason: seed };
      const extra = stillParamsIssue(vfx.kind, op.vfx_params);
      if (extra) return { ok: false, reason: extra };
      const patch = vfxPatchOf(vfx.kind, op.vfx_params);
      if (typeof patch === "string") return { ok: false, reason: patch };
      return applied(surface, target, patchingVfx(vfx.id, { ...patch, seed: op.vfx_seed, hidden: op.vfx_hidden }), op, holder, vfx.id);
    }
    case "move_vfx":
      return applied(surface, target, movingVfx(vfx.id, op.to_index ?? 0), op, holder, vfx.id);
    case "remove_vfx":
      return applied(surface, target, removingVfx(vfx.id), op, holder, vfx.id);
  }
}
