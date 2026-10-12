import { BEZIER_Y_RANGE, EASINGS, KEYFRAME_LIMITS, type AnimatedProperty, type KeyframeFault, type KeyframeProperty } from "../keyframes";
import { PATH_HANDLE_LIMIT, SPATIAL_MODES } from "../path-keys";
import { MAX_PATH_COORDINATE } from "../vector-path";
import type { VfxParam } from "../vfx";

const PROPERTY_HINTS: Record<KeyframeProperty, string> = {
  x: "0.5 é o centro do quadro; fora de 0 a 1 sai da tela",
  y: "0.5 é o centro do quadro; fora de 0 a 1 sai da tela",
  scale: "1 é o tamanho atual do clipe",
  scaleX: "1 é a largura atual do clipe; estica só na horizontal",
  scaleY: "1 é a altura atual do clipe; estica só na vertical",
  rotation: "em graus",
  opacity: "0 é invisível e 1 é opaco",
  blur: "desfoque em pixels do quadro; 0 é nítido",
  gainDb: "ganho em dB sobre o volume do clipe; 0 mantém, -60 silencia, até +6",
  pan: "posição no estéreo; -1 é a esquerda, 0 o centro e 1 a direita",
  trimStart: "fração da linha onde o traço começa; 0 é o início",
  trimEnd: "fração da linha onde o traço termina; 1 é o fim, de 0 a 1 desenha a linha",
  trimOffset: "gira o trecho visível ao longo da linha, em graus",
  waveAmount: "altura da onda em pixels do quadro; 0 é reto",
  waveLength: "distância entre duas cristas em pixels do quadro",
  waveSpeed: "ciclos por segundo; negativo anda ao contrário, 0 parado",
  wavePhase: "deslocamento da onda em graus",
  wiggleSize: "tamanho do tremor em pixels do quadro; 0 é parado",
  wiggleDetail: "quantas ondulações a cada 100 pixels",
  wiggleRate: "tremidas por segundo; 0 congela o desenho",
  taperStartLength: "fração da linha afinada a partir do início",
  taperEndLength: "fração da linha afinada a partir do fim",
  taperStartWidth: "largura na ponta inicial; 0 é ponta fina, 1 é a largura toda",
  taperEndWidth: "largura na ponta final; 0 é ponta fina, 1 é a largura toda",
  taperStartEase: "curva do afinamento inicial; negativo afina cedo, positivo afina tarde",
  taperEndEase: "curva do afinamento final; negativo afina cedo, positivo afina tarde",
  counter: "o número que o contador mostra nesse instante, antes do prefixo, do sufixo e das casas decimais",
  pathOffset: "onde o texto fica no caminho, em fração do comprimento: 0 é o início, 1 o fim; passe de 0 a 1 nas chaves para o texto correr pelo caminho",
  exposure: "exposição em stops de luz, de -5 a 5; 0 não muda",
  contrast: "contraste de -100 a 100; 0 não muda",
  highlights: "realces de -100 a 100; 0 não muda",
  shadows: "sombras de -100 a 100; 0 não muda",
  whites: "ponto de branco de -100 a 100; 0 não muda",
  blacks: "ponto de preto de -100 a 100; 0 não muda",
  temperature: "temperatura de -100 (frio) a 100 (quente); 0 não muda",
  tint: "matiz de -100 (verde) a 100 (magenta); 0 não muda",
  saturation: "saturação de -100 (preto e branco) a 100 (o dobro); 0 não muda",
  vibrance: "vibração de -100 a 100; 0 não muda",
  speed: "velocidade do clipe nesse instante, de 0.1 a 16; 1 é normal, 0.5 câmera lenta, 2 o dobro",
  cameraPanX: "para onde a câmera do clipe de efeito olha na horizontal, em frações da largura do quadro, de -2 a 2; 0 é o centro e 0.25 mostra o que está à direita",
  cameraPanY: "para onde a câmera olha na vertical, em frações da altura do quadro, de -2 a 2; 0 é o centro e positivo mostra o que está embaixo",
  cameraZoom: "aproximação da câmera, de 0.1 a 10; 1 é o quadro inteiro, 2 aproxima o dobro e 0.5 afasta",
  cameraRotation: "quanto a imagem abaixo gira, em graus; positivo é horário",
  rotationX: "giro em profundidade em volta do eixo horizontal, em graus, pela âncora do clipe; positivo leva o topo para trás, 90 deixa o clipe de lado (some) e 180 mostra o verso de cabeça para baixo; a perspectiva vem de set_canvas perspective",
  rotationY: "giro em profundidade em volta do eixo vertical, em graus, pela âncora do clipe; positivo leva o lado direito para trás, 90 deixa o clipe de perfil (some) e 180 mostra o verso espelhado, como uma carta virando; a perspectiva vem de set_canvas perspective",
};

