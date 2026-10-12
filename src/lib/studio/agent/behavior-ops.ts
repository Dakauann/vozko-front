import { addBehavior, bakeBehavior, defaultReactTrack, draftBehavior, foreignSettings, randomBehaviorSeed, removeBehavior, updateBehavior, type BehaviorRefusal, type BehaviorSettings } from "../behavior-edit";
import {
  BEHAVIOR_FIELDS,
  BEHAVIOR_KINDS,
  BEHAVIOR_LIMITS,
  BEHAVIOR_SPANS,
  behaviorProperties,
  isBehaviorKind,
  isBehaviorProperty,
  isLoopMode,
  isLoopSide,
  LOOP_MODES,
  LOOP_SIDES,
  NO_LEVELS,
  type Behavior,
  type BehaviorKind,
  type BehaviorProperty,
  type LoopMode,
  type LoopSide,
  type TrackLevels,
} from "../behaviors";
import type { VideoDocument } from "../document";
import { findClip } from "../timeline";

export const BEHAVIOR_OPERATIONS = ["add_behavior", "update_behavior", "remove_behavior", "bake_behavior"] as const;

export type BehaviorOpName = (typeof BEHAVIOR_OPERATIONS)[number];

export interface AgentBehaviorParams {
  frequency?: number;
  amount?: number;
  seed?: number;
  mode?: LoopMode;
  side?: LoopSide;
  rate?: number;
  amplitude?: number;
  decay?: number;
  floor_db?: number;
  ceiling_db?: number;
}

export interface AgentBehaviorFields {
  behavior_id?: string;
  behavior_kind?: BehaviorKind;
  behavior?: AgentBehaviorParams;
  audio_track_id?: string;
}

export interface BehaviorOpInput extends AgentBehaviorFields {
  op: string;
  clip_id?: string;
  property?: string;
}

export type BehaviorOpResult = { ok: true; document: VideoDocument; behaviorId: string; notes: string[] } | { ok: false; reason: string };

const READ_AGAIN = "leia o projeto de novo com studio_read";

const AGENT_FIELD: Record<string, string> = { floorDb: "floor_db", ceilingDb: "ceiling_db", trackId: "audio_track_id" };

function agentName(field: string): string {
  return AGENT_FIELD[field] ?? field;
}

export function isBehaviorOp(name: string): name is BehaviorOpName {
  return (BEHAVIOR_OPERATIONS as readonly string[]).includes(name);
}

function refuse(reason: string): BehaviorOpResult {
  return { ok: false, reason };
}

export function behaviorRefusalText(reason: BehaviorRefusal, op: BehaviorOpInput): string {
  switch (reason) {
    case "missing":
      return `o clipe ${op.clip_id ?? "(sem id)"} não existe; ${READ_AGAIN}`;
    case "locked":
      return `o clipe ${op.clip_id} está numa faixa travada; destrave com update_track antes`;
    case "notVisual":
      return "comportamentos valem só para clipes com imagem: vídeo, imagem, texto, forma, ícone e nulo";
    case "invalid":
      return "o comportamento ficaria fora dos limites; confira os valores de behavior";
    case "behaviorMissing":
      return `o comportamento ${op.behavior_id ?? "(sem id)"} não existe no clipe ${op.clip_id}; ${READ_AGAIN}`;
    case "property":
      return `esse clipe não recebe comportamento em ${op.property}; nulos aceitam x, y, scale, scaleX, scaleY e rotation, os outros clipes com imagem aceitam também opacity e blur`;
    case "duplicate":
      return `${op.property} já tem um comportamento ${op.behavior_kind}; mude o que existe com update_behavior`;
    case "track":
      return "audioReact precisa de audio_track_id com uma faixa de som do projeto; crie uma com add_track kind audio";
    case "field":
      return "behavior tem um campo que não vale para esse tipo de comportamento";
    case "path":
      return "o clipe anda por um trajeto curvo (position); assar x ou y apagaria o trajeto; separe com set_path curved false antes";
    case "rival":
      return "assar aqui apagaria as chaves rivais (scale contra scaleX e scaleY); junte ou separe com scale_axes antes";
    case "unheard":
      return "o som dessa faixa ainda não foi lido; tente de novo daqui a pouco";
  }
}

