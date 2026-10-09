import { cuesOnTimeline, parseCaptionCues, type SourceWindow } from "./caption-cues";
import { STUDIO_LIMITS, type Clip, type VideoDocument } from "./document";
import { captionClip } from "./media-clips";
import { insertCaptionTrack } from "./timeline";
import { documentIssue } from "./validate";

export type CaptionsOutcome =
  | { status: "added"; document: VideoDocument; trackId: string; count: number }
  | { status: "unreadable" }
  | { status: "empty" }
  | { status: "invalid" };

const CAPTION_FILE = /\.(vtt|srt)$/i;

export function captionsFromText(doc: VideoDocument, text: string, window: SourceWindow, trackName: string): CaptionsOutcome {
  const parsed = parseCaptionCues(text);
  if (parsed.length === 0) return { status: "unreadable" };
  const result = insertCaptionTrack(doc, cuesOnTimeline(parsed, window), captionClip, trackName);
  if (!result.trackId) return { status: "empty" };
  if (documentIssue("video", result.document)) return { status: "invalid" };
  const track = result.document.tracks.find((t) => t.id === result.trackId);
  return { status: "added", document: result.document, trackId: result.trackId, count: track?.clips.length ?? 0 };
}

export function captionWindow(source: Pick<Clip, "startMs" | "trimInMs" | "durationMs"> | null): SourceWindow {
  if (!source) return { startMs: 0, trimInMs: 0, durationMs: STUDIO_LIMITS.maxVideoMs };
  return { startMs: source.startMs, trimInMs: source.trimInMs, durationMs: source.durationMs };
}

export function isCaptionMedia(media: { type: string; url: string }): boolean {
  return media.type === "document" && CAPTION_FILE.test(media.url.split(/[?#]/)[0]);
}