export function keyframeFaultText(fault: KeyframeFault): string {
  switch (fault.kind) {
    case "empty":
      return "a animação ficou sem chaves";
    case "easing":
      return `${fault.property} em ${fault.atMs} ms usa o easing ${fault.easing}, que não existe; use ${EASINGS.join(", ")} ou cubic-bezier(x1,y1,x2,y2) com x de 0 a 1 e y de ${BEZIER_Y_RANGE[0]} a ${BEZIER_Y_RANGE[1]}`;
    case "time":
      return `${fault.property} tem uma chave em ${fault.atMs} ms; at_ms vai de ${-fault.limit} a ${fault.limit} ms`;
    case "value":
      return `${fault.property} em ${fault.atMs} ms vale ${fault.value}; ${fault.property} aceita de ${fault.range[0]} a ${fault.range[1]} (${PROPERTY_HINTS[fault.property]})`;
    case "color":
      return `${fault.property} em ${fault.atMs} ms tem a cor ${fault.color}, que não é válida; use #rrggbb ou #rrggbbaa`;
    case "order":
      return `duas chaves de ${fault.property} caem em ${fault.atMs} ms; cada chave precisa de um instante diferente`;
    case "path":
      return pathFaultText(fault.atMs, fault.problem);
    case "morph":
      return fault.problem === "path"
        ? `a chave de path em ${fault.atMs} ms não tem um caminho SVG válido; use os comandos M L H V C S Q T A Z com coordenadas de 0 a 1 na caixa do clipe`
        : `first_vertex da chave de path em ${fault.atMs} ms passa de ${MAX_PATH_COORDINATE} em x ou y; use um ponto do caminho, de 0 a 1 na caixa do clipe`;
    case "rival":
      return `${fault.property} e ${fault.rival} não animam juntos no mesmo clipe; ${RIVAL_HINT}`;
    case "box":
      return `com ${fault.property} chegando a ${fault.scale}, contando o quanto a suavização passa da chave, o clipe passaria de ${KEYFRAME_LIMITS.maxAnimatedBox} vezes o quadro; para este clipe use ${fault.property} até ${fault.maxScale}`;
  }
}

const RIVAL_HINT = "scale é a escala proporcional e scaleX com scaleY a escala separada por eixo; position é o trajeto curvo e x com y o movimento separado por eixo";

const PATH_PROBLEMS: Record<Extract<KeyframeFault, { kind: "path" }>["problem"], string> = {
  position: "tem x ou y fora de -1 a 2",
  spatial: `tem um spatial que não existe; use ${SPATIAL_MODES.join(", ")}`,
  missing: "é smooth ou free e precisa das duas alças, in e out",
  unexpected: "só aceita alças in e out com spatial smooth ou free",
  range: `tem uma alça maior que ${PATH_HANDLE_LIMIT} em x ou y`,
};

function pathFaultText(atMs: number, problem: Extract<KeyframeFault, { kind: "path" }>["problem"]): string {
  return `a chave de position em ${atMs} ms ${PATH_PROBLEMS[problem]}`;
}

export function keyOutsideClipText(property: AnimatedProperty, atMs: number, durationMs: number): string {
  return `${property} tem uma chave em ${atMs} ms, fora do clipe; at_ms conta do início do clipe e vai de 0 a ${durationMs} ms`;
}

const VFX_PARAM_HINTS: Record<VfxParam, string> = {
  amount: "quanto do efeito aparece; 0 desliga, 1 é o efeito inteiro",
  size: "tamanho do efeito: em px do quadro no grão, nas partículas, no mosaico, no brilho e no ruído; fração do lado menor no redemoinho, na lente e na ondulação",
  speed: "ritmo do movimento; 0 parado",
  rate: "trocas ou quadros por segundo",
  chroma: "0 é monocromático e 1 é colorido",
  x: "posição horizontal do centro ou da origem; 0.5 é o meio do quadro",
  y: "posição vertical do centro ou da origem; 0.5 é o meio do quadro",
  frequency: "repetições por segundo",
  split: "separação das cores em px do quadro",
  scanlines: "força das linhas de vídeo antigo",
  count: "quantidade de partículas, barras, ecos ou colunas",
  angle: "em graus",
  softness: "suavidade da borda ou da mistura das cores",
  twinkle: "quanto as partículas piscam",
  ghosts: "brilho dos reflexos da lente",
  streak: "força do risco de luz",
  flicker: "oscilação do brilho",
  rotation: "giro máximo em graus",
  roundness: "arredondamento; 1 é redondo",
  radial: "0 é numa direção só ou linear, 1 é a partir do centro",
  threshold: "a partir de que claridade a imagem brilha; 0 brilha tudo, 1 só o branco",
  levels: "quantos tons sobram em cada canal de cor",
  shiftX: "deslocamento horizontal em fração da largura; a imagem dá a volta na borda",
  shiftY: "deslocamento vertical em fração da altura; a imagem dá a volta na borda",
  length: "comprimento do rastro ou da onda em px do quadro; no desfoque de zoom, fração do caminho até o centro",
  height: "altura da onda em px do quadro; na lente, de -1 (aperta) a 1 (incha)",
  phase: "deslocamento da onda em graus",
  topLeftX: "x do canto ou do ponto 1, em fração da largura",
  topLeftY: "y do canto ou do ponto 1, em fração da altura",
  topRightX: "x do canto ou do ponto 2, em fração da largura",
  topRightY: "y do canto ou do ponto 2, em fração da altura",
  bottomRightX: "x do canto ou do ponto 3, em fração da largura",
  bottomRightY: "y do canto ou do ponto 3, em fração da altura",
  bottomLeftX: "x do canto ou do ponto 4, em fração da largura",
  bottomLeftY: "y do canto ou do ponto 4, em fração da altura",
  complexity: "camadas de detalhe do ruído; valores quebrados misturam a última camada",
  contrast: "contraste do ruído; 1 é o normal",
  brightness: "brilho do ruído; 0 não muda",
  toX: "x do fim do degradê em fração da largura",
  toY: "y do fim do degradê em fração da altura",
  width: "largura da área das barras em fração do quadro",
  gap: "espaço entre as barras em fração de cada coluna",
  gain: "ganho em dB antes de medir o som; positivo deixa as barras mais altas",
  window: "quanto tempo de som a onda mostra, em ms",
  delay: "tempo entre um eco e o próximo, em ms",
  decay: "quanto cada eco apaga em relação ao anterior; 1 não apaga",
};

export function vfxParamHint(name: VfxParam): string {
  return VFX_PARAM_HINTS[name];
}
