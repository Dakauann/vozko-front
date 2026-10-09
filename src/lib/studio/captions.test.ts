import { describe, expect, it } from "vitest";

import { captionsFromText, captionWindow, isCaptionMedia } from "./captions";
import { emptyVideoDocument, newMediaClip, STUDIO_LIMITS, type Clip, type VideoDocument } from "./document";
import { captionClip } from "./media-clips";
import { documentIssue } from "./validate";

function withoutIds(clip: Clip): Clip {
  return { ...clip, id: "", ...(clip.layer ? { layer: { ...clip.layer, id: "" } } : {}) };
}

const VTT = ["WEBVTT", "", "00:00:00.500 --> 00:00:02.000", "Olá", "", "00:00:02.000 --> 00:00:03.500", "Tudo bem?", ""].join("\n");
const SRT = ["1", "00:00:00,500 --> 00:00:02,000", "Olá", "", "2", "00:00:02,000 --> 00:00:03,500", "Tudo bem?", ""].join("\r\n");

describe("captionsFromText", () => {
  it("adds a named caption track aligned with the source clip", () => {
    const outcome = captionsFromText(emptyVideoDocument("story"), VTT, { startMs: 1000, trimInMs: 0, durationMs: 5000 }, "Legendas");
    expect(outcome.status).toBe("added");
    if (outcome.status !== "added") return;
    const track = outcome.document.tracks.find((t) => t.id === outcome.trackId)!;
    expect(track.name).toBe("Legendas");
    expect(outcome.count).toBe(2);
    expect(track.clips.map((c) => [c.layer?.text, c.startMs, c.durationMs])).toEqual([
      ["Olá", 1500, 1500],
      ["Tudo bem?", 3000, 1500],
    ]);
    expect(documentIssue("video", outcome.document)).toBeNull();
  });

  it("places a SubRip file as the same caption clips a WebVTT file makes", () => {
    const window = { startMs: 0, trimInMs: 0, durationMs: 5000 };
    const fromSrt = captionsFromText(emptyVideoDocument("story"), SRT, window, "Legendas");
    const fromVtt = captionsFromText(emptyVideoDocument("story"), VTT, window, "Legendas");
    if (fromSrt.status !== "added" || fromVtt.status !== "added") throw new Error("captions were not added");
    const clipsOf = (document: VideoDocument, trackId: string) => document.tracks.find((t) => t.id === trackId)!.clips.map(withoutIds);
    expect(clipsOf(fromSrt.document, fromSrt.trackId)).toEqual(clipsOf(fromVtt.document, fromVtt.trackId));
    expect(clipsOf(fromSrt.document, fromSrt.trackId)[0]).toEqual(withoutIds(captionClip({ text: "Olá", startMs: 500, endMs: 2000 })));
  });

  it("reports empty speech, counting cues too short to show", () => {
    expect(captionsFromText(emptyVideoDocument("story"), VTT, { startMs: 0, trimInMs: 10_000, durationMs: 1000 }, "x")).toEqual({ status: "empty" });
    const blink = ["WEBVTT", "", "00:00:00.500 --> 00:00:00.520", "Oi", ""].join("\n");
    expect(captionsFromText(emptyVideoDocument("story"), blink, { startMs: 0, trimInMs: 0, durationMs: 1000 }, "x")).toEqual({ status: "empty" });
  });

  it("refuses a file with no caption cues at all", () => {
    expect(captionsFromText(emptyVideoDocument("story"), "WEBVTT\n\n", { startMs: 0, trimInMs: 0, durationMs: 1000 }, "x")).toEqual({ status: "unreadable" });
    expect(captionsFromText(emptyVideoDocument("story"), "uma lista de compras\n\nleite", { startMs: 0, trimInMs: 0, durationMs: 1000 }, "x")).toEqual({ status: "unreadable" });
  });

  it("refuses the whole file when a cue would break the project", () => {
    const long = ["1", "00:00:00,000 --> 00:00:01,000", "Oi", "", "2", "00:00:01,000 --> 00:00:02,000", "a".repeat(STUDIO_LIMITS.maxTextRunes + 1), ""].join("\n");
    expect(captionsFromText(emptyVideoDocument("story"), long, { startMs: 0, trimInMs: 0, durationMs: 5000 }, "x")).toEqual({ status: "invalid" });
  });

  it("opens its own track however many tracks the video already has", () => {
    const crowded = emptyVideoDocument("story");
    crowded.tracks = Array.from({ length: 30 }, (_, i) => ({ id: `t${i}`, kind: "visual" as const, locked: true, clips: [] }));
    const outcome = captionsFromText(crowded, VTT, { startMs: 0, trimInMs: 0, durationMs: 5000 }, "x");
    expect(outcome.status).toBe("added");
    if (outcome.status === "added") expect(outcome.document.tracks).toHaveLength(31);
  });
});

describe("captionWindow", () => {
  it("follows the source clip, or the whole video from its start", () => {
    const clip = { ...newMediaClip("video", "vid", 2000, 3000), trimInMs: 400 };
    expect(captionWindow(clip)).toEqual({ startMs: 2000, trimInMs: 400, durationMs: 3000 });
    expect(captionWindow(null)).toEqual({ startMs: 0, trimInMs: 0, durationMs: STUDIO_LIMITS.maxVideoMs });
  });
});

describe("isCaptionMedia", () => {
  it("knows caption files in the library by their WebVTT or SubRip file", () => {
    expect(isCaptionMedia({ type: "document", url: "https://cdn.example/captions/w/abc.vtt?sig=1" })).toBe(true);
    expect(isCaptionMedia({ type: "document", url: "https://cdn.example/files/legenda.SRT" })).toBe(true);
    expect(isCaptionMedia({ type: "document", url: "https://cdn.example/files/contrato.pdf" })).toBe(false);
    expect(isCaptionMedia({ type: "video", url: "https://cdn.example/files/filme.vtt" })).toBe(false);
  });
});
