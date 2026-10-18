import { luminance } from "../color";
import { FRAMES_PER_SECOND, type Clip, type Layer, type VideoDocument } from "../document";
import type { Keyframe } from "../keyframes";
import { snippet } from "./design-check";
import { motionVariety } from "./motion-variety";
import { directionWord, rounded, type PerceptionFinding } from "./perception";
import { area, backdrop, intersection, videoSceneAt, type Box, type SceneElement, type SceneGround } from "./scene";
import { lightOutliers, shadowCasts } from "./shadow-light";

export interface MotionWindow {
  fromMs: number;
  toMs: number;
}

interface MotionReport {
  moves: string[];
  variety: string | null;
  findings: PerceptionFinding[];
}

interface Sample {
  atMs: number;
  elements: SceneElement[];
  light: number | null;
}

const OVERVIEW_FPS = 10;
const JUMP_PER_FRAME = 0.1;
const EDGE_SLACK = 0.005;
const FLASH_STEP = 0.1;
const FLASH_DARK = 0.8;
const FLASHES_PER_SECOND = 3;
const OVERLAP_SHARE = 0.15;
const LINEAR_MOVE = 0.15;
const LINEAR_MIN_MS = 200;
const LIGHT_POINTS: readonly [number, number][] = [0.2, 0.5, 0.8].flatMap((x) => [0.2, 0.5, 0.8].map((y): [number, number] => [x, y]));
const POSITION_LANES = ["x", "y"] as const;
const LISTED_LANES = ["x", "y", "scale", "rotation", "opacity", "blur"] as const;

function seconds(ms: number): number {
  return rounded(ms / 1000, 1);
}

function visualClips(doc: VideoDocument): Clip[] {
  return doc.tracks.flatMap((track) => (track.kind === "visual" && !track.hidden ? track.clips.filter((clip) => !clip.disabled && clip.type !== "audio") : []));
}

function sampleTimes(doc: VideoDocument, window: MotionWindow | null): number[] {
  const [from, to] = window ? [window.fromMs, window.toMs] : [0, doc.durationMs];
  const step = 1000 / (window ? FRAMES_PER_SECOND : OVERVIEW_FPS);
  const times: number[] = [];
  for (let at = from; at <= to; at += step) times.push(Math.round(at));
  return times;
}

function frameLight(scene: SceneGround): number | null {
  const values = LIGHT_POINTS.map(([x, y]) => backdrop(scene, scene.elements.length, x, y)).filter((color) => color !== null);
  return values.length === 0 ? null : values.reduce((sum, color) => sum + luminance(color!), 0) / values.length;
}

function samplesOf(doc: VideoDocument, window: MotionWindow | null): Sample[] {
  return sampleTimes(doc, window).map((atMs) => {
    const scene = videoSceneAt(doc, atMs);
    return { atMs, elements: scene.elements, light: frameLight(scene) };
  });
}

function center(box: Box): [number, number] {
  return [(box.left + box.right) / 2, (box.top + box.bottom) / 2];
}

function outside(box: Box): boolean {
  return box.left < -EDGE_SLACK || box.top < -EDGE_SLACK || box.right > 1 + EDGE_SLACK || box.bottom > 1 + EDGE_SLACK;
}

function nameOf(el: SceneElement): string {
  return el.layer?.type === "text" ? `${el.id} ("${snippet(el.layer)}")` : el.id;
}

function tracks(samples: readonly Sample[]): Map<string, { atMs: number; el: SceneElement }[]> {
  const byId = new Map<string, { atMs: number; el: SceneElement }[]>();
  for (const sample of samples) for (const el of sample.elements) byId.set(el.id, [...(byId.get(el.id) ?? []), { atMs: sample.atMs, el }]);
  return byId;
}

