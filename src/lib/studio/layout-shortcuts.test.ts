import { describe, expect, it } from "vitest";

import { SHORTCUT_ROWS, videoExtraActionFor } from "./video-shortcuts";

function stroke(key: string, extra: Partial<{ code: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }> = {}) {
  return { key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...extra };
}

describe("frame layout shortcuts", () => {
  it.each([
    ["a", "left"],
    ["d", "right"],
    ["h", "center"],
    ["w", "top"],
    ["s", "bottom"],
    ["v", "middle"],
  ] as const)("Alt and %s aligns to the %s", (key, alignment) => {
    expect(videoExtraActionFor(stroke(key, { altKey: true, code: `Key${key.toUpperCase()}` }))).toEqual({ type: "align", alignment });
  });

  it("reads the physical key when Alt types another character", () => {
    expect(videoExtraActionFor(stroke("å", { altKey: true, code: "KeyA" }))).toEqual({ type: "align", alignment: "left" });
  });

  it("distributes with Alt, Shift and H or V", () => {
    expect(videoExtraActionFor(stroke("H", { altKey: true, shiftKey: true, code: "KeyH" }))).toEqual({ type: "distribute", axis: "horizontal" });
    expect(videoExtraActionFor(stroke("V", { altKey: true, shiftKey: true, code: "KeyV" }))).toEqual({ type: "distribute", axis: "vertical" });
  });
});

describe("playhead edits", () => {
  it("ripple trims with Q and W and trims in place with Ctrl, Alt and Q or W", () => {
    expect(videoExtraActionFor(stroke("q", { code: "KeyQ" }))).toEqual({ type: "trimToPlayhead", edge: "start", ripple: true });
    expect(videoExtraActionFor(stroke("w", { code: "KeyW" }))).toEqual({ type: "trimToPlayhead", edge: "end", ripple: true });
    expect(videoExtraActionFor(stroke("@", { ctrlKey: true, altKey: true, code: "KeyQ" }))).toEqual({ type: "trimToPlayhead", edge: "start", ripple: false });
    expect(videoExtraActionFor(stroke("w", { metaKey: true, altKey: true, code: "KeyW" }))).toEqual({ type: "trimToPlayhead", edge: "end", ripple: false });
  });

  it("moves the clip start or end to the playhead with the brackets", () => {
    expect(videoExtraActionFor(stroke("[", { code: "BracketLeft" }))).toEqual({ type: "moveToPlayhead", edge: "start" });
    expect(videoExtraActionFor(stroke("]", { code: "BracketRight" }))).toEqual({ type: "moveToPlayhead", edge: "end" });
  });

  it("keeps the existing roll and key jump keys", () => {
    expect(videoExtraActionFor(stroke("Q", { shiftKey: true, code: "KeyQ" }))).toEqual({ type: "rollToPlayhead", edge: "start" });
    expect(videoExtraActionFor(stroke("[", { altKey: true, code: "BracketLeft" }))).toEqual({ type: "jumpKey", direction: -1 });
  });

  it("lists every new key in the shortcut sheet", () => {
    const ids = SHORTCUT_ROWS.map((row) => row.id);
    for (const id of ["trimStartToPlayhead", "trimEndToPlayhead", "trimToPlayheadKeep", "moveToPlayhead", "alignFrame", "distributeFrame", "frameSnapOff", "frameAddSelect"]) expect(ids).toContain(id);
  });
});
