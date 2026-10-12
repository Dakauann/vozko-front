import type { Clip, Layer, VideoDocument } from "@/lib/studio/document";
import type { Mask } from "@/lib/studio/masks";
import type { TextAnimator } from "@/lib/studio/text-animation";

import { caption, CLEAR, drop, film, glow, key, linear, overlay, radial, sheet } from "../authoring";
import { photoAsset, type PhotoSlot } from "../photos";
import { source, type CorpusEntry } from "./corpus";

export const VIDEO_MS = 6000;

export function shapeLayer(shape: Layer["shape"], fill: string, extra: Partial<Layer> = {}): Omit<Layer, "id" | "transform"> {
  return { type: "shape", shape, fill, ...extra };
}

export function words(unit: TextAnimator["unit"], style: TextAnimator["style"], durationMs: number, staggerMs: number): TextAnimator {
  return { unit, style, durationMs, staggerMs, easing: style === "pop" ? "backOut" : "cubic-bezier(0.05,0.7,0.1,1)" };
}

export function rounded(roundness: number): Mask {
  return { id: "round", shape: "rectangle", mode: "add", x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, roundness, feather: 0, expansion: 0, opacity: 1 };
}

export function still(id: string, slot: PhotoSlot, startMs: number, durationMs: number, transform: Clip["transform"], extra: Partial<Clip> = {}): Clip {
  return { id, type: "image", assetId: photoAsset(slot), startMs, durationMs, trimInMs: 0, volume: 1, fadeInMs: 0, fadeOutMs: 0, fit: "cover", transform, ...extra };
}

const FROM_LEFT = { x: 0, y: 0.5 };
const FROM_BOTTOM = { x: 0.5, y: 1 };

function kinetic(): VideoDocument {
  const s = sheet(1080, 1920);
  const lime = "#c6ff3d";
  const fadeOut = (at: number, until: number) => [key(0, 1, "linear"), key(at, 1, "linear"), key(until, 0, "linear")];
  return film("story", "#111014", VIDEO_MS, [
    overlay("orb", shapeLayer("ellipse", lime, { gradient: radial("#c6ff3d33", "#c6ff3d00") }), 0, VIDEO_MS, s.mid(700, 520, 1000, 1000), { keyframes: { x: [key(0, 0.66, "easeInOut"), key(VIDEO_MS, 0.42, "easeInOut")] } }),
    overlay("word_less", caption("MENOS", "anton", s.font(230), 400, "#ffffff"), 0, 2000, s.mid(540, 700, 1000, 260), { keyframes: { x: [key(0, -0.5), key(500, 0.5, "backOut")], opacity: fadeOut(1700, 2000) } }),
    overlay("word_noise", { ...caption("RUÍDO", "anton", s.font(230), 400, CLEAR), stroke: "#ffffff", strokeWidth: 5 }, 300, 1700, s.mid(540, 940, 1000, 260), { keyframes: { x: [key(0, 1.5), key(500, 0.5, "backOut")], opacity: fadeOut(1400, 1700) } }),
    overlay("block", shapeLayer("rect", lime, { radius: 0.1 }), 2000, 4000, s.at(60, 640, 960, 250), { anchor: FROM_LEFT, keyframes: { scaleX: [key(0, 0.05), key(420, 1)] } }),
    overlay("word_focus", caption("MAIS FOCO", "anton", s.font(180), 400, "#111014"), 2250, 3750, s.mid(540, 765, 960, 210), { textIn: words("char", "pop", 320, 45) }),
    overlay("word_sales", caption("MAIS VENDAS", "anton", s.font(160), 400, "#ffffff"), 3300, 2700, s.mid(540, 1010, 1000, 190), { textIn: words("word", "rise", 500, 140) }),
    overlay("rule", shapeLayer("rect", "#ffffff"), 4300, 1700, s.at(340, 1170, 400, 8), { keyframes: { scaleX: [key(0, 0.05), key(400, 1)] } }),
    overlay("brand", caption("ritmo.", "poppins", s.font(100), 800, lime), 4500, 1500, s.mid(540, 1320, 600, 130), { keyframes: { y: [key(0, 0.71), key(500, 0.6875)], opacity: [key(0, 0, "linear"), key(300, 1, "linear")] } }),
    overlay("url", caption("ritmo.app/teste-gratis", "poppins", s.font(38), 500, "#a3a3a3"), 4800, 1200, s.mid(540, 1420, 700, 56), { keyframes: { opacity: [key(0, 0, "linear"), key(300, 1, "linear")] } }),
  ]);
}

