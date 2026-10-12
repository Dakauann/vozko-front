import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { lookDiff } from "./look-diff";

import { perceptionCorpus } from "./corpus";
import type { Rendered } from "./grade";
import { videoCorpus } from "./video-corpus";

const OUT = process.env.ELO_PERCEPTION_OUT ?? join(import.meta.dir, ".out");
export const ARMS = ["base", "alerts", "text", "overlay", "all", "depth", "layout", "ascii"] as const;
export type Arm = (typeof ARMS)[number];

export const SYSTEM = [
  "Você revisa artes de design gráfico (posts e anúncios) como diretora de arte. Encontre os defeitos reais da arte, os que um diretor de arte mandaria corrigir; não liste gosto pessoal nem sugestões de melhoria.",
  'Responda só com JSON, sem texto antes ou depois: {"defects":[{"kind":"...","ids":["id da camada"],"why":"motivo curto"}]}. Sem defeitos, responda {"defects":[]}.',
  "kind é um destes: shadow_direction (uma sombra cai contra a luz das outras), shadow_clipped (sombra ou brilho cortado pela borda da arte), shadow_heavy (sombra opaca, preta ou dura demais), shadow_invisible (sombra que não aparece sobre o fundo), shadow_neutral (sombra cinza ou preta sobre fundo colorido), misalign (elemento quase alinhado, alguns px fora da linha de outro), crowded_margin (elemento colado na borda da arte), tangent (dois elementos quase se encostando), hierarchy (níveis de texto sem contraste de tamanho), hidden_layer (camada escondida atrás de outra), near_parallel (inclinações quase iguais mas diferentes), overlap (elementos que se sobrepõem por engano ou texto saindo da sua forma), text_legibility (texto difícil de ler sobre o fundo), other.",
  "ids são os ids das camadas no contorno.",
].join("\n");

const OVERLAY_KEY =
  "A imagem traz por cima: setas verdes com a direção de cada sombra (vermelha quando contraria as outras), traços vermelhos em bordas que cortam sombras, em margens apertadas e em linhas quase alinhadas (a verde é a linha certa), círculos vermelhos onde dois elementos quase se encostam e áreas vermelhas em sobreposições e camadas escondidas.";

export function armText(arm: Arm, r: Rendered): string {
  const blocks = [`Contorno das camadas, de baixo para cima (studio_read):\n${JSON.stringify(r.channels.outline)}`, `legibility (contraste medido nos pixels atrás de cada texto):\n${JSON.stringify(r.legibility)}`];
  if (arm === "depth" || arm === "text" || arm === "all") blocks.push(`depth (sombras e camadas cobertas, medido no documento):\n${JSON.stringify(r.channels.depth)}`);
  if (arm === "layout" || arm === "text" || arm === "all") blocks.push(`layout (alinhamento, margens, níveis de texto, medido no documento):\n${JSON.stringify(r.channels.layout)}`);
  if (arm === "ascii") blocks.push(r.channels.ascii);
  if (arm === "alerts") {
    const alerts = [...(r.channels.depth.findings as string[]), ...(r.channels.layout.findings as string[])];
    if (alerts.length > 0) blocks.push(`alerts (problemas medidos no documento):\n${JSON.stringify(alerts)}`);
  }
  if (arm === "overlay" || arm === "all") blocks.push(OVERLAY_KEY);
  return blocks.join("\n\n");
}

export const VIDEO_ARMS = ["base", "alerts", "motion", "strip"] as const;

export const VIDEO_SYSTEM = [
  "Você revisa vídeos curtos de anúncio como diretora de arte e de motion. Você recebe uma folha de quadros rotulados com o tempo, o estado dos clipes em cada quadro e checagens. Encontre os defeitos reais; não liste gosto pessoal.",
  'Responda só com JSON: {"defects":[{"kind":"...","ids":["id do clipe"],"why":"motivo curto"}]}. Sem defeitos, responda {"defects":[]}.',
  "kind é um destes: motion_jump (um elemento salta de lugar entre quadros), leaves_frame (um elemento sai da tela no meio da animação e volta), flash (a tela pisca mais de 3 vezes por segundo), moving_overlap (textos se cruzam durante o movimento), linear_motion (movimento longo com easing linear, mecânico), shadow_direction (a sombra de um clipe contra a luz dos outros), reading_time (texto pouco tempo na tela para ler), other.",
].join("\n");

