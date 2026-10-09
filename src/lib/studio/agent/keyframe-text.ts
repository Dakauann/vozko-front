import { EASINGS, KEYFRAME_LIMITS, type KeyframeFault, type KeyframeProperty } from "../keyframes";

const PROPERTY_HINTS: Record<KeyframeProperty, string> = {
  x: "0.5 é o centro do quadro; fora de 0 a 1 sai da tela",
  y: "0.5 é o centro do quadro; fora de 0 a 1 sai da tela",
  scale: "1 é o tamanho atual do clipe",
  rotation: "em graus",
  opacity: "0 é invisível e 1 é opaco",
};

export function keyframeFaultText(fault: KeyframeFault): string {
  switch (fault.kind) {
    case "empty":
      return "a animação ficou sem chaves";
    case "too_many":
      return `${fault.property} passou de ${fault.limit} chaves; use menos chaves`;
    case "easing":
      return `${fault.property} em ${fault.atMs} ms usa o easing ${fault.easing}, que não existe; use ${EASINGS.join(", ")}`;
    case "time":
      return `${fault.property} tem uma chave em ${fault.atMs} ms; at_ms vai de ${-fault.limit} a ${fault.limit} ms`;
    case "value":
      return `${fault.property} em ${fault.atMs} ms vale ${fault.value}; ${fault.property} aceita de ${fault.range[0]} a ${fault.range[1]} (${PROPERTY_HINTS[fault.property]})`;
    case "order":
      return `duas chaves de ${fault.property} caem em ${fault.atMs} ms; cada chave precisa de um instante diferente`;
    case "box":
      return `com scale ${fault.scale} o clipe passaria de ${KEYFRAME_LIMITS.maxAnimatedBox} vezes o quadro; para este clipe use scale até ${fault.maxScale}`;
  }
}

export function keyOutsideClipText(property: KeyframeProperty, atMs: number, durationMs: number): string {
  return `${property} tem uma chave em ${atMs} ms, fora do clipe; at_ms conta do início do clipe e vai de 0 a ${durationMs} ms`;
}
