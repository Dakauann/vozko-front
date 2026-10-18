import { clipMarkersIssue } from "./clip-markers";
import { STUDIO_LIMITS, type Clip, type Track, type VideoDocument } from "./document";
import { isLabelColor } from "./labels";
import { runes } from "./tokens";
import type { IssueCode } from "./validate";

function clipNameIssue(clip: Pick<Clip, "name">): IssueCode | null {
  const name = clip.name ?? "";
  if (name === "") return null;
  if (name.trim() === "") return "invalid";
  return runes(name) > STUDIO_LIMITS.maxLayerNameRunes ? "too_large" : null;
}

function labelColorIssue(value: string | undefined): IssueCode | null {
  return (value ?? "") === "" || isLabelColor(value) ? null : "unknown";
}

export function clipOrganizeIssue(clip: Clip): IssueCode | null {
  if (clip.guide && clip.type === "null") return "invalid";
  return clipNameIssue(clip) ?? labelColorIssue(clip.labelColor) ?? clipMarkersIssue(clip);
}

export function trackOrganizeIssue(track: Pick<Track, "labelColor">): IssueCode | null {
  return labelColorIssue(track.labelColor);
}

export function cleanClipName(value: string): string | undefined {
  const name = [...value.trim()].slice(0, STUDIO_LIMITS.maxLayerNameRunes).join("");
  return name === "" ? undefined : name;
}

function hasGuides(tracks: readonly Track[]): boolean {
  return tracks.some((track) => track.clips.some((clip) => clip.guide || hasGuides(clip.tracks ?? [])));
}

function guidesOff(tracks: readonly Track[]): Track[] {
  return tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip) => {
      const inner = clip.tracks ? { tracks: guidesOff(clip.tracks) } : {};
      return clip.guide ? { ...clip, ...inner, disabled: true } : { ...clip, ...inner };
    }),
  }));
}

export function exportedDocument(doc: VideoDocument): VideoDocument {
  return hasGuides(doc.tracks) ? { ...doc, tracks: guidesOff(doc.tracks) } : doc;
}

export function guideCount(doc: Pick<VideoDocument, "tracks">): number {
  const count = (tracks: readonly Track[]): number => tracks.reduce((sum, track) => sum + track.clips.reduce((inner, clip) => inner + (clip.guide ? 1 : 0) + count(clip.tracks ?? []), 0), 0);
  return count(doc.tracks);
}

export function shownTracks<T extends Pick<Track, "id" | "shy">>(tracks: readonly T[], showShy: boolean, keepId: string | null = null): T[] {
  return showShy ? [...tracks] : tracks.filter((track) => !track.shy || track.id === keepId);
}

export function shyCount(tracks: readonly Pick<Track, "shy">[]): number {
  return tracks.filter((track) => track.shy).length;
}