function jumps(byId: ReturnType<typeof tracks>): PerceptionFinding[] {
  const frameMs = 1000 / FRAMES_PER_SECOND;
  return [...byId.values()].flatMap((track) => {
    for (let i = 1; i < track.length; i++) {
      const [a, b] = [track[i - 1], track[i]];
      const [ax, ay] = center(a.el.box);
      const [bx, by] = center(b.el.box);
      const distance = Math.hypot(bx - ax, by - ay);
      const perFrame = (distance * frameMs) / Math.max(frameMs, b.atMs - a.atMs);
      if (perFrame > JUMP_PER_FRAME && a.el.opacity > 0.05 && b.el.opacity > 0.05) {
        return [{ kind: "motion_jump", level: "aviso" as const, ids: [b.el.id], text: `${nameOf(b.el)} salta ${Math.round(distance * 100)}% do quadro em ${Math.round(b.atMs - a.atMs)} ms perto de ${seconds(a.atMs)} s; espace os keyframes ou use uma transição se o corte é de propósito` }];
      }
    }
    return [];
  });
}

function excursions(byId: ReturnType<typeof tracks>): PerceptionFinding[] {
  return [...byId.values()].flatMap((track) => {
    const out = track.map((entry) => outside(entry.el.box));
    const first = out.indexOf(true);
    if (first <= 0) return [];
    let last = first;
    while (last + 1 < out.length && out[last + 1]) last++;
    if (last + 1 >= out.length) return [];
    const el = track[first].el;
    return [{ kind: "leaves_frame", level: "aviso" as const, ids: [el.id], text: `${nameOf(el)} sai do quadro de ${seconds(track[first].atMs)} s a ${seconds(track[last].atMs)} s no meio da animação e volta; mantenha o caminho dentro da tela` }];
  });
}

function flashes(samples: readonly Sample[], doc: VideoDocument): PerceptionFinding[] {
  const changes: { atMs: number; up: boolean }[] = [];
  for (let i = 1; i < samples.length; i++) {
    const [a, b] = [samples[i - 1].light, samples[i].light];
    if (a === null || b === null || Math.abs(b - a) < FLASH_STEP || Math.min(a, b) >= FLASH_DARK) continue;
    changes.push({ atMs: samples[i].atMs, up: b > a });
  }
  const flashTimes: number[] = [];
  for (let i = 1; i < changes.length; i++) if (changes[i].up !== changes[i - 1].up) flashTimes.push(changes[i].atMs);
  const worst = flashTimes.reduce((best, atMs) => Math.max(best, flashTimes.filter((other) => other >= atMs && other < atMs + 1000).length), 0);
  if (worst <= FLASHES_PER_SECOND) return [];
  const culprit = blinking(doc, flashTimes[0]);
  return [{ kind: "flash", level: "erro", ids: culprit ? [culprit] : [], text: `a tela pisca ${worst} vezes por segundo perto de ${seconds(flashTimes[0])} s${culprit ? ` (${culprit})` : ""}; mais de 3 flashes por segundo podem causar crises em pessoas sensíveis` }];
}

function blinking(doc: VideoDocument, atMs: number): string | null {
  const clip = visualClips(doc).find((c) => c.startMs <= atMs && atMs <= c.startMs + c.durationMs && (c.keyframes?.opacity?.length ?? 0) > 2);
  return clip?.id ?? null;
}

function crossings(samples: readonly Sample[]): PerceptionFinding[] {
  const touching = new Map<string, number[]>();
  const seen = new Map<string, number[]>();
  for (const sample of samples) {
    const texts = sample.elements.filter((el) => el.layer?.type === "text" && el.layer.text?.trim());
    texts.forEach((a, i) => {
      for (const b of texts.slice(i + 1)) {
        const key = [a.id, b.id].sort().join(",");
        seen.set(key, [...(seen.get(key) ?? []), sample.atMs]);
        if (intersection(a.box, b.box) >= OVERLAP_SHARE * Math.min(area(a.box), area(b.box))) touching.set(key, [...(touching.get(key) ?? []), sample.atMs]);
      }
    });
  }
  return [...touching.entries()].flatMap(([key, times]) => {
    const together = seen.get(key)!;
    if (times.includes(together[0]) || times.includes(together[together.length - 1])) return [];
    return [{ kind: "moving_overlap", level: "aviso" as const, ids: key.split(","), text: `os textos ${key.replace(",", " e ")} se cruzam no meio do movimento, de ${seconds(times[0])} s a ${seconds(times[times.length - 1])} s; desencontre os tempos ou os caminhos` }];
  });
}

