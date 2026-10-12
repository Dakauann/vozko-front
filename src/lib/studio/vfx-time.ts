import type { Clip, VideoDocument } from "./document";
import type { VisualItem } from "./playback";
import { vfxValue, type Vfx } from "./vfx";

type PlanAt = (doc: VideoDocument, ms: number) => VisualItem[];

function shown(clip: Clip, kind: Vfx["kind"]): Vfx | null {
  return clip.disabled ? null : (clip.vfx?.find((vfx) => vfx.kind === kind && !vfx.hidden) ?? null);
}

function within(clip: Clip, ms: number): boolean {
  return ms >= clip.startMs && ms < clip.startMs + clip.durationMs;
}

export function steppedMs(clip: Clip, vfx: Vfx, ms: number): number {
  const step = 1000 / vfxValue(vfx, "rate", 0);
  const offset = vfx.offsetMs ?? 0;
  const held = Math.floor((ms - clip.startMs + offset) / step + 1e-9) * step - offset;
  return clip.startMs + Math.max(0, held);
}

function carriesPlanVfx(doc: VideoDocument): boolean {
  return doc.tracks.some((track) => track.kind === "visual" && track.clips.some((clip) => shown(clip, "posterizeTime") !== null || shown(clip, "echo") !== null));
}

export function trackTimes(doc: VideoDocument, ms: number): number[] {
  const times = new Array<number>(doc.tracks.length).fill(ms);
  let current = ms;
  for (let index = doc.tracks.length - 1; index >= 0; index--) {
    times[index] = current;
    const track = doc.tracks[index];
    if (track.kind !== "visual" || track.hidden) continue;
    const effect = track.clips.find((clip) => clip.type === "effect" && within(clip, current) && shown(clip, "posterizeTime"));
    if (effect) current = steppedMs(effect, shown(effect, "posterizeTime")!, current);
  }
  return times;
}

export function clipTime(clip: Clip, trackMs: number): number {
  const own = clip.type === "effect" ? null : shown(clip, "posterizeTime");
  return own && within(clip, trackMs) ? steppedMs(clip, own, trackMs) : trackMs;
}

export function steppedClipIds(doc: VideoDocument, ms: number): ReadonlySet<string> {
  if (!carriesPlanVfx(doc)) return new Set();
  const times = trackTimes(doc, ms);
  return new Set(doc.tracks.flatMap((track, index) => track.clips.filter((clip) => clipTime(clip, times[index]) !== ms).map((clip) => clip.id)));
}

function onlyTrack(doc: VideoDocument, trackIndex: number): VideoDocument {
  return { ...doc, tracks: doc.tracks.map((track, index) => (index === trackIndex ? track : { ...track, hidden: true })) };
}

function clipItem(planAt: PlanAt, doc: VideoDocument, trackIndex: number, clipId: string, ms: number): VisualItem | null {
  return planAt(onlyTrack(doc, trackIndex), ms).find((item) => item.clipId === clipId) ?? null;
}

function echoCopies(planAt: PlanAt, doc: VideoDocument, item: VisualItem, clip: Clip, at: number): VisualItem[] {
  const echo = shown(clip, "echo");
  if (!echo || !item.active) return [];
  const localMs = Math.max(0, at - clip.startMs);
  const count = Math.round(vfxValue(echo, "count", localMs));
  const delay = vfxValue(echo, "delay", localMs);
  const amount = vfxValue(echo, "amount", localMs);
  const decay = vfxValue(echo, "decay", localMs);
  const copies: VisualItem[] = [];
  for (let k = count; k >= 1; k--) {
    const earlier = at - k * delay;
    if (earlier < clip.startMs) continue;
    const copy = clipItem(planAt, doc, item.trackIndex, clip.id, earlier);
    const opacity = (copy?.opacity ?? 0) * amount * decay ** k;
    if (copy?.active && opacity > 0) copies.push({ ...copy, opacity });
  }
  return copies;
}

export function timedPlan(doc: VideoDocument, ms: number, planAt: PlanAt): VisualItem[] {
  if (!carriesPlanVfx(doc)) return planAt(doc, ms);
  const times = trackTimes(doc, ms);
  const plans = new Map<number, VisualItem[]>();
  const planFor = (at: number) => {
    const known = plans.get(at);
    if (known) return known;
    const made = planAt(doc, at);
    plans.set(at, made);
    return made;
  };
  return times.flatMap((trackMs, trackIndex) =>
    planFor(trackMs)
      .filter((item) => item.trackIndex === trackIndex)
      .flatMap((item) => {
        const clip = doc.tracks[trackIndex].clips.find((entry) => entry.id === item.clipId);
        if (!clip) return [item];
        const at = clipTime(clip, trackMs);
        const held = at === trackMs ? item : clipItem(planAt, doc, trackIndex, clip.id, at);
        if (!held) return [];
        const copies = echoCopies(planAt, doc, held, clip, at);
        return [copies.length > 0 ? { ...held, echo: copies } : held];
      }),
  );
}
