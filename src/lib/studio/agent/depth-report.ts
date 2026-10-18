import { boxBounds, boxCorners, type Bounds } from "../arrange";
import { hexOf, luminance, type Rgba } from "../color";
import { convexArea, insideConvex, type Point } from "../convex";
import type { CanvasSize, ImageSurface, Layer, Transform } from "../document";
import { isHeavyTextShadow } from "../layer-effects";
import { snippet } from "./design-check";
import { directionWord, rounded, type PerceptionFinding, type PerceptionShape, type PerceptionTone, type UnitPoint } from "./perception";
import { backdrop, covers, imageScene, intersection, type SceneGround } from "./scene";
import { angleApart, lightDirection, lightOutliers, shadowCasts, shadowShows, type ShadowCast } from "./shadow-light";

interface DepthReport {
  light: string | null;
  shadows: string[];
  covered: string[];
  findings: PerceptionFinding[];
  shapes: PerceptionShape[];
}

const HEAVY_ALPHA = 0.6;
const HARD_ALPHA = 0.45;
const HARD_BLUR_SHARE = 0.5;
const CLIP_SLACK_PX = 2;
const NEUTRAL_CHROMA = 0.08;
const COLORFUL_GROUND = 0.35;
const GROUND_LUMINANCE: readonly [number, number] = [0.08, 0.8];
const TURNED_DEGREES = 5;
const SAME_LIGHT_DEGREES = 40;
const COVER_SAMPLES = 12;
const REPORT_COVER = 0.25;
const HIDDEN_COVER = 0.5;
const BACKGROUND_SHARE = 0.5;
const ARROW_MIN_PX = 40;
const ARROW_SCALE = 3;
const KIND_NAMES: Record<string, string> = { text: "texto", image: "imagem", shape: "forma", icon: "ícone" };

function chroma(color: Rgba): number {
  return (Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b)) / 255;
}

function groundUnder(scene: SceneGround, index: number, cast: ShadowCast, transform: Transform): Rgba | null {
  if (cast.distance === 0) return null;
  const { canvas } = scene;
  const radians = (transform.rotation * Math.PI) / 180;
  const sides = [
    { nx: Math.cos(radians), ny: Math.sin(radians), half: (transform.w * canvas.width) / 2 },
    { nx: -Math.sin(radians), ny: Math.cos(radians), half: (transform.h * canvas.height) / 2 },
  ].map((side) => {
    const facing = (side.nx * cast.dx + side.ny * cast.dy) / cast.distance;
    return facing >= 0 ? { ...side, facing } : { nx: -side.nx, ny: -side.ny, half: side.half, facing: -facing };
  });
  const edge = sides[0].facing >= sides[1].facing ? sides[0] : sides[1];
  const x = transform.x * canvas.width + edge.nx * edge.half + cast.dx;
  const y = transform.y * canvas.height + edge.ny * edge.half + cast.dy;
  return backdrop(scene, index, x / canvas.width, y / canvas.height);
}

function cutSides(cast: ShadowCast, bounds: Bounds, canvas: CanvasSize): { name: string; edge: PerceptionShape }[] {
  const reach = cast.blur / 2 + Math.max(cast.spread, 0);
  const [left, right, top, bottom] = [bounds.left / canvas.width, bounds.right / canvas.width, bounds.top / canvas.height, bounds.bottom / canvas.height];
  const edge = (from: UnitPoint, to: UnitPoint): PerceptionShape => ({ kind: "segment", from, to, tone: "bad" });
  const sides: [string, number, number, PerceptionShape][] = [
    ["esquerda", -(bounds.left + cast.dx - reach), bounds.left, edge([0, top], [0, bottom])],
    ["direita", bounds.right + cast.dx + reach - canvas.width, canvas.width - bounds.right, edge([1, top], [1, bottom])],
    ["topo", -(bounds.top + cast.dy - reach), bounds.top, edge([left, 0], [right, 0])],
    ["base", bounds.bottom + cast.dy + reach - canvas.height, canvas.height - bounds.bottom, edge([left, 1], [right, 1])],
  ];
  return sides.filter(([, overflow, inside]) => overflow >= CLIP_SLACK_PX && inside >= 0).map(([name, , , shape]) => ({ name, edge: shape }));
}

function arrowOf(cast: ShadowCast, bounds: Bounds, canvas: CanvasSize, tone: PerceptionTone): PerceptionShape {
  const length = Math.max(ARROW_MIN_PX, cast.distance * ARROW_SCALE);
  const cx = (bounds.left + bounds.right) / 2;
  const cy = (bounds.top + bounds.bottom) / 2;
  return { kind: "arrow", from: [cx / canvas.width, cy / canvas.height], to: [(cx + (cast.dx / cast.distance) * length) / canvas.width, (cy + (cast.dy / cast.distance) * length) / canvas.height], tone };
}

