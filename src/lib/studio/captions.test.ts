import { describe, expect, it } from "vitest";

import { captionsFromVtt } from "./captions";
import { emptyVideoDocument, STUDIO_LIMITS } from "./document";
import { documentIssue } from "./validate";

const VTT = ["WEBVTT", "", "00:00:00.500 --> 00:00:02.000", "Olá", "", "00:00:02.000 --> 00:00:03.500", "Tudo bem?", ""].join("\n");

describe("captionsFromVtt", () => {
  it("adds a named caption track aligned with the source clip", () => {
    const outcome = captionsFromVtt(emptyVideoDocument("story"), VTT, { startMs: 1000, trimInMs: 0, durationMs: 5000 }, "Legendas");
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

  it("reports empty speech and a full timeline", () => {
    expect(captionsFromVtt(emptyVideoDocument("story"), "WEBVTT\n\n", { startMs: 0, trimInMs: 0, durationMs: 1000 }, "x")).toEqual({ status: "empty" });
    const full = emptyVideoDocument("story");
    full.tracks = Array.from({ length: STUDIO_LIMITS.maxVisualTracks }, (_, i) => ({ id: `t${i}`, kind: "visual" as const, locked: true, clips: [] }));
    expect(captionsFromVtt(full, VTT, { startMs: 0, trimInMs: 0, durationMs: 5000 }, "x")).toEqual({ status: "no_room" });
  });
});
