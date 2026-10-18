import type { VideoDocument } from "../document";
import { easeKeySides, MIN_INFLUENCE, reverseKeys, roveKeys, setKeysVelocity, setSmooth, stretchKeys, type EaseSide, type EaseSides, type KeyEdit, type SideChange, type StretchAnchor, type VelocityRefusal } from "../keyframe-ease";
import { ANIMATED_PROPERTIES, animatedProperties, carriesValue, keyframeFault, timedFramesOf, type AnimatedProperty, type Keyframes, type KeyRef } from "../keyframes";
import { findClip, updateClip } from "../timeline";
import { keyframeFaultText } from "./keyframe-text";

export const KEY_EASE_OPERATIONS = ["ease_keys", "smooth_keys", "reverse_keys", "time_stretch_keys", "rove_keys"] as const;

type KeyEaseOpName = (typeof KEY_EASE_OPERATIONS)[number];

export interface AgentKeyEaseFields {
  keys_ms?: number[];
  key_speed?: number;
  influence?: number;
  smooth?: boolean;
  percent?: number;
  from_key?: StretchAnchor;
}

interface KeyEaseOpInput extends AgentKeyEaseFields {
  op: string;
  clip_id?: string;
  property?: AnimatedProperty;
  side?: string;
}

type KeyEaseResult = { ok: true; document: VideoDocument; clipId: string } | { ok: false; reason: string };

const PERCENT = 100;
const EASE_SIDES: readonly EaseSides[] = ["in", "out", "both"];
const SIDE_TEXT: Record<EaseSide, string> = { in: "de chegada", out: "de saída" };

function refuse(reason: string): KeyEaseResult {
  return { ok: false, reason };
}

function isKeyEaseOp(name: string): name is KeyEaseOpName {
  return (KEY_EASE_OPERATIONS as readonly string[]).includes(name);
}

function chosenKeys(keyframes: Keyframes | undefined, op: KeyEaseOpInput): KeyRef[] | string {
  if (op.property !== undefined && !(ANIMATED_PROPERTIES as readonly string[]).includes(op.property)) return `property ${op.property} não existe; use uma de ${ANIMATED_PROPERTIES.join(", ")}`;
  const properties = op.property ? [op.property] : animatedProperties(keyframes);
  const all = properties.flatMap((property) => timedFramesOf(keyframes, property).map((frame) => ({ property, atMs: frame.atMs })));
  if (all.length === 0) return `o clipe ${op.clip_id} não tem chaves${op.property ? ` de ${op.property}` : ""}; anime antes com animate`;
  if (!op.keys_ms || op.keys_ms.length === 0) return all;
  const times = op.keys_ms.map(Math.round);
  const missing = times.find((at) => !all.some((key) => key.atMs === at));
  if (missing !== undefined) return `não há chave em ${missing} ms; as chaves estão em ${[...new Set(all.map((key) => key.atMs))].join(", ")} ms`;
  return all.filter((key) => times.includes(key.atMs));
}

function velocityText(refusal: VelocityRefusal): string {
  switch (refusal.kind) {
    case "influence":
      return `influence vai de ${MIN_INFLUENCE * PERCENT} a ${PERCENT} (por cento)`;
    case "noSide":
      return "as chaves escolhidas não têm esse lado: a primeira chave não tem chegada e a última não tem saída";
    case "notNumeric":
      return `${refusal.property} não tem velocidade em unidades; em fill e stroke use só influence ou key_speed 0`;
    case "flat":
      return `o trecho ${SIDE_TEXT[refusal.side]} da chave em ${refusal.atMs} ms não muda de valor, então só aceita key_speed 0`;
    case "steep":
      return refusal.range
        ? `com essa influence, a velocidade ${SIDE_TEXT[refusal.side]} da chave em ${refusal.atMs} ms vai de ${refusal.range[0]} a ${refusal.range[1]} por segundo`
        : `a velocidade ${SIDE_TEXT[refusal.side]} da chave em ${refusal.atMs} ms passa do que a curva alcança; diminua key_speed ou influence`;
  }
}