function lowerThird(): VideoDocument {
  const s = sheet(1920, 1080);
  const orange = "#ff5a1f";
  const out = { fadeOutMs: 300 };
  const pulse = [0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500].map((at, i) => key(at, i % 2 === 0 ? 1 : 0.25, "easeInOut"));
  return film("landscape", "#0b1220", VIDEO_MS, [
    still("city", "skyline", 0, VIDEO_MS, s.mid(960, 540, 1920, 1080), { keyframes: { scale: [key(0, 1, "linear"), key(VIDEO_MS, 1.06, "linear")] } }),
    overlay("veil", shapeLayer("rect", "#05080f", { gradient: linear("#05080f00", "#05080fcc", 90) }), 0, VIDEO_MS, s.mid(960, 540, 1920, 1080)),
    overlay("bug_mark", shapeLayer("rect", orange, { radius: 0.3 }), 0, VIDEO_MS, s.at(80, 64, 64, 64)),
    overlay("bug_name", { ...caption("ritmo", "outfit", s.font(40), 800, "#ffffff"), align: "left" }, 0, VIDEO_MS, s.at(160, 70, 220, 52)),
    overlay("live_chip", shapeLayer("rect", "#e11d48", { radius: 1 }), 0, VIDEO_MS, s.at(1640, 64, 200, 60)),
    overlay("live_dot", shapeLayer("ellipse", "#ffffff"), 0, VIDEO_MS, s.mid(1676, 94, 18, 18), { keyframes: { opacity: pulse } }),
    overlay("live_text", { ...caption("AO VIVO", "outfit", s.font(28), 800, "#ffffff"), align: "left" }, 0, VIDEO_MS, s.at(1698, 76, 140, 36)),
    overlay("accent", shapeLayer("rect", orange), 400, 5400, s.at(120, 780, 16, 210), { anchor: FROM_BOTTOM, keyframes: { scaleY: [key(0, 0.05), key(350, 1)] }, ...out }),
    overlay("plate", shapeLayer("rect", "#ffffff", { radius: 0.12, effects: [drop("plate_shadow", "#000000", 0.35, 0, 18, 40)] }), 600, 5200, s.at(150, 780, 780, 150), { keyframes: { x: [key(0, -0.25), key(500, 0.2813)] }, ...out }),
    overlay("name", { ...caption("Marina Albuquerque", "outfit", s.font(62), 800, "#0b1220"), align: "left" }, 850, 4950, s.at(190, 806, 720, 76), { keyframes: { y: [key(0, 0.8), key(400, 0.7815)], opacity: [key(0, 0, "linear"), key(250, 1, "linear")] }, ...out }),
    overlay("role_strip", shapeLayer("rect", "#0b1220"), 1050, 4750, s.at(150, 930, 600, 60), { anchor: FROM_LEFT, keyframes: { scaleX: [key(0, 0.05), key(400, 1)] }, ...out }),
    overlay("role", { ...caption("Diretora de produto  ·  Ritmo", "outfit", s.font(32), 600, "#ffffff"), align: "left" }, 1300, 4500, s.at(190, 940, 560, 42), { keyframes: { opacity: [key(0, 0, "linear"), key(300, 1, "linear")] }, ...out }),
  ]);
}

