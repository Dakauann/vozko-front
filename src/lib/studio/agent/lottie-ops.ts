import type { CanvasSize } from "../document";
import type { GroupClip } from "../group-scope";
import type { LottieFileFault } from "../lottie/lottie-file";
import type { LottieGap, LottieGapCode } from "../lottie/lottie-gaps";
import { lottieClip } from "../lottie/lottie-import";
import type { LottieAnimation } from "../lottie/lottie-types";

export const LOTTIE_OPERATIONS = ["import_lottie"] as const;

export interface LottieSource {
  name: string;
  animation: LottieAnimation | null;
  fault?: LottieFileFault;
}

export type LottieLookup = (mediaId: string) => LottieSource | undefined;

interface AgentLottieFields {
  media_id?: string;
  at_ms?: number;
}

const GAP_TEXT: Record<LottieGapCode, string> = {
  expression: "expressões",
  effects: "efeitos de camada",
  image: "camadas de imagem",
  text: "camadas de texto",
  audio: "camadas de som",
  camera: "câmeras",
  layerKind: "um tipo de camada desconhecido",
  trackMatte: "máscaras de trilha (uma camada recortando outra)",
  threeD: "camadas em 3D",
  timeRemap: "remapeamento de tempo",
  timeStretch: "camadas esticadas no tempo",
  skew: "inclinação (skew)",
  anchorMotion: "ponto de âncora animado",
  negativeScale: "escala negativa",
  blendMode: "um modo de mesclagem desconhecido",
  gradient: "degradês em preenchimento ou contorno",
  merge: "mesclagem de caminhos",
  repeater: "repetidor",
  roundCorners: "cantos arredondados como modificador",
  twist: "torção",
  offsetPath: "deslocamento de caminho",
  pucker: "contrair e inflar",
  zigzag: "zigue-zague",
  shapeKind: "um tipo de forma desconhecido",
  starRoundness: "estrela ou polígono com pontas arredondadas",
  trimOnFill: "corte de traçado aplicado a um preenchimento",
  doubleTrim: "mais de um corte de traçado na mesma forma",
  strokeWidthMotion: "espessura de contorno animada",
  dashMotion: "tracejado animado",
  maskMode: "um modo de máscara além de somar, subtrair e intersectar",
  maskInMovingGroup: "máscara numa camada cujo grupo interno se move",
  missingAsset: "uma pré-composição que não está no arquivo",
  outOfBounds: "posições ou tamanhos muito fora do quadro",
  tooLong: "duração acima de 10 minutos",
  empty: "nada visível para importar",
  invalid: "estrutura inválida",
};

const FAULT_TEXT: Record<LottieFileFault, string> = {
  notLottie: "o arquivo não é uma animação Lottie",
  brokenArchive: "o arquivo .lottie está corrompido",
  noAnimation: "o arquivo .lottie não traz nenhuma animação",
};

function lottieGapsText(gaps: readonly LottieGap[]): string {
  return gaps.map((gap) => `${gap.where}: ${GAP_TEXT[gap.code]}`).join("; ");
}

type LottiePlan = { ok: true; clip: GroupClip; notes: string[] } | { ok: false; reason: string };

export function lottiePlan(op: AgentLottieFields, lookup: LottieLookup | undefined, canvas: CanvasSize, playheadMs: number): LottiePlan {
  const mediaId = op.media_id?.trim() ?? "";
  if (mediaId === "") return { ok: false, reason: "import_lottie precisa de media_id de um arquivo Lottie da biblioteca" };
  const source = lookup?.(mediaId);
  if (!source) return { ok: false, reason: `a mídia ${mediaId} não está na biblioteca ou não é um arquivo Lottie` };
  if (!source.animation) return { ok: false, reason: FAULT_TEXT[source.fault ?? "notLottie"] };
  const imported = lottieClip(source.animation, { canvas, atMs: op.at_ms ?? playheadMs, name: source.name });
  if (!imported.ok) return { ok: false, reason: "gaps" in imported ? `não dá para converter este arquivo em clipes editáveis; ele usa: ${lottieGapsText(imported.gaps)}` : FAULT_TEXT[imported.fault] };
  const notes = imported.notes.includes("scaleClamped") ? ["algumas escalas foram limitadas entre 5% e 500%, o intervalo das chaves do editor"] : [];
  return { ok: true, clip: imported.clip, notes };
}
