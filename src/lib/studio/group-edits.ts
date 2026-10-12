import { produce } from "immer";

import { fullFrame, newNullClip, newStudioId, NULL_BOX, STUDIO_LIMITS, type Clip, type Track, type VideoDocument } from "./document";
import { clipBlend } from "./clip-blend";
import { clipSpeed } from "./clip-time";
import { anchorOf, isCentered } from "./clip-placement";
import { clearRange, linkGroup } from "./edits";
import { animatedProperties, type AnimatedProperty, type Keyframes } from "./keyframes";
import { ancestorIds, childIds, clipLookup, frameAt, parentFrameOf, reframe, takesParent, WORLD_FRAME } from "./parenting";
import { canvasAspect } from "./document";
import { clipEnd, settleTimeline } from "./timeline";
import { groupContentMs, isGroupClip, type GroupClip } from "./group-scope";
import { carriesTilt } from "./clip-tilt";

export type GroupRefusal = "empty" | "missing" | "locked" | "nothingVisible" | "transitionCut" | "interleaved" | "seesThrough" | "matteAbove" | "ducking";

export type GroupResult = { ok: true; document: VideoDocument; groupId: string; clipIds: string[] } | { ok: false; reason: GroupRefusal; clipIds: string[] };

export const KEPT_PROPERTIES = ["opacity", "fades", "volume", "masks", "matte", "blend", "vfx", "color", "blur", "motion", "transitionIn", "transitionOut", "cutTransition", "scaleAxes", "anchor", "flip", "tilt", "shape", "scaledLooks", "effectClips", "speed"] as const;

export type KeptProperty = (typeof KEPT_PROPERTIES)[number];

export type UngroupRefusal = "missing" | "locked" | "keeps" | "seesThrough";

export type UngroupResult = { ok: true; document: VideoDocument; clipIds: string[]; nullId: string | null } | { ok: false; reason: UngroupRefusal; properties: KeptProperty[]; clipIds: string[] };

const CARRIED_LANES: ReadonlySet<AnimatedProperty> = new Set(["x", "y", "position", "scale", "rotation"]);

interface Seat {
  clip: Clip;
  track: Track;
  index: number;
}

function seats(doc: VideoDocument): Seat[] {
  return doc.tracks.flatMap((track, index) => track.clips.map((clip) => ({ clip, track, index })));
}

function overlaps(a: Clip, b: Clip): boolean {
  return a.startMs < clipEnd(b) && b.startMs < clipEnd(a);
}

function drawn(seat: Seat): boolean {
  return seat.track.kind === "visual" && !seat.track.hidden && !seat.clip.disabled && seat.clip.type !== "audio" && seat.clip.type !== "null";
}

function seesThrough(clip: Clip): boolean {
  return clip.type === "effect" || Boolean(clip.matte) || clipBlend(clip) !== "normal";
}

export function groupFamily(doc: VideoDocument, ids: readonly string[]): string[] {
  const lookup = clipLookup(doc);
  const found = new Set(ids.filter((id) => lookup.has(id)));
  let frontier = [...found];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const id of frontier) {
      const clip = lookup.get(id)!;
      for (const related of [...linkGroup(doc, id), ...ancestorIds(lookup, clip), ...childIds(doc, id)]) {
        if (found.has(related) || !lookup.has(related)) continue;
        found.add(related);
        next.push(related);
      }
    }
    frontier = next;
  }
  return seats(doc).filter((seat) => found.has(seat.clip.id)).map((seat) => seat.clip.id);
}

function refused(reason: GroupRefusal, clipIds: string[] = []): GroupResult {
  return { ok: false, reason, clipIds };
}

