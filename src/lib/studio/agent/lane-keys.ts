import type { VideoDocument } from "../document";
import { isEasing, type Easing, type Keyframe } from "../keyframes";
import type { MorphKeyframe } from "../morph-keys";
import { pathVertices, vertexPin } from "../path-morph";
import { findClip } from "../timeline";

export interface AgentLaneKey {
  at_ms: number;
  value?: number;
  easing?: Easing;
}

export const DEFAULT_KEY_EASING: Easing = "easeInOut";

export interface AgentPathKey extends AgentLaneKey {
  path?: string;
  first_vertex?: number;
}

function timingIssue(doc: VideoDocument, clipId: string | undefined, keys: readonly AgentLaneKey[]): string | null {
  if (keys.some((key) => key.easing !== undefined && !isEasing(key.easing))) return "uma das chaves tem uma curva (easing) que não existe";
  const durationMs = findClip(doc, clipId ?? "")?.clip.durationMs;
  if (durationMs !== undefined && keys.some((key) => key.at_ms < 0 || key.at_ms > durationMs)) return `as chaves vão de 0 a ${durationMs} ms, o tempo dentro do clipe ${clipId}`;
  return null;
}

export function laneFrames(doc: VideoDocument, clipId: string | undefined, property: string, keys: readonly AgentLaneKey[]): Keyframe[] | string {
  if (keys.some((key) => typeof key.value !== "number")) return `as chaves de ${property} precisam de value`;
  const timing = timingIssue(doc, clipId, keys);
  if (timing) return timing;
  return keys.map((key) => ({ atMs: Math.round(key.at_ms), value: key.value!, easing: key.easing ?? DEFAULT_KEY_EASING }));
}

export const PATH_KEYS_TEXT = "as chaves de path precisam de path: um caminho SVG com coordenadas de 0 a 1 na caixa (comandos M L H V C S Q T A Z)";

export function morphLaneFrames(doc: VideoDocument, clipId: string | undefined, keys: readonly AgentPathKey[]): MorphKeyframe[] | string {
  if (keys.some((key) => typeof key.path !== "string")) return PATH_KEYS_TEXT;
  const timing = timingIssue(doc, clipId, keys);
  if (timing) return timing;
  const frames: MorphKeyframe[] = [];
  for (const key of keys) {
    const atMs = Math.round(key.at_ms);
    const pin = key.first_vertex === undefined ? null : vertexPin(key.path!, key.first_vertex);
    if (key.first_vertex !== undefined && !pin) return `first_vertex ${key.first_vertex} não existe na chave em ${atMs} ms; o caminho dela tem ${pathVertices(key.path!).length} pontos, numerados de 0 na ordem em que são desenhados`;
    frames.push({ atMs, path: key.path!, easing: key.easing ?? DEFAULT_KEY_EASING, ...(pin ? { firstVertex: pin } : {}) });
  }
  return frames;
}

export function clipAccessText(reason: "missing" | "locked", clipId: string | undefined): string {
  return reason === "missing" ? `o clipe ${clipId ?? "(sem id)"} não existe; leia o projeto de novo com studio_read` : `o clipe ${clipId} está numa faixa travada; destrave com update_track antes`;
}