function heavy(layer: Layer, cast: ShadowCast, canvas: CanvasSize): string | null {
  if (cast.kind !== "drop") return null;
  if (layer.type === "text" && layer.shadow && !(layer.effects ?? []).length) return isHeavyTextShadow(layer.shadow, (layer.fontSize ?? 0) * canvas.height) ? "pesada para o tamanho da letra" : null;
  if (cast.alpha >= HEAVY_ALPHA) return `quase opaca (alfa ${rounded(cast.alpha, 2)})`;
  return cast.alpha >= HARD_ALPHA && cast.blur < HARD_BLUR_SHARE * cast.distance ? `dura e escura (alfa ${rounded(cast.alpha, 2)}, blur ${cast.blur} para ${rounded(cast.distance)} px de deslocamento)` : null;
}

function castLine(cast: ShadowCast, ground: Rgba | null): string {
  const over = ground ? ` sobre ${hexOf(ground)}` : "";
  if (cast.kind === "glow") return `${cast.layerId}: brilho, blur ${cast.blur}, alfa ${rounded(cast.alpha, 2)}, ${hexOf(cast.color)}${over}`;
  const share = cast.side > 0 ? ` (${rounded((100 * cast.distance) / cast.side)}% do lado menor)` : "";
  return `${cast.layerId}: ${directionWord(cast.angle)} ${rounded(cast.angle)}°, ${rounded(cast.distance)} px${share}, blur ${cast.blur}, alfa ${rounded(cast.alpha, 2)}, ${hexOf(cast.color)}${over}`;
}

function lightLine(casts: readonly ShadowCast[]): string | null {
  const light = lightDirection(casts);
  if (!light) return null;
  const verb = light.count === 1 ? "sombra cai" : "sombras caem";
  return `${light.count} ${verb} ${directionWord(light.angle)} (${rounded(light.angle)}°), concordância ${rounded(light.agreement, 2)}`;
}

function turnedHint(layer: Layer, cast: ShadowCast, light: number): string {
  if (!(layer.effects ?? []).length || Math.abs(layer.transform.rotation) < TURNED_DEGREES) return "";
  const effect = layer.effects!.find((e) => e.id === cast.effectId);
  if (!effect) return "";
  const local = (Math.atan2(effect.y, effect.x) * 180) / Math.PI;
  return angleApart(local, light) <= SAME_LIGHT_DEGREES ? `; a sombra gira junto com a camada (rotation ${rounded(layer.transform.rotation, 1)}): gire x e y da sombra ao contrário para ela cair como as outras` : "";
}

interface PlacedCast {
  layer: Layer;
  cast: ShadowCast;
  ground: Rgba | null;
  bounds: Bounds;
}

function shadowFindings(scene: SceneGround): { casts: PlacedCast[]; findings: PerceptionFinding[]; shapes: PerceptionShape[] } {
  const canvas = scene.canvas;
  const findings: PerceptionFinding[] = [];
  const shapes: PerceptionShape[] = [];
  const push = (kind: string, id: string, text: string) => findings.push({ kind, level: "aviso", ids: [id], text });
  const casts = scene.elements.flatMap((el, index) => {
    if (!el.layer) return [];
    const layer: Layer = { ...el.layer, id: el.id, transform: el.transform };
    const bounds = boxBounds(layer.transform, canvas);
    return shadowCasts(layer, canvas).map((cast) => {
      const ground = groundUnder(scene, index, cast, layer.transform);
      const cut = cutSides(cast, bounds, canvas);
      shapes.push(...cut.map((side) => side.edge));
      if (cut.length > 0) push("shadow_clipped", layer.id, `a ${cast.kind === "glow" ? "luz" : "sombra"} de ${layer.id} é cortada pela borda da arte (${cut.map((side) => side.name).join(", ")}) enquanto a camada fica dentro; afaste da borda ou deixe a camada sangrar de propósito`);
      const weight = heavy(layer, cast, canvas);
      if (weight) push("shadow_heavy", layer.id, `a sombra de ${layer.id} está ${weight}; sombra suave usa alfa de 0.15 a 0.35 e blur de cerca de 2 vezes o deslocamento`);
      if (cast.kind === "drop" && ground) {
        if (!shadowShows(cast.color, cast.alpha, ground)) push("shadow_invisible", layer.id, `a sombra de ${layer.id} (${hexOf(cast.color)}) quase não aparece sobre ${hexOf(ground)}; sobre fundo escuro, separe com um contorno claro, um brilho ou uma superfície mais clara`);
        else if (luminance(cast.color) > luminance(ground)) push("shadow_light", layer.id, `a sombra de ${layer.id} é mais clara que o fundo onde cai (${hexOf(cast.color)} sobre ${hexOf(ground)}); sombra escurece, para clarear use um brilho`);
        else if (chroma(cast.color) < NEUTRAL_CHROMA && chroma(ground) >= COLORFUL_GROUND && luminance(ground) >= GROUND_LUMINANCE[0] && luminance(ground) <= GROUND_LUMINANCE[1]) {
          push("shadow_neutral", layer.id, `a sombra de ${layer.id} é cinza neutra sobre um fundo colorido (${hexOf(ground)}) e suja a cor; use o tom escuro do próprio fundo, como ${hexOf({ r: ground.r * 0.45, g: ground.g * 0.45, b: ground.b * 0.45 })}`);
        }
      }
      return { layer, cast, ground, bounds };
    });
  });
  const outliers = lightOutliers(casts.map((item) => item.cast));
  for (const { cast, bounds } of casts) {
    if (cast.kind === "drop" && cast.distance > 0) shapes.push(arrowOf(cast, bounds, canvas, outliers.some((o) => o.cast === cast) ? "bad" : "ok"));
  }
  for (const outlier of outliers) {
    const layer = casts.find((item) => item.cast === outlier.cast)!.layer;
    push(
      "shadow_direction",
      layer.id,
      `a sombra de ${layer.id} cai ${directionWord(outlier.cast.angle)} (${rounded(outlier.cast.angle)}°), contra a luz das outras, que caem ${directionWord(outlier.light)} (${rounded(outlier.light)}°)${turnedHint(layer, outlier.cast, outlier.light)}`,
    );
  }
  return { casts, findings, shapes };
}

