import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, type Clip, type Track, type VideoDocument } from "./document";
import { documentIssue } from "./validate";

function withClip(clip: Partial<Clip>, kind: "audio" | "video" = "audio", track: Partial<Track> = {}): VideoDocument {
  const doc = emptyVideoDocument("story");
  doc.durationMs = 4000;
  const index = kind === "audio" ? 2 : 0;
  doc.tracks[index] = { ...doc.tracks[index], ...track, clips: [{ ...newMediaClip(kind, "asset", 0, 2000), id: "c", ...clip } as Clip] };
  return doc;
}

const keys = (value: number) => [{ atMs: 0, value, easing: "linear" as const }, { atMs: 1000, value: -value, easing: "easeInOut" as const }];

describe("pan in the document", () => {
  it("accepts a clip pan and pan keys on audio clips inside the range", () => {
    expect(documentIssue("video", withClip({ pan: -0.5 }))).toBeNull();
    expect(documentIssue("video", withClip({ keyframes: { pan: keys(1) } }))).toBeNull();
    expect(documentIssue("video", withClip({ pan: 1.2 }))?.code).toBe("out_of_range");
    expect(documentIssue("video", withClip({ keyframes: { pan: keys(1.5) } }))?.code).toBe("out_of_range");
  });

  it("refuses pan on clips without sound", () => {
    expect(documentIssue("video", withClip({ pan: 0.3 }, "video"))?.code).toBe("invalid");
    expect(documentIssue("video", withClip({ keyframes: { pan: keys(0.5) } }, "video"))?.code).toBe("invalid");
  });

  it("accepts a track pan on audio tracks only", () => {
    expect(documentIssue("video", withClip({}, "audio", { pan: 0.25 }))).toBeNull();
    expect(documentIssue("video", withClip({}, "audio", { pan: -2 }))?.code).toBe("out_of_range");
    expect(documentIssue("video", withClip({}, "video", { pan: 0.25 }))?.code).toBe("invalid");
  });

  it("still refuses fields it does not know", () => {
    expect(documentIssue("video", withClip({ balance: 0.2 } as Partial<Clip>))?.code).toBe("invalid");
  });
});