function logoIntro(): VideoDocument {
  const s = sheet(1920, 1080);
  const violet = "#7c5cff";
  const ring = (id: string, start: number) => overlay(id, shapeLayer("ellipse", CLEAR, { stroke: violet, strokeWidth: 4 }), start, 1500, s.mid(960, 470, 320, 320), { keyframes: { scale: [key(0, 0.2), key(1400, 2.4)], opacity: [key(0, 1, "linear"), key(1400, 0, "linear")] } });
  const dots: [number, number][] = [
    [520, 300],
    [1420, 260],
    [600, 820],
    [1360, 780],
    [300, 560],
    [1640, 560],
  ];
  return film("landscape", "#0b0b12", VIDEO_MS, [
    overlay("halo", shapeLayer("ellipse", violet, { gradient: radial("#7c5cff40", "#7c5cff00") }), 0, VIDEO_MS, s.mid(960, 480, 1300, 1000), { keyframes: { opacity: [key(0, 0, "linear"), key(800, 1, "linear")] } }),
    ...dots.map(([x, y], i) => overlay(`spark${i + 1}`, shapeLayer("ellipse", "#c7b8ff"), 200 + i * 120, VIDEO_MS - 200 - i * 120, s.mid(x, y, 10, 10), { keyframes: { y: [key(0, y / 1080, "linear"), key(4000, (y - 60) / 1080, "linear")], opacity: [key(0, 0, "linear"), key(400, 0.8, "linear")] } })),
    ring("ring_a", 0),
    ring("ring_b", 300),
    overlay("mark", shapeLayer("rect", violet, { radius: 0.3, gradient: linear(violet, "#ff5ca8", 135), effects: [glow("mark_glow", violet, 0.5, 40)] }), 400, VIDEO_MS - 400, s.mid(960, 470, 220, 220), { keyframes: { scale: [key(0, 0.05), key(600, 1, "backOut")], rotation: [key(0, -45), key(600, 0)] } }),
    overlay("mark_star", shapeLayer("star", "#ffffff", { points: 4, inner: 0.38 }), 500, VIDEO_MS - 500, s.mid(960, 470, 110, 110), { keyframes: { scale: [key(0, 0.05), key(500, 1, "backOut")] } }),
    overlay("name", { ...caption("RITMO STUDIO", "outfit", s.font(120), 800, "#ffffff"), letterSpacing: 0.08 }, 1200, VIDEO_MS - 1200, s.mid(960, 690, 1300, 140), { textIn: words("char", "rise", 400, 50) }),
    overlay("tagline", caption("design que move marcas", "outfit", s.font(44), 500, "#a7a3c2"), 2000, VIDEO_MS - 2000, s.mid(960, 780, 900, 60), { keyframes: { opacity: [key(0, 0, "linear"), key(500, 1, "linear")] } }),
    overlay("sweep", shapeLayer("rect", "#ffffff", { gradient: linear("#ffffff00", "#ffffff59", 0, "#ffffff00") }), 2600, 900, s.mid(700, 560, 120, 900, 20), { keyframes: { x: [key(0, 0.3, "easeInOut"), key(800, 0.7, "easeInOut")] } }),
    overlay("url_chip", shapeLayer("rect", CLEAR, { radius: 1, stroke: "#a7a3c2", strokeWidth: 2 }), 3800, VIDEO_MS - 3800, s.mid(960, 890, 320, 70), { keyframes: { scale: [key(0, 0.7), key(400, 1, "backOut")], opacity: [key(0, 0, "linear"), key(200, 1, "linear")] } }),
    overlay("url", caption("ritmo.studio", "outfit", s.font(32), 600, "#ffffff"), 3900, VIDEO_MS - 3900, s.mid(960, 890, 300, 44), { keyframes: { opacity: [key(0, 0, "linear"), key(300, 1, "linear")] } }),
  ]);
}

