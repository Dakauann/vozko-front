import { describe, expect, it } from "vitest";

import { studioOrderFrom } from "./studio-project-order";

describe("studioOrderFrom", () => {
  it("reads the order the server checked, field by field", () => {
    expect(
      studioOrderFrom({
        kind: "video",
        name: "Teaser",
        media: [{ mediaId: "m1", url: "https://cdn/m1.mp4", type: "video" }],
        aspect: "story",
        durationMs: 4000,
      }),
    ).toEqual({ kind: "video", name: "Teaser", media: [{ mediaId: "m1", url: "https://cdn/m1.mp4", type: "video" }], sizes: undefined, aspect: "story", durationMs: 4000 });
    expect(studioOrderFrom({ kind: "image", sizes: [{ width: 1440, height: 1800 }] })).toMatchObject({ kind: "image", media: [], sizes: [{ width: 1440, height: 1800 }] });
  });

  it("refuses anything the editor could not build", () => {
    for (const raw of [
      null,
      "image",
      { kind: "audio" },
      { kind: "video", aspect: "cinema" },
      { kind: "video", media: [{ mediaId: "x", url: "https://cdn/x", type: "pdf" }] },
      { kind: "image", media: [{ mediaId: 3, url: "https://cdn/x", type: "image" }] },
      { kind: "image", sizes: [{ width: "1080", height: 1080 }] },
      { kind: "image", name: 7 },
      { kind: "video", durationMs: "4000" },
    ]) {
      expect(studioOrderFrom(raw)).toBeNull();
    }
  });
});
