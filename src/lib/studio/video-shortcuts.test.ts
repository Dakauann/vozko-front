import { describe, expect, it } from "vitest";

import { videoExtraActionFor } from "./video-shortcuts";

const stroke = (key: string, extra: Partial<{ ctrlKey: boolean; shiftKey: boolean; altKey: boolean; target: EventTarget }> = {}) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...extra,
});

describe("video extra shortcuts", () => {
  it("adds a marker with M and jumps between markers with Alt and the arrows", () => {
    expect(videoExtraActionFor(stroke("m"))).toEqual({ type: "addMarker" });
    expect(videoExtraActionFor(stroke("ArrowRight", { altKey: true }))).toEqual({ type: "jumpMarker", direction: 1 });
    expect(videoExtraActionFor(stroke("ArrowLeft", { altKey: true }))).toEqual({ type: "jumpMarker", direction: -1 });
  });

  it("stays out of typing and other chords", () => {
    expect(videoExtraActionFor(stroke("m", { ctrlKey: true }))).toBeNull();
    expect(videoExtraActionFor(stroke("m", { target: document.createElement("input") }))).toBeNull();
    expect(videoExtraActionFor(stroke("ArrowRight"))).toBeNull();
  });
});

describe("keyframe shortcuts", () => {
  it("navigates keys with Alt and the brackets and toggles a key with Shift and K", () => {
    expect(videoExtraActionFor({ ...stroke("["), altKey: true, code: "BracketLeft" })).toEqual({ type: "jumpKey", direction: -1 });
    expect(videoExtraActionFor({ ...stroke("]"), altKey: true, code: "BracketRight" })).toEqual({ type: "jumpKey", direction: 1 });
    expect(videoExtraActionFor(stroke("K", { shiftKey: true }))).toEqual({ type: "toggleKey" });
    expect(videoExtraActionFor(stroke("k"))).toBeNull();
  });
});

describe("editing shortcuts", () => {
  it.each([
    [stroke("a"), { type: "tool", tool: "select" }],
    [stroke("b"), { type: "tool", tool: "blade" }],
    [stroke("t"), { type: "cycleTrim" }],
    [stroke("y"), { type: "tool", tool: "slip" }],
    [stroke("u"), { type: "tool", tool: "slide" }],
    [stroke("A", { shiftKey: true }), { type: "selectForward", allTracks: false }],
    [stroke("A", { shiftKey: true, ctrlKey: true }), { type: "selectForward", allTracks: true }],
    [stroke("y", { altKey: true }), { type: "selectFromPlayhead", direction: "after" }],
    [stroke("y", { altKey: true, ctrlKey: true }), { type: "selectFromPlayhead", direction: "before" }],
    [stroke("i"), { type: "markIn" }],
    [stroke("o"), { type: "markOut" }],
    [stroke("X", { shiftKey: true, ctrlKey: true }), { type: "clearRange" }],
    [stroke(";"), { type: "lift" }],
    [stroke("'"), { type: "extract" }],
    [stroke("c", { ctrlKey: true }), { type: "copy" }],
    [stroke("x", { ctrlKey: true }), { type: "cut" }],
    [stroke("."), { type: "nudge", frames: 1 }],
    [{ ...stroke("<", { shiftKey: true }), code: "Comma" }, { type: "nudge", frames: -10 }],
    [stroke("d"), { type: "toggleDisabled" }],
    [stroke("b", { ctrlKey: true }), { type: "cutAll" }],
    [stroke("k", { ctrlKey: true }), { type: "cutAll" }],
    [stroke("Z", { shiftKey: true }), { type: "zoomToFit" }],
  ])("maps %o", (input, action) => {
    expect(videoExtraActionFor(input)).toEqual(action);
  });
});

describe("focus shortcuts", () => {
  it("enters focus with F and leaves with Escape", () => {
    expect(videoExtraActionFor(stroke("f"))).toEqual({ type: "focus" });
    expect(videoExtraActionFor(stroke("Escape"))).toEqual({ type: "escape" });
  });
});

describe("paste is left to the paste event", () => {
  it("does not claim Ctrl+V so the browser fires paste", () => {
    expect(videoExtraActionFor(stroke("v", { ctrlKey: true }))).toBeNull();
    expect(videoExtraActionFor(stroke("V", { ctrlKey: true, shiftKey: true }))).toBeNull();
  });
});
