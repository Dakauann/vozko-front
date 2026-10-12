import { msOfFrame, STUDIO_LIMITS, type Clip, type Track, type VideoDocument } from "./document";
import { edgeBounds, linkGroup, mainTrackId, rearrange, trimChange, type ClipChange, type ClipSource, type EdgeBound, type TrimLimit } from "./edits";
import { clipEnd, clipsAt, findClip } from "./timeline";

export type TrimEdge = "start" | "end";

export interface TrimBlock {
  limit: TrimLimit;
  clipId: string | null;
  atMs: number;
}

export type TrimRefusal = { reason: "missing" } | { reason: "locked"; trackId: string } | { reason: "unchanged" } | { reason: "invalid" } | { reason: "blocked"; block: TrimBlock };

export type TrimEdit = { ok: true; document: VideoDocument; atMs: number; block: TrimBlock | null; changed: string[] } | ({ ok: false } & TrimRefusal);

export interface TrimOptions {
  linked: boolean;
}

export type TrimMode = "roll" | "slide";

export interface TrimPreview {
  mode: TrimMode;
  clipId: string;
  edge: TrimEdge;
}

export interface TrimFrame {
  clipId: string;
  localMs: number;
  live: boolean;
}

interface Bound {
  deltaMs: number;
  limit: TrimLimit;
  clipId: string | null;
}

interface Limits {
  lows: Bound[];
  highs: Bound[];
}

const LAST_FRAME_MS = msOfFrame(1);

function relative(bound: EdgeBound, baseMs: number, clipId: string | null): Bound {
  return { deltaMs: bound.ms - baseMs, limit: bound.limit, clipId };
}

function gapBefore(track: Track, atMs: number, ignore: ReadonlySet<string>): Bound {
  const previous = track.clips.filter((c) => !ignore.has(c.id) && clipEnd(c) <= atMs).reduce<Clip | null>((best, c) => (!best || clipEnd(c) > clipEnd(best) ? c : best), null);
  return previous ? { deltaMs: clipEnd(previous) - atMs, limit: "neighbour", clipId: previous.id } : { deltaMs: -atMs, limit: "video", clipId: null };
}

function gapAfter(track: Track, atMs: number, ignore: ReadonlySet<string>): Bound {
  const next = track.clips.filter((c) => !ignore.has(c.id) && c.startMs >= atMs).reduce<Clip | null>((best, c) => (!best || c.startMs < best.startMs ? c : best), null);
  return next ? { deltaMs: next.startMs - atMs, limit: "neighbour", clipId: next.id } : { deltaMs: STUDIO_LIMITS.maxVideoMs - atMs, limit: "video", clipId: null };
}

function tightest(bounds: readonly Bound[], side: "low" | "high"): Bound {
  return bounds.reduce((best, b) => ((side === "low" ? b.deltaMs > best.deltaMs : b.deltaMs < best.deltaMs) ? b : best));
}

type Resolved = { ok: true; deltaMs: number; bound: Bound | null } | ({ ok: false } & TrimRefusal);

function resolve(limits: Limits, requestedMs: number, baseMs: number): Resolved {
  if (requestedMs === 0) return { ok: false, reason: "unchanged" };
  const low = tightest(limits.lows, "low");
  const high = tightest(limits.highs, "high");
  const deltaMs = Math.min(Math.max(requestedMs, Math.min(low.deltaMs, 0)), Math.max(high.deltaMs, 0));
  const bound = requestedMs > 0 ? high : low;
  const reached = deltaMs !== requestedMs ? bound : null;
  if (deltaMs === 0) return { ok: false, reason: "blocked", block: blockOf(bound, baseMs) };
  return { ok: true, deltaMs, bound: reached };
}

function blockOf(bound: Bound, baseMs: number): TrimBlock {
  return { limit: bound.limit, clipId: bound.clipId, atMs: baseMs + bound.deltaMs };
}

function finish(doc: VideoDocument, changes: ReadonlyMap<string, ClipChange>, atMs: number, bound: Bound | null, baseMs: number): TrimEdit {
  const document = rearrange(doc, changes);
  if (!document) return { ok: false, reason: "invalid" };
  return { ok: true, document, atMs, block: bound ? blockOf(bound, baseMs) : null, changed: [...changes.keys()] };
}

interface CutSite {
  track: Track;
  left: Clip | null;
  right: Clip | null;
}