function productMotion(): VideoDocument {
  const s = sheet(1080, 1080);
  const ink = "#1f1f1f";
  const pop = { scale: [key(0, 0.6), key(450, 1, "backOut")] };
  const stamp = { scale: [key(0, 1.6), key(350, 1, "backOut")], rotation: [key(0, -24), key(350, -8)] };
  const rise = { y: [key(0, 1.05), key(450, 0.8889, "backOut")] };
  const chips: [string, number, number, number][] = [
    ["40 h de bateria", 230, 250, 1600],
    ["Cancela ruído", 860, 430, 1900],
    ["Carga rápida", 220, 650, 2200],
  ];
  return film("square", "#f1ede6", VIDEO_MS, [
    overlay("disc", shapeLayer("ellipse", "#ffb547", { gradient: radial("#ffc96b", "#ff9f1c") }), 0, VIDEO_MS, s.mid(540, 470, 760, 760), { keyframes: { scale: [key(0, 0.3), key(700, 1, "backOut")] } }),
    still("product", "headphones", 300, VIDEO_MS - 300, s.mid(540, 470, 560, 560), { masks: [rounded(0.22)], keyframes: { scale: [key(0, 0.85), key(600, 1, "backOut")], y: [key(600, 0.435, "easeInOut"), key(2600, 0.425, "easeInOut"), key(4600, 0.435, "easeInOut")] } }),
    overlay("title", caption("Som sem fio, o dia inteiro", "poppins", s.font(62), 800, ink), 600, VIDEO_MS - 600, s.mid(540, 830, 960, 80), { textIn: words("word", "rise", 450, 110) }),
    ...chips.flatMap(([label, x, y, start], i) => [
      overlay(`chip${i + 1}`, shapeLayer("rect", "#ffffff", { radius: 1, effects: [drop(`chip${i + 1}_shadow`, "#3a2a10", 0.18, 0, 10, 24)] }), start, VIDEO_MS - start, s.mid(x, y, 300, 76), { keyframes: pop }),
      overlay(`chip${i + 1}_text`, caption(label, "poppins", s.font(30), 700, ink), start, VIDEO_MS - start, s.mid(x, y, 280, 44), { keyframes: pop }),
    ]),
    overlay("price", shapeLayer("ellipse", ink), 3200, VIDEO_MS - 3200, s.mid(880, 190, 210, 210, -8), { keyframes: stamp }),
    overlay("price_text", caption("R$ 399", "poppins", s.font(48), 800, "#ffffff"), 3200, VIDEO_MS - 3200, s.mid(880, 190, 190, 64, -8), { keyframes: stamp }),
    overlay("cta", shapeLayer("rect", ink, { radius: 1 }), 4200, VIDEO_MS - 4200, s.mid(540, 960, 520, 90), { keyframes: rise }),
    overlay("cta_text", caption("Compre no site", "poppins", s.font(36), 700, "#ffffff"), 4200, VIDEO_MS - 4200, s.mid(540, 960, 480, 50), { keyframes: rise }),
  ]);
}