function linearMoves(clips: readonly Clip[]): PerceptionFinding[] {
  return clips.flatMap((clip) => {
    const lane = POSITION_LANES.map((p) => clip.keyframes?.[p] ?? []).find((keys) => keys.some((key, i) => i > 0 && keys[i - 1].easing === "linear" && Math.abs(key.value - keys[i - 1].value) >= LINEAR_MOVE && key.atMs - keys[i - 1].atMs >= LINEAR_MIN_MS));
    return lane ? [{ kind: "linear_motion", level: "aviso" as const, ids: [clip.id], text: `${clip.id} anda ${Math.round(Math.abs(lane[lane.length - 1].value - lane[0].value) * 100)}% do quadro com easing linear, que parece mecânico; easeOut na entrada e easeIn na saída soam naturais, a menos que seja um movimento contínuo de propósito` }] : [];
  });
}

function shadowTurns(doc: VideoDocument, clips: readonly Clip[]): PerceptionFinding[] {
  const casts = clips.flatMap((clip) => {
    const scene = videoSceneAt(doc, clip.startMs + clip.durationMs / 2);
    const el = scene.elements.find((e) => e.id === clip.id);
    if (!el?.layer) return [];
    const layer: Layer = { ...el.layer, id: clip.id, transform: el.transform };
    return shadowCasts(layer, scene.canvas);
  });
  return lightOutliers(casts).map((o) => ({ kind: "shadow_direction", level: "aviso" as const, ids: [o.cast.layerId], text: `a sombra de ${o.cast.layerId} cai ${directionWord(o.cast.angle)} (${rounded(o.cast.angle)}°), contra a luz dos outros clipes, que caem ${directionWord(o.light)} (${rounded(o.light)}°)` }));
}

function laneLine(name: string, keys: readonly Keyframe[]): string {
  const easings = [...new Set(keys.slice(0, -1).map((key) => key.easing))].join(", ");
  return `${name} ${rounded(keys[0].value, 2)}→${rounded(keys[keys.length - 1].value, 2)} de ${seconds(keys[0].atMs)} a ${seconds(keys[keys.length - 1].atMs)} s (${easings})`;
}

function moveLines(clips: readonly Clip[]): string[] {
  return clips.flatMap((clip) => {
    const lanes = LISTED_LANES.flatMap((name) => {
      const keys = clip.keyframes?.[name] ?? [];
      return keys.length >= 2 ? [laneLine(name, keys)] : [];
    });
    const edges = [clip.motionIn ? `entra pela ${clip.motionIn.edge} em ${seconds(clip.motionIn.durationMs)} s` : "", clip.motionOut ? `sai pela ${clip.motionOut.edge} em ${seconds(clip.motionOut.durationMs)} s` : ""].filter(Boolean);
    const parts = [...lanes, ...edges];
    if (parts.length === 0) return [];
    const label = clip.layer?.type === "text" ? `${clip.id} (texto "${snippet(clip.layer)}")` : clip.id;
    return [`${label}: ${parts.join("; ")}`];
  });
}

export function motionReport(doc: VideoDocument, window: MotionWindow | null = null): MotionReport {
  const clips = visualClips(doc).filter((clip) => !window || (clip.startMs < window.toMs && clip.startMs + clip.durationMs > window.fromMs));
  const samples = samplesOf(doc, window);
  const byId = tracks(samples);
  const variety = motionVariety(clips);
  return {
    moves: moveLines(clips),
    variety: variety.line,
    findings: [...flashes(samples, doc), ...jumps(byId), ...excursions(byId), ...crossings(samples), ...linearMoves(clips), ...shadowTurns(doc, clips), ...variety.findings],
  };
}