const RANGES: Record<string, (property: BehaviorProperty) => readonly [number, number]> = {
  frequency: () => BEHAVIOR_LIMITS.frequency,
  amplitude: () => BEHAVIOR_LIMITS.amplitude,
  decay: () => BEHAVIOR_LIMITS.decay,
  floorDb: () => BEHAVIOR_LIMITS.db,
  ceilingDb: () => BEHAVIOR_LIMITS.db,
  seed: () => BEHAVIOR_LIMITS.seed,
  rate: (property) => [-BEHAVIOR_SPANS[property], BEHAVIOR_SPANS[property]],
};

function amountRange(kind: BehaviorKind, property: BehaviorProperty): readonly [number, number] {
  const span = BEHAVIOR_SPANS[property];
  return kind === "wiggle" ? [0, span] : [-span, span];
}

function settingsOf(op: BehaviorOpInput): BehaviorSettings {
  const params = op.behavior ?? {};
  const settings: BehaviorSettings = {
    frequency: params.frequency,
    amount: params.amount,
    seed: params.seed,
    mode: params.mode,
    side: params.side,
    rate: params.rate,
    amplitude: params.amplitude,
    decay: params.decay,
    floorDb: params.floor_db,
    ceilingDb: params.ceiling_db,
    trackId: op.audio_track_id,
  };
  return Object.fromEntries(Object.entries(settings).filter(([, value]) => value !== undefined)) as BehaviorSettings;
}

function settingsIssue(kind: BehaviorKind, property: BehaviorProperty, settings: BehaviorSettings): string | null {
  const foreign = foreignSettings(kind, settings);
  if (foreign.length > 0) return `${kind} não usa ${foreign.map(agentName).join(", ")}; ${kind} aceita ${BEHAVIOR_FIELDS[kind].map(agentName).join(", ")}`;
  if (settings.mode !== undefined && !isLoopMode(settings.mode)) return `mode deve ser um de: ${LOOP_MODES.join(", ")}`;
  if (settings.side !== undefined && !isLoopSide(settings.side)) return `side deve ser um de: ${LOOP_SIDES.join(", ")}`;
  if (settings.seed !== undefined && !Number.isInteger(settings.seed)) return "seed é um número inteiro";
  for (const [field, value] of Object.entries(settings)) {
    if (typeof value !== "number") continue;
    const [low, high] = field === "amount" ? amountRange(kind, property) : RANGES[field](property);
    if (!(value >= low && value <= high)) return `${agentName(field)} de ${kind} em ${property} vai de ${low} a ${high}`;
  }
  return null;
}

function addOp(doc: VideoDocument, op: BehaviorOpInput): BehaviorOpResult {
  const found = op.clip_id ? findClip(doc, op.clip_id) : null;
  if (!found) return refuse(behaviorRefusalText("missing", op));
  if (!op.behavior_kind || !isBehaviorKind(op.behavior_kind)) return refuse(`add_behavior precisa de behavior_kind, um de: ${BEHAVIOR_KINDS.join(", ")}`);
  if (!op.property || !isBehaviorProperty(op.property) || !behaviorProperties(found.clip.type).includes(op.property)) return refuse(behaviorRefusalText("property", op));
  const settings = settingsOf(op);
  const issue = settingsIssue(op.behavior_kind, op.property, settings);
  if (issue) return refuse(issue);
  const behavior = draftBehavior(op.behavior_kind, op.property, settings, randomBehaviorSeed(), defaultReactTrack(doc));
  if (typeof behavior === "string") return refuse(behaviorRefusalText(behavior, op));
  const edit = addBehavior(doc, found.clip.id, behavior);
  if (!edit.ok) return refuse(behaviorRefusalText(edit.reason, op));
  const notes = keylessNote(behavior, found.clip.keyframes?.[behavior.property]?.length ?? 0);
  return { ok: true, document: edit.document, behaviorId: behavior.id, notes };
}