function touching(track: Track, side: "left" | "right", atMs: number, except: string): Clip | null {
  return track.clips.find((c) => c.id !== except && (side === "left" ? clipEnd(c) === atMs : c.startMs === atMs)) ?? null;
}

function primaryCut(clip: Clip, track: Track, edge: TrimEdge): CutSite {
  if (edge === "end") return { track, left: clip, right: touching(track, "right", clipEnd(clip), clip.id) };
  return { track, left: touching(track, "left", clip.startMs, clip.id), right: clip };
}

function cutSites(doc: VideoDocument, primary: CutSite, cutMs: number, options: TrimOptions): CutSite[] {
  if (!options.linked) return [primary];
  const sites = new Map<string, CutSite>([[primary.track.id, primary]]);
  for (const side of ["left", "right"] as const) {
    const anchor = primary[side];
    if (!anchor) continue;
    for (const id of linkGroup(doc, anchor.id)) {
      const found = findClip(doc, id)!;
      if (found.track.id === primary.track.id) continue;
      if ((side === "left" ? clipEnd(found.clip) : found.clip.startMs) !== cutMs) continue;
      const site = sites.get(found.track.id) ?? { track: found.track, left: null, right: null };
      sites.set(found.track.id, { ...site, [side]: found.clip });
    }
  }
  return [...sites.values()];
}

function cutLimits(sites: readonly CutSite[], cutMs: number, source: ClipSource): Limits {
  const limits: Limits = { lows: [], highs: [] };
  for (const site of sites) {
    if (site.left) {
      const bounds = edgeBounds(site.left, "end", source(site.left.id));
      limits.lows.push(relative(bounds.low, cutMs, site.left.id));
      limits.highs.push(relative(bounds.high, cutMs, site.left.id));
    } else limits.lows.push(gapBefore(site.track, cutMs, new Set()));
    if (site.right) {
      const bounds = edgeBounds(site.right, "start", source(site.right.id));
      limits.lows.push(relative(bounds.low, cutMs, site.right.id));
      limits.highs.push(relative(bounds.high, cutMs, site.right.id));
    } else limits.highs.push(gapAfter(site.track, cutMs, new Set()));
  }
  return limits;
}

export function rollCut(doc: VideoDocument, clipId: string, edge: TrimEdge, atMs: number, source: ClipSource = () => undefined, options: TrimOptions = { linked: true }): TrimEdit {
  const found = findClip(doc, clipId);
  if (!found) return { ok: false, reason: "missing" };
  const cutMs = edge === "end" ? clipEnd(found.clip) : found.clip.startMs;
  const sites = cutSites(doc, primaryCut(found.clip, found.track, edge), cutMs, options);
  const locked = sites.find((site) => site.track.locked);
  if (locked) return { ok: false, reason: "locked", trackId: locked.track.id };
  const resolved = resolve(cutLimits(sites, cutMs, source), Math.round(atMs) - cutMs, cutMs);
  if (!resolved.ok) return resolved;
  const target = cutMs + resolved.deltaMs;
  const changes = new Map<string, ClipChange>();
  for (const site of sites) {
    if (site.left) changes.set(site.left.id, trimChange(site.left, "end", target, source(site.left.id)));
    if (site.right) changes.set(site.right.id, trimChange(site.right, "start", target, source(site.right.id)));
  }
  return finish(doc, changes, target, resolved.bound, cutMs);
}

interface SlideSite {
  track: Track;
  clip: Clip;
  previous: Clip | null;
  next: Clip | null;
}

function slideSites(doc: VideoDocument, clipId: string, options: TrimOptions): SlideSite[] {
  const ids = options.linked ? [clipId, ...linkGroup(doc, clipId).filter((id) => id !== clipId)] : [clipId];
  const moving = new Set(ids);
  return ids.map((id) => {
    const { clip, track } = findClip(doc, id)!;
    const others = track.clips.filter((c) => !moving.has(c.id));
    return { track, clip, previous: others.find((c) => clipEnd(c) === clip.startMs) ?? null, next: others.find((c) => c.startMs === clipEnd(clip)) ?? null };
  });
}

