import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, type VideoDocument } from "./document";
import { protectedTime, retimeClip } from "./retime";
import { findClip } from "./timeline";

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    {
      id: "v1",
      kind: "visual",
      clips: [
        {
          ...newMediaClip("video", "m-a", 0, 4000),
          id: "a",
          keyframes: {
            opacity: [
              { atMs: 0, value: 0, easing: "linear" },
              { atMs: 500, value: 1, easing: "linear" },
              { atMs: 2000, value: 0.5, easing: "linear" },
              { atMs: 3500, value: 1, easing: "linear" },
              { atMs: 4000, value: 0, easing: "linear" },
            ],
          },
        },
      ],
    },
  ];
  d.durationMs = 4000;
  return d;
}

describe("protectedTime", () => {
  it("keeps the edges and stretches only the middle", () => {
    expect(protectedTime(300, 4000, 8000, 500)).toBe(300);
    expect(protectedTime(3800, 4000, 8000, 500)).toBe(7800);
    expect(protectedTime(2000, 4000, 8000, 500)).toBe(4000);
  });

  it("is a plain stretch without protection and shrinks the edges to fit a short clip", () => {
    expect(protectedTime(1000, 4000, 2000, 0)).toBe(500);
    expect(protectedTime(400, 4000, 600, 1000)).toBe(300);
    expect(protectedTime(3800, 4000, 600, 1000)).toBe(400);
  });
});

describe("retimeClip with protected edges", () => {
  const source = () => 20_000;

  it("keeps the intro and outro keys timed as they were when the clip stretches", () => {
    const result = retimeClip(doc(), "a", { speed: 0.5, protectEdgesMs: 500 }, source);
    if (!result.ok) throw new Error(result.reason);
    const times = findClip(result.document, "a")!.clip.keyframes!.opacity!.map((key) => key.atMs);
    expect(times).toEqual([0, 500, 4000, 7500, 8000]);
  });

  it("stretches every key without protection and refuses a negative edge", () => {
    const result = retimeClip(doc(), "a", { speed: 0.5 }, source);
    if (!result.ok) throw new Error(result.reason);
    expect(findClip(result.document, "a")!.clip.keyframes!.opacity!.map((key) => key.atMs)).toEqual([0, 1000, 4000, 7000, 8000]);
    expect(retimeClip(doc(), "a", { speed: 0.5, protectEdgesMs: -1 }, source)).toEqual({ ok: false, reason: "range" });
  });
});
