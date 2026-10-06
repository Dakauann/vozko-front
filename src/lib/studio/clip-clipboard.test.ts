import { describe, expect, it } from "vitest";

import { decodeClipboard, encodeClipboard, pasteRoute } from "./clip-clipboard";
import { newMediaClip } from "./document";
import type { ClipboardPayload } from "./tools";

const payload: ClipboardPayload = {
  items: [{ trackId: "main", trackKind: "visual", offsetMs: 0, clip: { ...newMediaClip("image", "img", 2000, 1000), id: "c" } }],
  spanMs: 1000,
};

describe("clip clipboard", () => {
  it("round trips the payload through text", () => {
    expect(decodeClipboard(encodeClipboard(payload))).toEqual(payload);
  });

  it("refuses foreign or broken text", () => {
    expect(decodeClipboard("hello")).toBeNull();
    expect(decodeClipboard(JSON.stringify({ kind: "other", version: 1, payload }))).toBeNull();
    expect(decodeClipboard(JSON.stringify({ kind: "vozko.studio.clips", version: 1, payload: { items: [{ trackId: "x" }], spanMs: 1 } }))).toBeNull();
    expect(decodeClipboard(JSON.stringify({ kind: "vozko.studio.clips", version: 1, payload: { ...payload, spanMs: 0 } }))).toBeNull();
    expect(decodeClipboard(null)).toBeNull();
  });

  it("routes images first, then clips, then nothing", () => {
    const image = new File(["x"], "a.png", { type: "image/png" });
    expect(pasteRoute([image], encodeClipboard(payload), null)).toEqual({ kind: "images", files: [image] });
    expect(pasteRoute([], encodeClipboard(payload), null)).toEqual({ kind: "clips", payload });
    expect(pasteRoute([], "", payload)).toEqual({ kind: "clips", payload });
    expect(pasteRoute([], "some text", payload)).toEqual({ kind: "none" });
    expect(pasteRoute([], null, null)).toEqual({ kind: "none" });
  });
});
