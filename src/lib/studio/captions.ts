import type { VideoDocument } from "./document";
import { captionClip } from "./media-clips";
import { insertCaptionTrack } from "./timeline";
import { cuesOnTimeline, parseVtt, type SourceWindow } from "./vtt";

export type CaptionsOutcome = { status: "added"; document: VideoDocument; trackId: string; count: number } | { status: "empty" } | { status: "no_room" };

export function captionsFromVtt(doc: VideoDocument, vtt: string, window: SourceWindow, trackName: string): CaptionsOutcome {
  const cues = cuesOnTimeline(parseVtt(vtt), window);
  if (cues.length === 0) return { status: "empty" };
  const result = insertCaptionTrack(doc, cues, captionClip, trackName);
  if (!result.trackId) return { status: "no_room" };
  const track = result.document.tracks.find((t) => t.id === result.trackId);
  return { status: "added", document: result.document, trackId: result.trackId, count: track?.clips.length ?? 0 };
}