function coverage(polygon: readonly Point[], above: readonly (readonly Point[])[]): number {
  const xs = polygon.map(([x]) => x);
  const ys = polygon.map(([, y]) => y);
  const [left, top] = [Math.min(...xs), Math.min(...ys)];
  const [width, height] = [Math.max(...xs) - left, Math.max(...ys) - top];
  let inside = 0;
  let hidden = 0;
  for (let i = 0; i < COVER_SAMPLES; i++) {
    for (let j = 0; j < COVER_SAMPLES; j++) {
      const point: Point = [left + ((i + 0.5) / COVER_SAMPLES) * width, top + ((j + 0.5) / COVER_SAMPLES) * height];
      if (!insideConvex(point, polygon)) continue;
      inside += 1;
      if (above.some((cover) => insideConvex(point, cover))) hidden += 1;
    }
  }
  return inside === 0 ? 0 : hidden / inside;
}

function occlusion(scene: SceneGround): { lines: string[]; findings: PerceptionFinding[]; shapes: PerceptionShape[] } {
  const canvas = scene.canvas;
  const canvasArea = canvas.width * canvas.height;
  const polygons = scene.elements.map((el) => boxCorners(el.transform, canvas) as Point[]);
  const lines: string[] = [];
  const findings: PerceptionFinding[] = [];
  const shapes: PerceptionShape[] = [];
  scene.elements.forEach((el, index) => {
    const own = polygons[index];
    const ownArea = convexArea(own);
    if (ownArea === 0 || ownArea >= BACKGROUND_SHARE * canvasArea) return;
    const coverers = scene.elements.flatMap((other, j) => (j > index && intersection(el.box, other.box) > 0 && covers(other) && !other.layer?.clip && convexArea(polygons[j]) > ownArea ? [{ id: other.id, polygon: polygons[j] }] : []));
    const share = coverage(
      own,
      coverers.map((c) => c.polygon),
    );
    if (share < REPORT_COVER) return;
    const by = coverers.filter((c) => coverage(own, [c.polygon]) > 0).map((c) => c.id);
    const layer = el.layer;
    const kind = layer ? (KIND_NAMES[layer.type] ?? layer.type) : "mídia";
    const name = `${el.id} (${kind}${layer?.type === "text" ? ` "${snippet(layer)}"` : ""})`;
    const line = `${name} ${Math.round(share * 100)}% coberto por ${by.join(", ")}, que ${by.length === 1 ? "está" : "estão"} acima`;
    lines.push(line);
    if (share < HIDDEN_COVER) return;
    shapes.push({ kind: "area", points: own.map(([x, y]): UnitPoint => [x / canvas.width, y / canvas.height]), tone: "bad" });
    findings.push({ kind: "hidden_layer", level: share >= 0.9 ? "erro" : "aviso", ids: [el.id, ...by], text: `${line}; leve ${el.id} para cima de ${by.join(", ")} com order_layers se ele deve aparecer` });
  });
  return { lines, findings, shapes };
}

export function depthReport(doc: ImageSurface): DepthReport {
  return sceneDepth(imageScene(doc));
}

export function sceneDepth(scene: SceneGround): DepthReport {
  const { casts, findings, shapes } = shadowFindings(scene);
  const hidden = occlusion(scene);
  return {
    light: lightLine(casts.map((item) => item.cast)),
    shadows: casts.map(({ cast, ground }) => castLine(cast, ground)),
    covered: hidden.lines,
    findings: [...hidden.findings, ...findings],
    shapes: [...shapes, ...hidden.shapes],
  };
}