function slideLimits(sites: readonly SlideSite[], source: ClipSource): Limits {
  const moving = new Set(sites.map((site) => site.clip.id));
  const limits: Limits = { lows: [], highs: [] };
  for (const { track, clip, previous, next } of sites) {
    if (previous) {
      const bounds = edgeBounds(previous, "end", source(previous.id));
      limits.lows.push(relative(bounds.low, clipEnd(previous), previous.id));
      limits.highs.push(relative(bounds.high, clipEnd(previous), previous.id));
    } else limits.lows.push(gapBefore(track, clip.startMs, moving));
    if (next) {
      const bounds = edgeBounds(next, "start", source(next.id));
      limits.lows.push(relative(bounds.low, next.startMs, next.id));
      limits.highs.push(relative(bounds.high, next.startMs, next.id));
    } else limits.highs.push(gapAfter(track, clipEnd(clip), moving));
  }
  return limits;
}

function sharedNeighbour(sites: readonly SlideSite[]): Clip | null {
  const seen = new Set<string>();
  for (const neighbour of sites.flatMap((site) => [site.previous, site.next])) {
    if (!neighbour) continue;
    if (seen.has(neighbour.id)) return neighbour;
    seen.add(neighbour.id);
  }
  return null;
}

export function slideClip(doc: VideoDocument, clipId: string, startMs: number, source: ClipSource = () => undefined, options: TrimOptions = { linked: true }): TrimEdit {
  const found = findClip(doc, clipId);
  if (!found) return { ok: false, reason: "missing" };
  const sites = slideSites(doc, clipId, options);
  const locked = sites.find((site) => site.track.locked);
  if (locked) return { ok: false, reason: "locked", trackId: locked.track.id };
  const baseMs = found.clip.startMs;
  const shared = sharedNeighbour(sites);
  if (shared) return { ok: false, reason: "blocked", block: { limit: "neighbour", clipId: shared.id, atMs: baseMs } };
  const resolved = resolve(slideLimits(sites, source), Math.round(startMs) - baseMs, baseMs);
  if (!resolved.ok) return resolved;
  const delta = resolved.deltaMs;
  const changes = new Map<string, ClipChange>();
  for (const { clip, previous, next } of sites) {
    changes.set(clip.id, { startMs: clip.startMs + delta });
    if (previous) changes.set(previous.id, trimChange(previous, "end", clipEnd(previous) + delta, source(previous.id)));
    if (next) changes.set(next.id, trimChange(next, "start", next.startMs + delta, source(next.id)));
  }
  return finish(doc, changes, baseMs + delta, resolved.bound, baseMs);
}

export function limitOf(edit: TrimEdit): TrimLimit | undefined {
  if (edit.ok) return edit.block?.limit;
  return edit.reason === "blocked" ? edit.block.limit : undefined;
}

function frame(clip: Clip | null, at: "first" | "last", live: boolean): TrimFrame | null {
  if (!clip) return null;
  return { clipId: clip.id, localMs: at === "first" ? 0 : Math.max(0, clip.durationMs - LAST_FRAME_MS), live };
}

export function trimPreviewFrames(doc: VideoDocument, preview: TrimPreview): (TrimFrame | null)[][] | null {
  const found = findClip(doc, preview.clipId);
  if (!found) return null;
  if (preview.mode === "roll") {
    const cut = primaryCut(found.clip, found.track, preview.edge);
    return [[frame(cut.left, "last", true), frame(cut.right, "first", true)]];
  }
  const [site] = slideSites(doc, preview.clipId, { linked: false });
  return [
    [frame(site.clip, "first", false), frame(site.clip, "last", false)],
    [frame(site.previous, "last", true), frame(site.next, "first", true)],
  ];
}

function covers(clip: Clip, atMs: number): boolean {
  return clip.startMs <= atMs && atMs < clipEnd(clip);
}

export function clipUnder(doc: VideoDocument, selection: readonly string[], atMs: number): string | null {
  const selected = selection.find((id) => {
    const clip = findClip(doc, id)?.clip;
    return clip !== undefined && covers(clip, atMs);
  });
  if (selected) return selected;
  const main = doc.tracks.find((t) => t.id === mainTrackId(doc));
  const onMain = main?.clips.find((c) => covers(c, atMs));
  if (onMain) return onMain.id;
  return [...clipsAt(doc, atMs)].reverse().find((active) => covers(active.clip, atMs))?.clip.id ?? null;
}

export function nearestEdge(clip: Pick<Clip, "startMs" | "durationMs">, atMs: number): TrimEdge {
  return Math.abs(atMs - clip.startMs) <= Math.abs(clipEnd(clip) - atMs) ? "start" : "end";
}
