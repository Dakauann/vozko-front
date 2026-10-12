import { STUDIO_LIMITS, type Clip, type VideoDocument } from "./document";
import { linkGroup, rearrange, trimClipEdge, type ClipChange, type ClipSource, type TrimMode } from "./edits";
import { clipEnd, findClip, type ClipLocation } from "./timeline";
import { addTransition, type TransitionKind } from "./transitions";

export type TimingRefusal = "missing" | "locked" | "tooFew" | "blocked" | "range" | "apart" | "transition" | "noClip" | "unchanged";

export type TimingResult =
  | { ok: true; document: VideoDocument; changed: string[]; transitions: string[] }
  | { ok: false; reason: TimingRefusal; clipId?: string; blockerId?: string };

export type PlayheadEdge = "start" | "end";

export interface SequenceOptions {
  gapMs?: number;
  transition?: { kind: TransitionKind; durationMs?: number };
}

interface Unit {
  lead: ClipLocation;
  members: ClipLocation[];
  start: number;
  end: number;
}

type Units = { ok: true; units: Unit[] } | { ok: false; reason: TimingRefusal; clipId?: string };

function unitsOf(doc: VideoDocument, ids: readonly string[]): Units {
  const units: Unit[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const lead = findClip(doc, id);
    if (!lead) return { ok: false, reason: "missing", clipId: id };
    if (seen.has(id)) continue;
    const members = linkGroup(doc, id).map((member) => findClip(doc, member)!);
    const held = members.find((member) => member.track.locked);
    if (held) return { ok: false, reason: "locked", clipId: held.clip.id };
    for (const member of members) seen.add(member.clip.id);
    units.push({ lead, members, start: Math.min(...members.map((m) => m.clip.startMs)), end: Math.max(...members.map((m) => clipEnd(m.clip))) });
  }
  return { ok: true, units };
}

function overlaps(a: Pick<Clip, "startMs" | "durationMs">, b: Pick<Clip, "startMs" | "durationMs">): boolean {
  return a.startMs < clipEnd(b) && b.startMs < clipEnd(a);
}

function blockerOf(doc: VideoDocument, changes: ReadonlyMap<string, ClipChange>): { clipId: string; blockerId: string } | null {
  for (const track of doc.tracks) {
    const laid = track.clips.map((clip) => ({ id: clip.id, startMs: changes.get(clip.id)?.startMs ?? clip.startMs, durationMs: clip.durationMs, moved: changes.has(clip.id) }));
    for (const moved of laid.filter((clip) => clip.moved)) {
      const hit = laid.find((other) => other.id !== moved.id && overlaps(moved, other));
      if (hit) return { clipId: moved.id, blockerId: hit.id };
    }
  }
  return null;
}

function placeUnits(doc: VideoDocument, moves: readonly { unit: Unit; delta: number }[]): TimingResult {
  const changes = new Map<string, ClipChange>();
  for (const { unit, delta } of moves) {
    if (delta === 0) continue;
    for (const member of unit.members) {
      const startMs = member.clip.startMs + delta;
      if (startMs < 0 || startMs + member.clip.durationMs > STUDIO_LIMITS.maxVideoMs) return { ok: false, reason: "range", clipId: unit.lead.clip.id };
      changes.set(member.clip.id, { startMs, trackId: member.track.id });
    }
  }
  if (changes.size === 0) return { ok: true, document: doc, changed: [], transitions: [] };
  const document = rearrange(doc, changes);
  if (document) return { ok: true, document, changed: [...changes.keys()], transitions: [] };
  const blocker = blockerOf(doc, changes);
  return blocker ? { ok: false, reason: "blocked", ...blocker } : { ok: false, reason: "blocked" };
}