export const LOOP_PAIRS: readonly [string, string][] = [
  ["cards-shadow_direction", "cards-misalign"],
  ["cards-hidden_layer", "cards-tangent"],
  ["hero-shadow_clipped", "hero-overlap"],
  ["collage-near_parallel", "collage-shadow_neutral"],
  ["poster-hierarchy", "poster-hidden_layer"],
  ["flyer-misalign", "flyer-shadow_invisible"],
  ["hero-tangent", "hero-shadow_direction-3"],
  ["cards-overlap", "cards-shadow_heavy"],
];

interface RenderedVideo {
  id: string;
  sheetNotes: unknown;
  stripNotes: unknown;
  checks: string[];
  motion: { moves: string[]; findings: string[] };
}

function videoText(arm: (typeof VIDEO_ARMS)[number], r: RenderedVideo): string {
  const blocks = [`frames (estado dos clipes em cada quadro):\n${JSON.stringify(arm === "strip" ? r.stripNotes : r.sheetNotes)}`, `checks:\n${JSON.stringify(r.checks)}`];
  if (arm === "alerts" && r.motion.findings.length > 0) blocks.push(`alerts (problemas de movimento medidos no documento):\n${JSON.stringify(r.motion.findings)}`);
  if (arm === "motion") blocks.push(`motion_report (movimentos e problemas medidos no documento):\n${JSON.stringify(r.motion)}`);
  return blocks.join("\n\n");
}

function exportVideo(): void {
  const rendered: RenderedVideo[] = JSON.parse(readFileSync(join(OUT, "rendered-video.json"), "utf8"));
  const cases = videoCorpus();
  const jobs = VIDEO_ARMS.flatMap((arm) => cases.map((item) => ({ case_id: item.id, arm, text: videoText(arm, rendered.find((x) => x.id === item.id)!), image: `images/${item.id}.${arm === "strip" ? "strip" : "sheet"}.jpg` })));
  writeFileSync(join(OUT, "perception-video-inputs.json"), JSON.stringify({ system: VIDEO_SYSTEM, jobs }));
  console.log(`${jobs.length} video jobs written`);
}

function exportLoop(rendered: Rendered[]): void {
  const corpus = perceptionCorpus();
  const jobs = LOOP_PAIRS.flatMap(([from, to]) => {
    const before = corpus.find((c) => c.id === from)!;
    const after = corpus.find((c) => c.id === to)!;
    const r = rendered.find((x) => x.id === to)!;
    const task = `Você acabou de editar esta arte para corrigir isto: ${before.defect!.note}. Confira o resultado e liste os defeitos que a arte tem agora.`;
    const plain = `${task}\n\n${armText("base", r)}`;
    const diff = `${plain}\n\nsince_last_look (o que mudou no documento desde o último olhar):\n${JSON.stringify(lookDiff(before.artboard, after.artboard))}`;
    return [
      { case_id: to, arm: "loop-plain", text: plain, image: `images/${to}.image.jpg` },
      { case_id: to, arm: "loop-diff", text: diff, image: `images/${to}.image.jpg` },
    ];
  });
  writeFileSync(join(OUT, "perception-loop-inputs.json"), JSON.stringify({ system: SYSTEM, jobs }));
  console.log(`${jobs.length} loop jobs written`);
}

if (import.meta.main) {
  const rendered: Rendered[] = JSON.parse(readFileSync(join(OUT, "rendered.json"), "utf8"));
  exportVideo();
  exportLoop(rendered);
  const arms = (process.env.ELO_PERCEPTION_ARMS ?? ARMS.join(",")).split(",").map((a) => a.trim()) as Arm[];
  const only = (process.env.ELO_PERCEPTION_CASES ?? "").split(",").map((c) => c.trim()).filter(Boolean);
  const corpus = perceptionCorpus().filter((item) => only.length === 0 || only.includes(item.id));
  const jobs = arms.flatMap((arm) =>
    corpus.map((item) => {
      const r = rendered.find((x) => x.id === item.id)!;
      return { case_id: item.id, arm, text: armText(arm, r), image: `images/${item.id}.${arm === "overlay" || arm === "all" ? "overlay" : "image"}.jpg` };
    }),
  );
  writeFileSync(join(OUT, "perception-inputs.json"), JSON.stringify({ system: SYSTEM, jobs }));
  writeFileSync(join(OUT, "perception-cases.json"), JSON.stringify(corpus.map((item) => ({ id: item.id, base: item.base, defect: item.defect, layers: item.artboard.layers.map((layer) => layer.id) })), null, 1));
  console.log(`${jobs.length} jobs written to ${join(OUT, "perception-inputs.json")}; run from vozko-back: go run ./cmd/elodesigneval -perception ${join(OUT, "perception-inputs.json")} -models <ids> -spent <US$ spent so far> -out ${join(OUT, "perception-results.json")}`);
}