function stackingIssue(all: readonly Seat[], included: ReadonlySet<string>): { reason: GroupRefusal; clipIds: string[] } | { below: number; above: number } {
  const shown = all.filter(drawn);
  const chosen = shown.filter((seat) => included.has(seat.clip.id));
  const others = shown.filter((seat) => !included.has(seat.clip.id));
  let below = -1;
  let above = Infinity;
  for (const other of others) {
    const met = chosen.filter((seat) => overlaps(seat.clip, other.clip));
    if (met.length === 0) continue;
    const under = met.every((seat) => seat.index > other.index);
    const over = met.every((seat) => seat.index < other.index);
    if (!under && !over) return { reason: "interleaved", clipIds: [other.clip.id] };
    if (under) {
      const looking = met.find((seat) => seesThrough(seat.clip));
      if (looking) return { reason: "seesThrough", clipIds: [looking.clip.id, other.clip.id] };
      below = Math.max(below, other.index);
    } else {
      if (other.clip.matte) return { reason: "matteAbove", clipIds: [other.clip.id] };
      above = Math.min(above, other.index);
    }
  }
  return below < above ? { below, above } : { reason: "interleaved", clipIds: [] };
}

function movesWhole(track: Track, included: ReadonlySet<string>): boolean {
  return track.clips.length > 0 && track.clips.every((clip) => included.has(clip.id));
}

function duckingIssue(doc: VideoDocument, included: ReadonlySet<string>): string | null {
  const touched = (track: Track | undefined) => Boolean(track?.clips.some((clip) => included.has(clip.id)));
  for (const track of doc.tracks) {
    const rule = track.ducking;
    if (!rule) continue;
    const triggers = rule.triggerTrackIds.map((id) => doc.tracks.find((t) => t.id === id));
    if (!touched(track) && !triggers.some(touched)) continue;
    if (!movesWhole(track, included) || triggers.some((trigger) => !trigger || !movesWhole(trigger, included))) return track.id;
  }
  return null;
}

function groupSeat(doc: VideoDocument, included: ReadonlySet<string>, startMs: number, endMs: number, below: number, above: number): number | null {
  for (let index = Math.min(above - 1, doc.tracks.length - 1); index > below; index--) {
    const track = doc.tracks[index];
    if (track.kind !== "visual" || track.locked) continue;
    if (track.clips.every((clip) => included.has(clip.id) || clipEnd(clip) <= startMs || clip.startMs >= endMs)) return index;
  }
  return null;
}

function innerTrack(track: Track, clips: Clip[], startMs: number, trackIds: ReadonlyMap<string, string>, included: ReadonlySet<string>): Track {
  const inner: Track = { id: trackIds.get(track.id)!, kind: track.kind, clips: clips.map((clip) => ({ ...clip, startMs: clip.startMs - startMs })) };
  if (track.name) inner.name = track.name;
  if (track.hidden) inner.hidden = true;
  if (track.muted) inner.muted = true;
  if (track.gainDb !== undefined) inner.gainDb = track.gainDb;
  if (track.pan !== undefined) inner.pan = track.pan;
  const moved = (track.transitions ?? []).filter((transition) => included.has(transition.fromClipId) && included.has(transition.toClipId));
  if (moved.length > 0) inner.transitions = moved;
  if (track.ducking) inner.ducking = { ...track.ducking, triggerTrackIds: track.ducking.triggerTrackIds.map((id) => trackIds.get(id)!) };
  return inner;
}