export function motionCorpus(): CorpusEntry[] {
  return [
    {
      id: "kinetic",
      title: "Tipografia cinética vertical",
      useCase: "vídeo: tipografia cinética",
      sources: [source("Envato Elements", "Dynamic Urban Instagram Intro with Kinetic Typography", "https://elements.envato.com/instagram-intro-7JM2SLS"), source("Envato Elements", "Modern Kinetic Typography Text Animations", "https://elements.envato.com/kinetic-typography-after-effects-QQK7UJD")],
      intent:
        "Vídeo 9:16 de 6 s em quase preto com um brilho lima flutuando. Batidas: de 0 a 2 s, MENOS entra pela esquerda e RUÍDO só em contorno entra pela direita, ambos com ultrapassagem, e somem; 2 s, um bloco lima cresce da esquerda; 2,25 s, MAIS FOCO aparece letra a letra com pulo sobre o bloco; 3,3 s, MAIS VENDAS sobe palavra por palavra; 4,3 s, um filete cresce do centro; 4,5 s, a marca ritmo. sobe e acende, e a URL aparece. Tipografia: Anton condensada gigante e Poppins na marca. Cor: preto, branco e um lima. Ritmo: uma ideia por batida, sempre com entrada marcada.",
      brief:
        "Vídeo vertical de 6 segundos em tipografia cinética para o app ritmo.: menos ruído, mais foco, mais vendas, terminando na marca e em ritmo.app/teste-gratis. Fundo escuro, um único lima, palavras enormes entrando com energia, uma ideia por vez.",
      photos: [],
      make: kinetic,
    },
    {
      id: "lower-third",
      title: "Terço inferior de entrevista ao vivo",
      useCase: "vídeo: terço inferior",
      sources: [source("Envato Elements", "Clean Minimal Lower Thirds", "https://elements.envato.com/lower-thirds-VMK7UGE"), source("Envato Elements", "Animated Lower Thirds for Names and Titles", "https://elements.envato.com/lower-third-XB4MPE7")],
      intent:
        "Vídeo 16:9 de 6 s sobre a foto de uma cidade ao entardecer com zoom lento e véu escuro na base. Assinatura de canal no canto superior esquerdo e chip AO VIVO com ponto pulsando. Batidas: 0,4 s, barra laranja cresce de baixo; 0,6 s, placa branca desliza da esquerda com sombra; 0,85 s, nome sobe e acende; 1,05 s, faixa escura do cargo cresce da esquerda e o cargo aparece; de 5,2 a 6 s tudo sai em fade. Tipografia Outfit. Cor: laranja, branco, azul-noite. Raios: 12% na placa, pílula no chip.",
      brief:
        "Vídeo 16:9 de 6 segundos com um terço inferior para uma entrevista ao vivo: Marina Albuquerque, diretora de produto da Ritmo, chip AO VIVO e a marca ritmo no canto. Fundo com a foto de uma cidade ao entardecer, entradas rápidas e limpas e saída suave no fim.",
      photos: ["skyline"],
      make: lowerThird,
    },
    {
      id: "logo-intro",
      title: "Abertura com revelação de logotipo",
      useCase: "vídeo: abertura ou encerramento",
      sources: [source("Envato Elements", "Minimal Clean Logo Reveal Opener", "https://elements.envato.com/minimal-logo-3-in-1-VDUWL5G"), source("Envato Elements", "Clean Logo Animation", "https://elements.envato.com/clean-logo-animation-6XQB477")],
      intent:
        "Vídeo 16:9 de 6 s em fundo quase preto. Batidas: de 0 a 1,5 s, dois anéis violeta se expandem e somem; 0,4 s, a marca (quadrado arredondado em degradê violeta a rosa com brilho) entra girando de -45 graus com escala e ultrapassagem, e a estrela branca pulsa dentro; 1,2 s, RITMO STUDIO sobe letra a letra; 2 s, o slogan acende; 2,6 s, um reflexo de luz cruza a tela; 3,8 s, a URL aparece numa pílula de contorno. Partículas sobem devagar o tempo todo. Tipografia Outfit. Cor: violeta, rosa e lilás acinzentado.",
      brief:
        "Vinheta de abertura 16:9 de 6 segundos para o estúdio RITMO STUDIO, slogan design que move marcas, site ritmo.studio. Revelação do logotipo com anéis, giro e brilho, nome entrando letra a letra, fundo escuro violeta.",
      photos: [],
      make: logoIntro,
    },
    {
      id: "product-motion",
      title: "Vídeo de produto com destaques animados",
      useCase: "vídeo: promoção de produto com movimento",
      sources: [source("Envato Tuts+", "10 Instagram promo video templates (roundup of square product promos)", "https://photography.tutsplus.com/articles/easy-pieces-10-instagram-promo-video-templates--cms-30385")],
      intent:
        "Vídeo quadrado de 6 s em creme. Batidas: 0 s, disco laranja cresce com ultrapassagem; 0,3 s, a foto do fone entra num quadro de cantos arredondados com escala e depois flutua devagar; 0,6 s, título sobe palavra por palavra; 1,6, 1,9 e 2,2 s, três pílulas brancas com sombra pulam em volta do produto; 3,2 s, selo escuro do preço carimba girando; 4,2 s, barra de chamada sobe da base. Tipografia Poppins. Cor: creme, laranja, grafite, branco. Raios: 22% na foto, pílulas inteiras.",
      brief:
        "Vídeo quadrado de 6 segundos para o fone sem fio: Som sem fio, o dia inteiro; destaques 40 h de bateria, cancela ruído e carga rápida; preço R$ 399; chamada Compre no site. Use a foto do fone, com entradas animadas em sequência.",
      photos: ["headphones"],
      make: productMotion,
    },
  ];
}