function withTransitions(result: TimingResult, units: readonly Unit[], transition: NonNullable<SequenceOptions["transition"]>): TimingResult {
  if (!result.ok) return result;
  let document = result.document;
  const transitions: string[] = [];
  for (const [index, unit] of units.slice(1).entries()) {
    const from = findClip(document, units[index].lead.clip.id)!;
    const to = findClip(document, unit.lead.clip.id)!;
    if (from.track.id !== to.track.id || clipEnd(from.clip) !== to.clip.startMs) continue;
    const added = addTransition(document, { fromClipId: from.clip.id, toClipId: to.clip.id, kind: transition.kind, durationMs: transition.durationMs });
    if (!added.ok) return { ok: false, reason: "transition", clipId: to.clip.id };
    document = added.document;
    transitions.push(added.transitionId);
  }
  if (transitions.length === 0) return { ok: false, reason: "apart" };
  return { ...result, document, transitions };
}

export function sequenceClips(doc: VideoDocument, ids: readonly string[], options: SequenceOptions): TimingResult {
  const found = unitsOf(doc, ids);
  if (!found.ok) return found;
  const { units } = found;
  if (units.length < 2) return { ok: false, reason: "tooFew" };
  const gap = Math.round(options.gapMs ?? 0);
  let cursor = units[0].end + gap;
  const moves = units.slice(1).map((unit) => {
    const delta = cursor - unit.start;
    cursor += unit.end - unit.start + gap;
    return { unit, delta };
  });
  const placed = placeUnits(doc, moves);
  return options.transition ? withTransitions(placed, units, options.transition) : placed;
}

export function staggerClips(doc: VideoDocument, ids: readonly string[], stepMs: number): TimingResult {
  const found = unitsOf(doc, ids);
  if (!found.ok) return found;
  const { units } = found;
  if (units.length < 2) return { ok: false, reason: "tooFew" };
  const step = Math.round(stepMs);
  return placeUnits(
    doc,
    units.map((unit, index) => ({ unit, delta: units[0].start + index * step - unit.start })),
  );
}

export function moveToPlayhead(doc: VideoDocument, ids: readonly string[], edge: PlayheadEdge, atMs: number): TimingResult {
  const found = unitsOf(doc, ids);
  if (!found.ok) return found;
  if (found.units.length === 0) return { ok: false, reason: "noClip" };
  const at = Math.round(atMs);
  return placeUnits(
    doc,
    found.units.map((unit) => ({ unit, delta: (edge === "start" ? at : at - (clipEnd(unit.lead.clip) - unit.lead.clip.startMs)) - unit.lead.clip.startMs })),
  );
}

function spans(clip: Pick<Clip, "startMs" | "durationMs">, atMs: number): boolean {
  return clip.startMs < atMs && atMs < clipEnd(clip);
}

export function playheadTargets(doc: VideoDocument, selection: readonly string[], atMs: number): string[] {
  if (selection.length > 0) return selection.filter((id) => {
    const found = findClip(doc, id);
    return found !== null && spans(found.clip, atMs);
  });
  return doc.tracks.filter((track) => !track.locked).flatMap((track) => track.clips.filter((clip) => spans(clip, atMs)).map((clip) => clip.id));
}

export function trimToPlayhead(doc: VideoDocument, ids: readonly string[], edge: PlayheadEdge, atMs: number, source: ClipSource, mode: TrimMode): TimingResult {
  const targets = ids.filter((id) => {
    const found = findClip(doc, id);
    return found !== null && spans(found.clip, atMs);
  });
  if (targets.length === 0) return { ok: false, reason: "noClip" };
  const held = targets.find((id) => findClip(doc, id)!.track.locked);
  if (held) return { ok: false, reason: "locked", clipId: held };
  let document = doc;
  const changed: string[] = [];
  for (const id of targets) {
    const current = findClip(document, id);
    if (!current || !spans(current.clip, atMs)) continue;
    const next = trimClipEdge(document, id, edge, atMs, source, mode);
    if (next === document) continue;
    document = next;
    changed.push(id);
  }
  return changed.length === 0 ? { ok: false, reason: "unchanged" } : { ok: true, document, changed, transitions: [] };
}
