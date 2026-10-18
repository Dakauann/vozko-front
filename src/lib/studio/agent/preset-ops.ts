import { applyAnimation, presetAnimationIssue, PRESET_TIMINGS, type AnimationPreset, type PresetTiming } from "../animation-presets";
import type { VideoDocument } from "../document";
import type { AgentFocus } from "./batch";

export const PRESET_OPERATIONS = ["apply_animation_preset"] as const;

type PresetOpName = (typeof PRESET_OPERATIONS)[number];

export interface AgentPresetFields {
  preset_id?: string;
  preset_timing?: PresetTiming;
}

interface PresetOpInput extends AgentPresetFields {
  op: string;
  clip_id?: string;
  clip_ids?: string[];
}

export type PresetLookup = { ok: true; find: (id: string) => AnimationPreset | undefined } | { ok: false };

type PresetOpResult = { ok: true; document: VideoDocument; focus: AgentFocus; changed: string[]; notes: string[] } | { ok: false; reason: string };

const READ_AGAIN = "leia o projeto de novo com studio_read";

const SKIPPED_TEXT: Record<string, string> = {
  textIn: "entrada do texto",
  textOut: "saída do texto",
  textAnimators: "animadores de texto",
  vfx: "efeitos",
  motionBlur: "desfoque de movimento",
  behaviors: "comportamentos que o clipe não aceita",
  "keys:opacity,blur": "chaves de opacidade e desfoque",
  motionIn: "entrada",
  motionOut: "saída",
  transitionIn: "transição de entrada",
  transitionOut: "transição de saída",
};

function isPresetOp(name: string): name is PresetOpName {
  return (PRESET_OPERATIONS as readonly string[]).includes(name);
}

export function presetIdsOf(ops: readonly { op: string; preset_id?: string }[]): string[] {
  return [...new Set(ops.flatMap((op) => (op.op === "apply_animation_preset" && op.preset_id ? [op.preset_id] : [])))];
}

export function presetOperation(doc: VideoDocument, op: PresetOpInput, presets: PresetLookup | undefined): PresetOpResult | null {
  if (!isPresetOp(op.op)) return null;
  if (!presets?.ok) return { ok: false, reason: "as predefinições de animação do workspace não puderam ser lidas agora; nada foi aplicado; tente de novo" };
  const ids = op.clip_ids?.length ? op.clip_ids : op.clip_id ? [op.clip_id] : [];
  if (ids.length === 0) return { ok: false, reason: "apply_animation_preset precisa de clip_id ou clip_ids" };
  if (!op.preset_id) return { ok: false, reason: "apply_animation_preset precisa de preset_id; liste com studio_animation_presets" };
  const preset = presets.find(op.preset_id);
  if (!preset) return { ok: false, reason: `a predefinição ${op.preset_id} não existe neste workspace; liste com studio_animation_presets` };
  if (presetAnimationIssue(preset.animation) !== null) return { ok: false, reason: `a predefinição ${preset.name} está inválida e não foi aplicada` };
  const timing = op.preset_timing ?? "stretch";
  if (!(PRESET_TIMINGS as readonly string[]).includes(timing)) return { ok: false, reason: `preset_timing deve ser um de: ${PRESET_TIMINGS.join(", ")}` };
  const result = applyAnimation(doc, ids, preset.animation, timing);
  if (!result.ok) {
    if (result.reason === "missing") return { ok: false, reason: `o clipe ${result.clipId} não existe; ${READ_AGAIN}` };
    if (result.reason === "locked") return { ok: false, reason: `a faixa do clipe ${result.clipId} está travada; destrave antes` };
    return { ok: false, reason: `a predefinição ${preset.name} não cabe no clipe ${result.clipId} (${result.code}): as chaves levariam o clipe para fora dos limites; ajuste a posição do clipe ou use outra predefinição` };
  }
  const notes = Object.entries(result.skipped).map(([clipId, parts]) => `clipe ${clipId}: ficou de fora ${parts.map((part) => SKIPPED_TEXT[part] ?? part).join(", ")}`);
  return { ok: true, document: result.document, focus: { kind: "clip", clipId: ids[0] }, changed: ids, notes };
}