export function groupClips(doc: VideoDocument, ids: readonly string[], name?: string): GroupResult {
  const all = seats(doc);
  if (ids.length === 0) return refused("empty");
  const missing = ids.filter((id) => !all.some((seat) => seat.clip.id === id));
  if (missing.length > 0) return refused("missing", missing);
  const included = new Set(groupFamily(doc, ids));
  const chosen = all.filter((seat) => included.has(seat.clip.id));
  const locked = chosen.filter((seat) => seat.track.locked);
  if (locked.length > 0) return refused("locked", locked.map((seat) => seat.clip.id));
  if (!chosen.some((seat) => seat.track.kind === "visual" && seat.clip.type !== "null")) return refused("nothingVisible");
  for (const seat of chosen) {
    const cut = (seat.track.transitions ?? []).find((transition) => included.has(transition.fromClipId) !== included.has(transition.toClipId) && (transition.fromClipId === seat.clip.id || transition.toClipId === seat.clip.id));
    if (cut) return refused("transitionCut", [cut.fromClipId, cut.toClipId]);
  }
  const ducked = duckingIssue(doc, included);
  if (ducked) return refused("ducking", []);
  const stacking = stackingIssue(all, included);
  if ("reason" in stacking) return refused(stacking.reason, stacking.clipIds);
  const startMs = Math.min(...chosen.map((seat) => seat.clip.startMs));
  const endMs = Math.max(...chosen.map((seat) => clipEnd(seat.clip)));
  const sources = doc.tracks.filter((track) => track.clips.some((clip) => included.has(clip.id)));
  const trackIds = new Map(sources.map((track) => [track.id, newStudioId("t")]));
  const tracks = sources.map((track) => innerTrack(track, track.clips.filter((clip) => included.has(clip.id)), startMs, trackIds, included));
  const groupId = newStudioId("c");
  const group: GroupClip = { id: groupId, type: "group", startMs, durationMs: endMs - startMs, trimInMs: 0, volume: 1, fadeInMs: 0, fadeOutMs: 0, transform: fullFrame(), tracks, ...(name && name.trim() !== "" ? { name: name.trim() } : {}) };
  const seat = groupSeat(doc, included, startMs, endMs, stacking.below, stacking.above);
  const document = produce(doc, (draft) => {
    for (const track of draft.tracks) {
      track.clips = track.clips.filter((clip) => !included.has(clip.id));
      if (!track.transitions) continue;
      const kept = track.transitions.filter((transition) => !included.has(transition.fromClipId));
      if (kept.length > 0) track.transitions = kept;
      else delete track.transitions;
    }
    if (seat !== null) draft.tracks[seat].clips.push(group);
    else draft.tracks.splice(stacking.below + 1, 0, { id: newStudioId("t"), kind: "visual", clips: [group] });
    settleTimeline(draft);
  });
  return { ok: true, document, groupId, clipIds: [...included] };
}

function scaled(group: Clip): boolean {
  if (group.transform.w !== 1 || group.transform.h !== 1) return true;
  return (group.keyframes?.scale ?? []).some((key) => key.value !== 1);
}

function placed(group: Clip): boolean {
  const t = group.transform;
  return t.x !== 0.5 || t.y !== 0.5 || t.w !== 1 || t.h !== 1 || t.rotation !== 0 || Boolean(group.parentId) || Boolean(group.autoOrient) || animatedProperties(group.keyframes).length > 0;
}

function keptProperties(doc: VideoDocument, group: GroupClip): KeptProperty[] {
  const kept = new Set<KeptProperty>();
  const lanes = animatedProperties(group.keyframes);
  if (group.transform.opacity !== 1 || lanes.includes("opacity")) kept.add("opacity");
  if (group.fadeInMs > 0 || group.fadeOutMs > 0) kept.add("fades");
  if ((group.masks?.length ?? 0) > 0) kept.add("masks");
  if (group.matte) kept.add("matte");
  if (clipBlend(group) !== "normal") kept.add("blend");
  if ((group.vfx?.length ?? 0) > 0) kept.add("vfx");
  if (group.color) kept.add("color");
  if ((group.blur ?? 0) > 0 || lanes.includes("blur")) kept.add("blur");
  if (group.motionIn || group.motionOut) kept.add("motion");
  if (group.transitionIn) kept.add("transitionIn");
  if (group.transitionOut) kept.add("transitionOut");
  if (doc.tracks.some((track) => (track.transitions ?? []).some((transition) => transition.fromClipId === group.id || transition.toClipId === group.id))) kept.add("cutTransition");
  if (lanes.includes("scaleX") || lanes.includes("scaleY")) kept.add("scaleAxes");
  if (!isCentered(anchorOf(group))) kept.add("anchor");
  if (group.flipX || group.flipY) kept.add("flip");
  if (carriesTilt(group)) kept.add("tilt");
  if (Math.abs(group.transform.w - group.transform.h) > 1e-9 || group.transform.w * NULL_BOX < 0.001) kept.add("shape");
  if (clipSpeed(group) !== 1) kept.add("speed");
  const inner = group.tracks.flatMap((track) => track.clips);
  if (scaled(group) && inner.some((clip) => (clip.blur ?? 0) > 0 || animatedProperties(clip.keyframes).includes("blur") || (clip.vfx?.length ?? 0) > 0)) kept.add("scaledLooks");
  if (placed(group) && inner.some((clip) => clip.type === "effect")) kept.add("effectClips");
  const audible = inner.filter((clip) => clip.type === "audio");
  if (audible.some((clip) => clip.volume * group.volume > STUDIO_LIMITS.maxVolume)) kept.add("volume");
  return KEPT_PROPERTIES.filter((property) => kept.has(property));
}

