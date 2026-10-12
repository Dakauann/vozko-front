import { describe, expect, it } from "vitest";

import { previewZoomActionFor, videoExtraActionFor } from "./video-shortcuts";

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
    expect(videoExtraActionFor(stroke("ArrowRight", { altKey: true }))).toEqual({ type: "nudgeKeysOrJumpMarker", direction: 1, frames: 1 });
    expect(videoExtraActionFor(stroke("ArrowLeft", { altKey: true }))).toEqual({ type: "nudgeKeysOrJumpMarker", direction: -1, frames: 1 });
  });

  it("stays out of typing and other chords", () => {
    expect(videoExtraActionFor(stroke("m", { ctrlKey: true }))).toBeNull();
    expect(videoExtraActionFor(stroke("m", { target: document.createElement("input") }))).toBeNull();
    expect(videoExtraActionFor(stroke("ArrowRight"))).toBeNull();
  });
});

describe("graph editor shortcuts", () => {
  it("toggles the graph with Shift F3 and fits it to the clip or the selected keys", () => {
    expect(videoExtraActionFor(stroke("F3", { shiftKey: true }))).toEqual({ type: "toggleGraph" });
    expect(videoExtraActionFor(stroke("F3"))).toBeNull();
    expect(videoExtraActionFor(stroke("F", { shiftKey: true }))).toEqual({ type: "fitGraph", selection: false });
    expect(videoExtraActionFor(stroke("F", { shiftKey: true, ctrlKey: true }))).toEqual({ type: "fitGraph", selection: true });
    expect(videoExtraActionFor(stroke("F3", { shiftKey: true, target: document.createElement("input") }))).toBeNull();
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
    [stroke("Q", { shiftKey: true }), { type: "rollToPlayhead", edge: "start" }],
    [stroke("W", { shiftKey: true }), { type: "rollToPlayhead", edge: "end" }],
  ])("maps %o", (input, action) => {
    expect(videoExtraActionFor(input)).toEqual(action);
  });
});

describe("work area shortcuts", () => {
  it("plays the marked range with Ctrl+Shift+Space, toggles the loop with Shift+L and sets the area with Alt+B and Alt+N", () => {
    expect(videoExtraActionFor(stroke(" ", { ctrlKey: true, shiftKey: true }))).toEqual({ type: "playRange" });
    expect(videoExtraActionFor(stroke("L", { shiftKey: true }))).toEqual({ type: "toggleLoop" });
    expect(videoExtraActionFor({ ...stroke("∫", { altKey: true }), code: "KeyB" })).toEqual({ type: "markIn" });
    expect(videoExtraActionFor({ ...stroke("n", { altKey: true }), code: "KeyN" })).toEqual({ type: "markOut" });
    expect(videoExtraActionFor({ ...stroke("B", { altKey: true, shiftKey: true }), code: "KeyB" })).toBeNull();
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

describe("keyframe curve shortcuts", () => {
  it("eases both sides, the incoming or the outgoing side of keys with F9, and holds them with Ctrl Alt H", () => {
    expect(videoExtraActionFor(stroke("F9"))).toEqual({ type: "easeSides", sides: "both" });
    expect(videoExtraActionFor(stroke("F9", { shiftKey: true }))).toEqual({ type: "easeSides", sides: "in" });
    expect(videoExtraActionFor(stroke("F9", { ctrlKey: true, shiftKey: true }))).toEqual({ type: "easeSides", sides: "out" });
    expect(videoExtraActionFor(stroke("F9", { ctrlKey: true }))).toBeNull();
    expect(videoExtraActionFor(stroke("h", { ctrlKey: true, altKey: true }))).toEqual({ type: "easeKeys", easing: "hold" });
    expect(videoExtraActionFor(stroke("F9", { altKey: true }))).toBeNull();
  });

  it("opens the key velocity with Ctrl Shift K", () => {
    expect(videoExtraActionFor(stroke("K", { ctrlKey: true, shiftKey: true }))).toEqual({ type: "keyVelocity" });
    expect(videoExtraActionFor(stroke("k", { ctrlKey: true }))).toEqual({ type: "cutAll" });
  });

  it("nudges selected keys a frame with Alt and the arrows, ten with Shift", () => {
    expect(videoExtraActionFor(stroke("ArrowRight", { altKey: true, shiftKey: true }))).toEqual({ type: "nudgeKeysOrJumpMarker", direction: 1, frames: 10 });
    expect(videoExtraActionFor(stroke("ArrowLeft", { altKey: true, shiftKey: true }))).toEqual({ type: "nudgeKeysOrJumpMarker", direction: -1, frames: 10 });
  });
});

describe("preview zoom shortcuts", () => {
  it("zooms the preview with the image editor keys, without a selection fit", () => {
    expect(previewZoomActionFor(stroke("=", { ctrlKey: true }))).toEqual({ type: "zoom", direction: 1 });
    expect(previewZoomActionFor(stroke("-", { ctrlKey: true }))).toEqual({ type: "zoom", direction: -1 });
    expect(previewZoomActionFor(stroke("0", { ctrlKey: true }))).toEqual({ type: "fit" });
    expect(previewZoomActionFor({ ...stroke("!", { shiftKey: true }), code: "Digit1" })).toEqual({ type: "fit" });
    expect(previewZoomActionFor({ ...stroke(")", { shiftKey: true }), code: "Digit0" })).toEqual({ type: "actualSize" });
    expect(previewZoomActionFor({ ...stroke("@", { shiftKey: true }), code: "Digit2" })).toBeNull();
    expect(previewZoomActionFor(stroke("="))).toBeNull();
  });
});