function easeKeys(keyframes: Keyframes | undefined, keys: KeyRef[], op: KeyEaseOpInput, aspect: number): Keyframes | undefined | string {
  if (!EASE_SIDES.includes(op.side as EaseSides)) return "ease_keys precisa de side: in suaviza a chegada na chave, out a saída, both os dois lados";
  const sides = op.side as EaseSides;
  if (op.key_speed === undefined && op.influence === undefined) {
    const eased = easeKeySides(keyframes, keys, sides);
    return eased.applied === 0 ? velocityText({ kind: "noSide" }) : eased.keyframes;
  }
  const change: SideChange = { ...(op.key_speed !== undefined ? { speed: op.key_speed } : {}), ...(op.influence !== undefined ? { influence: op.influence / PERCENT } : {}) };
  const result = setKeysVelocity(keyframes, keys, sides === "both" ? { in: change, out: change } : { [sides]: change }, aspect);
  return result.ok ? result.keyframes : velocityText(result.refusal);
}

function smoothKeys(keyframes: Keyframes | undefined, keys: KeyRef[], smooth: boolean): Keyframes | undefined | string {
  const rejected = keys.find((key) => !carriesValue(key.property));
  return rejected ? `smooth_keys vale para propriedades com número; ${rejected.property} usa ease_keys` : setSmooth(keyframes, keys, smooth);
}

function moved(edit: KeyEdit | null, name: string): Keyframes | string {
  return edit ? edit.keyframes : `${name} faria chaves caírem no mesmo instante ou passarem do limite do vídeo; escolha outras chaves`;
}

function rovingLanes(keys: KeyRef[]): boolean {
  return ANIMATED_PROPERTIES.some((property) => keys.filter((key) => key.property === property).length >= 3);
}

function edited(keyframes: Keyframes | undefined, keys: KeyRef[], op: KeyEaseOpInput, aspect: number): Keyframes | undefined | string {
  switch (op.op as KeyEaseOpName) {
    case "ease_keys":
      return easeKeys(keyframes, keys, op, aspect);
    case "smooth_keys":
      return smoothKeys(keyframes, keys, op.smooth ?? true);
    case "reverse_keys":
      return keys.length < 2 ? "reverse_keys precisa de pelo menos duas chaves" : moved(reverseKeys(keyframes ?? {}, keys), "reverse_keys");
    case "time_stretch_keys":
      if (op.percent === undefined || !(op.percent > 0)) return "time_stretch_keys precisa de percent maior que 0: 200 dobra o tempo entre as chaves, 50 corta pela metade";
      return moved(stretchKeys(keyframes ?? {}, keys, op.percent / PERCENT, op.from_key ?? "first"), "time_stretch_keys");
    case "rove_keys": {
      if (!rovingLanes(keys)) return "rove_keys precisa de pelo menos três chaves numa propriedade: a primeira e a última ficam, as do meio andam no tempo";
      const edit = roveKeys(keyframes ?? {}, keys, aspect);
      if (edit && edit.keyframes === keyframes) return "essas chaves não mudam de valor; não há velocidade para igualar";
      return moved(edit, "rove_keys");
    }
  }
}

export function keyEaseOperation(doc: VideoDocument, op: KeyEaseOpInput, aspect: number): KeyEaseResult | null {
  if (!isKeyEaseOp(op.op)) return null;
  const found = op.clip_id ? findClip(doc, op.clip_id) : null;
  if (!found) return refuse(`o clipe ${op.clip_id ?? "(sem id)"} não existe; leia o projeto de novo com studio_read`);
  if (found.track.locked) return refuse(`o clipe ${found.clip.id} está numa faixa travada; destrave com update_track antes`);
  const keys = chosenKeys(found.clip.keyframes, op);
  if (typeof keys === "string") return refuse(keys);
  const next = edited(found.clip.keyframes, keys, op, aspect);
  if (typeof next === "string") return refuse(next);
  const fault = keyframeFault(next, found.clip.transform);
  if (fault) return refuse(keyframeFaultText(fault));
  return { ok: true, document: updateClip(doc, found.clip.id, { keyframes: next }), clipId: found.clip.id };
}