function keylessNote(behavior: Behavior, keys: number): string[] {
  if ((behavior.kind === "loop" || behavior.kind === "overshoot") && keys < 2) return [`${behavior.kind} em ${behavior.property} só tem efeito com pelo menos duas chaves nessa propriedade; anime com animate`];
  return [];
}

function targetOf(doc: VideoDocument, op: BehaviorOpInput): Behavior | string {
  const found = op.clip_id ? findClip(doc, op.clip_id) : null;
  if (!found) return behaviorRefusalText("missing", op);
  if (!op.behavior_id) return `${op.op} precisa de behavior_id; ${READ_AGAIN}`;
  return found.clip.behaviors?.find((behavior) => behavior.id === op.behavior_id) ?? behaviorRefusalText("behaviorMissing", op);
}

function updateOp(doc: VideoDocument, op: BehaviorOpInput): BehaviorOpResult {
  const target = targetOf(doc, op);
  if (typeof target === "string") return refuse(target);
  const settings = settingsOf(op);
  if (Object.keys(settings).length === 0) return refuse(`update_behavior precisa de behavior com algum de: ${BEHAVIOR_FIELDS[target.kind].map(agentName).join(", ")}`);
  const issue = settingsIssue(target.kind, target.property, settings);
  if (issue) return refuse(issue);
  const edit = updateBehavior(doc, op.clip_id!, target.id, settings);
  if (!edit.ok) return refuse(behaviorRefusalText(edit.reason, { ...op, property: target.property, behavior_kind: target.kind }));
  return { ok: true, document: edit.document, behaviorId: target.id, notes: [] };
}

function removeOp(doc: VideoDocument, op: BehaviorOpInput): BehaviorOpResult {
  const target = targetOf(doc, op);
  if (typeof target === "string") return refuse(target);
  const edit = removeBehavior(doc, op.clip_id!, target.id);
  if (!edit.ok) return refuse(behaviorRefusalText(edit.reason, op));
  return { ok: true, document: edit.document, behaviorId: target.id, notes: [] };
}

function bakeOp(doc: VideoDocument, op: BehaviorOpInput, levels: TrackLevels): BehaviorOpResult {
  const target = targetOf(doc, op);
  if (typeof target === "string") return refuse(target);
  const baked = bakeBehavior(doc, op.clip_id!, target.id, levels);
  if (!baked.ok) return refuse(behaviorRefusalText(baked.reason, op));
  const notes = [`${baked.keys} chaves lineares em ${target.property}, uma por quadro; comportamentos assados juntos: ${baked.absorbed.join(", ")}`];
  if (baked.clamped > 0) notes.push(`${baked.clamped} quadros passavam do limite de ${target.property} e ficaram no limite`);
  return { ok: true, document: baked.document, behaviorId: target.id, notes };
}

export function behaviorOperation(doc: VideoDocument, op: BehaviorOpInput, levels: TrackLevels = NO_LEVELS): BehaviorOpResult | null {
  if (!isBehaviorOp(op.op)) return null;
  switch (op.op) {
    case "add_behavior":
      return addOp(doc, op);
    case "update_behavior":
      return updateOp(doc, op);
    case "remove_behavior":
      return removeOp(doc, op);
    case "bake_behavior":
      return bakeOp(doc, op, levels);
  }
}

export type OutlineBehavior = { id: string; kind: BehaviorKind; property: BehaviorProperty; offset_ms?: number } & AgentBehaviorParams & { audio_track_id?: string };

export function behaviorOutline(behavior: Behavior): OutlineBehavior {
  const { id, kind, property, offsetMs, ...params } = behavior;
  const named = Object.fromEntries(Object.entries(params).map(([field, value]) => [agentName(field), value]));
  return { id, kind, property, ...named, ...(offsetMs ? { offset_ms: offsetMs } : {}) };
}