function windowed(inner: VideoDocument, fromMs: number, toMs: number): Track[] | null {
  const open: VideoDocument = { ...inner, tracks: inner.tracks.map((track) => (track.locked ? { ...track, locked: false } : track)) };
  let current: VideoDocument | null = open;
  for (const track of open.tracks) {
    if (fromMs > 0) current = current && clearRange(current, track.id, 0, fromMs);
    if (toMs < STUDIO_LIMITS.maxVideoMs) current = current && clearRange(current, track.id, toMs, STUDIO_LIMITS.maxVideoMs);
  }
  return current && current.tracks.map((track, i) => (inner.tracks[i].locked ? { ...track, locked: true } : track));
}

function nullOf(group: GroupClip): Clip {
  const holder = newNullClip(group.startMs, group.durationMs, group.transform.x, group.transform.y);
  holder.transform = { ...holder.transform, w: group.transform.w * NULL_BOX, h: group.transform.h * NULL_BOX, rotation: group.transform.rotation };
  const keyframes: Keyframes = {};
  for (const lane of animatedProperties(group.keyframes)) if (CARRIED_LANES.has(lane)) Object.assign(keyframes, { [lane]: (group.keyframes as Record<string, unknown>)[lane] });
  if (Object.keys(keyframes).length > 0) holder.keyframes = keyframes;
  if (group.autoOrient) holder.autoOrient = true;
  if (group.parentId) holder.parentId = group.parentId;
  return holder;
}

function outerOverlap(doc: VideoDocument, group: GroupClip, groupIndex: number, inner: readonly Clip[]): string[] {
  const outer = seats(doc).filter((seat) => seat.clip.id !== group.id && drawn(seat) && overlaps(seat.clip, group));
  const matte = outer.find((seat) => seat.index > groupIndex && seat.clip.matte);
  if (matte) return [matte.clip.id];
  const below = outer.filter((seat) => seat.index < groupIndex);
  const looking = inner.filter((clip) => clip.type !== "audio" && !clip.disabled && seesThrough(clip));
  for (const clip of looking) {
    const shifted = { ...clip, startMs: group.startMs + clip.startMs - group.trimInMs };
    const met = below.find((seat) => overlaps(seat.clip, shifted));
    if (met) return [clip.id, met.clip.id];
  }
  return [];
}

