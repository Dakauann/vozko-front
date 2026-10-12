import type { Clip, Track, VideoDocument } from "./document";
import type { IssueCode } from "./validate";
import { listensToTrack, refusedOnEffectClips, type Vfx } from "./vfx";

function heardBy(vfx: Vfx): string | null {
  return listensToTrack(vfx.kind) ? (vfx.trackId ?? "") : null;
}

export function vfxTrackIds(tracks: readonly Track[]): string[] {
  const ids = tracks.flatMap((track) => track.clips.flatMap((clip) => (clip.vfx ?? []).flatMap((vfx) => heardBy(vfx) ?? [])));
  return [...new Set(ids)];
}

export function audioTracksOf(tracks: readonly Track[]): ReadonlySet<string> {
  return new Set(tracks.filter((track) => track.kind === "audio").map((track) => track.id));
}

export function vfxTracksIssue(doc: Pick<VideoDocument, "tracks">): IssueCode | null {
  const audio = audioTracksOf(doc.tracks);
  return vfxTrackIds(doc.tracks).every((id) => audio.has(id)) ? null : "invalid";
}

export function withHeardVfx(clip: Clip, audio: ReadonlySet<string>): Clip {
  const list = clip.vfx;
  const heard = (vfx: Vfx) => {
    const id = heardBy(vfx);
    return id === null || audio.has(id);
  };
  if (!list || list.every(heard)) return clip;
  const kept = list.filter(heard);
  const next: Clip = { ...clip, vfx: kept };
  if (kept.length === 0 && clip.type !== "effect") delete next.vfx;
  return next;
}

export function effectVfxIssue(list: readonly Vfx[] | undefined): IssueCode | null {
  return (list ?? []).some((vfx) => refusedOnEffectClips(vfx.kind)) ? "invalid" : null;
}
