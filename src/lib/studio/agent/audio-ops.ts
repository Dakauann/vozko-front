import { PAN_RANGE } from "../audio-pan";
import type { VideoDocument } from "../document";
import type { SpeechSource } from "../ducking";
import { formatLevel } from "../live-meter";
import { LOUDNESS_TARGET_RANGE, LOUDNESS_TARGETS, normalizeLoudness, type LoudnessSource, type NormalizeRefusal, type NormalizeTarget } from "../loudness";

export interface AgentAudioFields {
  pan?: number;
  target_lufs?: number;
}

interface NormalizeFields extends AgentAudioFields {
  clip_id?: string;
  clip_ids?: string[];
  track_id?: string;
}

type AudioOpResult = { ok: true; document: VideoDocument; changed: string[]; notes: string[] } | { ok: false; reason: string };

export const PAN_TEXT = `pan vai de ${PAN_RANGE[0]} (tudo à esquerda) a ${PAN_RANGE[1]} (tudo à direita) e 0 é o centro`;

const TARGET_TEXT = `target_lufs vai de ${LOUDNESS_TARGET_RANGE[0]} a ${LOUDNESS_TARGET_RANGE[1]}: ${LOUDNESS_TARGETS.social} para redes sociais, ${LOUDNESS_TARGETS.podcast} para podcast, ${LOUDNESS_TARGETS.broadcast} para TV`;

function normalizeTargetOf(op: NormalizeFields): NormalizeTarget | string {
  const clipIds = op.clip_ids && op.clip_ids.length > 0 ? op.clip_ids : op.clip_id ? [op.clip_id] : [];
  if (clipIds.length > 0 && op.track_id) return "normalize_loudness usa clip_ids ou track_id, não os dois";
  if (op.track_id) return { trackId: op.track_id };
  if (clipIds.length > 0) return { clipIds };
  return "normalize_loudness precisa de clip_ids (ou clip_id) para ajustar cada clipe, ou de track_id para ajustar a faixa inteira";
}

function refusalText(reason: NormalizeRefusal, id: string | undefined): string {
  const subject = id ?? "o alvo";
  switch (reason) {
    case "missing":
      return `${subject} não existe; leia o projeto de novo com studio_read`;
    case "locked":
      return `${subject} está numa faixa travada; destrave com update_track antes`;
    case "notAudio":
      return `${subject} não é áudio; normalize_loudness vale só para clipes e faixas de áudio`;
    case "target":
      return TARGET_TEXT;
    case "unmeasured":
      return `ainda não deu para medir o som de ${subject}: a mídia não carregou ou a fala das faixas que abaixam esta não foi analisada; tente de novo em instantes`;
    case "silent":
      return `${subject} está em silêncio, não há o que normalizar`;
  }
}

export function normalizeOperation(doc: VideoDocument, op: NormalizeFields, loudness: LoudnessSource, speech: SpeechSource): AudioOpResult {
  const target = normalizeTargetOf(op);
  if (typeof target === "string") return { ok: false, reason: target };
  if (op.target_lufs === undefined) return { ok: false, reason: `normalize_loudness precisa de target_lufs; ${TARGET_TEXT}` };
  const result = normalizeLoudness(doc, target, op.target_lufs, loudness, speech);
  if (!result.ok) return { ok: false, reason: refusalText(result.reason, result.id) };
  const notes = result.parts.map((part) => `${part.id}: medido ${formatLevel(part.measured)} LUFS, ganho ${formatLevel(part.gainDb)} dB${part.limited ? " (o ganho chegou ao máximo e o som ficou abaixo do alvo)" : ""}`);
  return { ok: true, document: result.document, changed: result.parts.map((part) => part.id), notes };
}