export function ungroupClip(doc: VideoDocument, groupId: string): UngroupResult {
  const index = doc.tracks.findIndex((track) => track.clips.some((clip) => clip.id === groupId));
  const track = doc.tracks[index];
  const group = track?.clips.find((clip) => clip.id === groupId);
  if (!track || !isGroupClip(group)) return { ok: false, reason: "missing", properties: [], clipIds: [groupId] };
  if (track.locked) return { ok: false, reason: "locked", properties: [], clipIds: [groupId] };
  const properties = keptProperties(doc, group);
  if (properties.length > 0) return { ok: false, reason: "keeps", properties, clipIds: [groupId] };
  const view: VideoDocument = { ...doc, durationMs: Math.min(groupContentMs(group), STUDIO_LIMITS.maxVideoMs), tracks: group.tracks, markers: undefined };
  const cut = windowed(view, group.trimInMs, group.trimInMs + group.durationMs);
  if (!cut) return { ok: false, reason: "locked", properties: [], clipIds: [groupId] };
  const inner = cut.flatMap((t) => t.clips);
  const blocked = outerOverlap(doc, group, index, inner);
  if (blocked.length > 0) return { ok: false, reason: "seesThrough", properties: [], clipIds: blocked };
  const holder = placed(group) ? nullOf(group) : null;
  const shift = group.startMs - group.trimInMs;
  const hidden = Boolean(track.hidden);
  const silent = hidden || Boolean(track.muted);
  const moved = (clip: Clip): Clip => {
    const next: Clip = { ...clip, startMs: clip.startMs + shift };
    if (group.disabled) next.disabled = true;
    if (clip.type === "audio" && group.volume !== 1) next.volume = clip.volume * group.volume;
    if (holder && !clip.parentId && takesParent(clip.type)) next.parentId = holder.id;
    return next;
  };
  const first = cut.find((t) => t.kind === "visual");
  const merged = first && !first.hidden && !first.locked ? first : null;
  const outerTracks = (kind: Track["kind"]) =>
    cut
      .filter((t) => t.kind === kind && t !== merged)
      .map((t): Track => ({ ...t, clips: t.clips.map(moved), ...(kind === "visual" && hidden ? { hidden: true } : {}), ...(kind === "audio" && silent ? { muted: true } : {}) }));
  const raised = outerTracks("visual");
  const sounds = outerTracks("audio");
  const children = seats(doc).filter((seat) => seat.clip.parentId === groupId);
  let document = produce(doc, (draft) => {
    const home = draft.tracks[index];
    home.clips = home.clips.filter((clip) => clip.id !== groupId);
    if (merged) {
      home.clips.push(...merged.clips.map(moved));
      if (merged.transitions) home.transitions = [...(home.transitions ?? []), ...merged.transitions];
    }
    draft.tracks.splice(index + 1, 0, ...raised);
    draft.tracks.push(...sounds);
    if (holder) draft.tracks.push({ id: newStudioId("t"), kind: "visual", clips: [holder] });
    settleTimeline(draft);
  });
  document = handedChildren(doc, document, children.map((seat) => seat.clip.id), group, holder);
  return { ok: true, document, clipIds: inner.map((clip) => clip.id), nullId: holder?.id ?? null };
}

function handedChildren(original: VideoDocument, doc: VideoDocument, childIdsOfGroup: readonly string[], group: GroupClip, holder: Clip | null): VideoDocument {
  if (childIdsOfGroup.length === 0) return doc;
  const aspect = canvasAspect(doc);
  const before = clipLookup(original);
  const after = clipLookup(doc);
  return produce(doc, (draft) => {
    for (const track of draft.tracks) {
      for (const clip of track.clips) {
        if (!childIdsOfGroup.includes(clip.id)) continue;
        const heir = holder ? after.get(holder.id)! : group.parentId ? (after.get(group.parentId) ?? null) : null;
        const target = { from: parentFrameOf(before, clip, clip.startMs, aspect), to: heir ? frameAt(after, heir, clip.startMs, aspect) : WORLD_FRAME, parented: heir !== null, strict: false };
        const result = reframe(clip as Clip, 0, target, aspect);
        if (typeof result !== "string") {
          clip.transform = result.transform;
          if (result.keyframes) clip.keyframes = result.keyframes;
        }
        if (heir) clip.parentId = heir.id;
        else delete clip.parentId;
      }
    }
  });
}
