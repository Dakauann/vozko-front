import { describe, expect, it, vi } from "vitest";

import { bindKeymap, canvasActionFor, capturesArrowKeys, imageActionFor, imageZoomActionFor, isEditableTarget, vectorModeAction, videoActionFor, type KeyStroke } from "./keymap";

function stroke(key: string, extra: Partial<KeyStroke> = {}): KeyStroke {
  return { key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...extra };
}

const ctrl = { ctrlKey: true };

describe("image keymap (Canva conventions)", () => {
  it.each([
    [stroke("z", ctrl), { type: "undo" }],
    [stroke("Z", { ...ctrl, shiftKey: true }), { type: "redo" }],
    [stroke("y", ctrl), { type: "redo" }],
    [stroke("z", { metaKey: true }), { type: "undo" }],
    [stroke("g", ctrl), { type: "group" }],
    [stroke("G", { ...ctrl, shiftKey: true }), { type: "ungroup" }],
    [stroke("d", ctrl), { type: "duplicate" }],
    [stroke("a", ctrl), { type: "selectAll" }],
    [stroke("]", { ...ctrl, code: "BracketRight" }), { type: "order", direction: "forward" }],
    [stroke("[", { ...ctrl, code: "BracketLeft" }), { type: "order", direction: "backward" }],
    [stroke("]", { ...ctrl, altKey: true, code: "BracketRight" }), { type: "order", direction: "front" }],
    [stroke("[", { ...ctrl, altKey: true, code: "BracketLeft" }), { type: "order", direction: "back" }],
    [stroke("ArrowLeft"), { type: "nudge", dx: -1, dy: 0 }],
    [stroke("ArrowDown", { shiftKey: true }), { type: "nudge", dx: 0, dy: 10 }],
    [stroke("Delete"), { type: "delete" }],
    [stroke("Backspace"), { type: "delete" }],
    [stroke("Escape"), { type: "deselect" }],
    [stroke("g", { ...ctrl, altKey: true }), { type: "scaffold" }],
    [stroke("L", { ...ctrl, shiftKey: true }), { type: "toggleLock" }],
    [stroke("H", { ...ctrl, shiftKey: true }), { type: "toggleHidden" }],
    [stroke("Enter"), { type: "selectChildren" }],
    [stroke("Enter", { shiftKey: true }), { type: "selectParent" }],
    [stroke("p"), { type: "tool", tool: "pen" }],
    [stroke("B", { shiftKey: true }), { type: "tool", tool: "draw" }],
    [stroke("v"), { type: "tool", tool: "select" }],
    [stroke("U", { altKey: true, shiftKey: true, code: "KeyU" }), { type: "shapeOp", kind: "union" }],
    [stroke("Í", { altKey: true, shiftKey: true, code: "KeyS" }), { type: "shapeOp", kind: "subtract" }],
    [stroke("I", { altKey: true, shiftKey: true, code: "KeyI" }), { type: "shapeOp", kind: "intersect" }],
    [stroke("E", { altKey: true, shiftKey: true, code: "KeyE" }), { type: "shapeOp", kind: "exclude" }],
    [stroke("e", { ...ctrl, code: "KeyE" }), { type: "shapeOp", kind: "flatten" }],
    [stroke("ø", { ...ctrl, altKey: true, code: "KeyO" }), { type: "shapeOp", kind: "outline" }],
    [stroke("n"), { type: "artboard", direction: 1 }],
    [stroke("N", { shiftKey: true }), { type: "artboard", direction: -1 }],
  ])("maps %o", (input, action) => {
    expect(imageActionFor(input)).toEqual(action);
  });

  it("leaves Enter to the focused button or menu item", () => {
    const button = document.createElement("button");
    const item = document.createElement("div");
    item.setAttribute("role", "menuitem");
    expect(canvasActionFor(stroke("Enter", { target: button }))).toBeNull();
    expect(canvasActionFor(stroke("Enter", { shiftKey: true, target: item }))).toBeNull();
    expect(canvasActionFor(stroke("Enter", { target: document.body }))).toEqual({ type: "selectChildren" });
  });

  it("ignores unbound keys", () => {
    expect(imageActionFor(stroke("q"))).toBeNull();
    expect(imageActionFor(stroke("s", ctrl))).toBeNull();
  });
});

describe("video keymap (editor conventions)", () => {
  it.each([
    [stroke(" "), { type: "togglePlay" }],
    [stroke("j"), { type: "shuttle", direction: -1 }],
    [stroke("K"), { type: "shuttle", direction: 0 }],
    [stroke("l"), { type: "shuttle", direction: 1 }],
    [stroke("ArrowLeft"), { type: "stepFrames", frames: -1 }],
    [stroke("ArrowRight"), { type: "stepFrames", frames: 1 }],
    [stroke("ArrowRight", { shiftKey: true }), { type: "stepMs", ms: 1000 }],
    [stroke("Home"), { type: "seekStart" }],
    [stroke("End"), { type: "seekEnd" }],
    [stroke("s"), { type: "split" }],
    [stroke("Delete"), { type: "delete" }],
    [stroke("Delete", { shiftKey: true }), { type: "rippleDelete" }],
    [stroke("d", ctrl), { type: "duplicate" }],
    [stroke("+", { shiftKey: true }), { type: "zoom", direction: 1 }],
    [stroke("="), { type: "zoom", direction: 1 }],
    [stroke("-"), { type: "zoom", direction: -1 }],
    [stroke("n"), { type: "toggleSnapping" }],
    [stroke("z", ctrl), { type: "undo" }],
    [stroke("z", { ...ctrl, shiftKey: true }), { type: "redo" }],
  ])("maps %o", (input, action) => {
    expect(videoActionFor(input)).toEqual(action);
  });

  it("does not split on Ctrl+S", () => {
    expect(videoActionFor(stroke("s", ctrl))).toBeNull();
  });
});

describe("typing is never a shortcut", () => {
  it("skips inputs, textareas and editable content", () => {
    const input = document.createElement("input");
    const area = document.createElement("textarea");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    const inner = document.createElement("span");
    editable.appendChild(inner);
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    expect(isEditableTarget(input)).toBe(true);
    expect(isEditableTarget(area)).toBe(true);
    expect(isEditableTarget(inner)).toBe(true);
    expect(isEditableTarget(checkbox)).toBe(false);
    const range = document.createElement("input");
    range.type = "range";
    const slider = document.createElement("div");
    slider.setAttribute("role", "slider");
    expect(capturesArrowKeys(range)).toBe(true);
    expect(videoActionFor(stroke("ArrowRight", { target: range }))).toBeNull();
    expect(videoActionFor(stroke("ArrowLeft", { target: slider }))).toBeNull();
    expect(videoActionFor(stroke("Delete", { target: range }))).toEqual({ type: "delete" });
    expect(imageActionFor(stroke("Delete", { target: input }))).toBeNull();
    expect(videoActionFor(stroke(" ", { target: area }))).toBeNull();
  });

  it("binds to keydown, prevents the default and unbinds", () => {
    const handle = vi.fn();
    const unbind = bindKeymap(window, videoActionFor, handle);
    const event = new KeyboardEvent("keydown", { key: "s", cancelable: true });
    window.dispatchEvent(event);
    expect(handle).toHaveBeenCalledWith({ type: "split" });
    expect(event.defaultPrevented).toBe(true);
    unbind();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "s" }));
    expect(handle).toHaveBeenCalledTimes(1);
  });
});

describe("image zoom keys", () => {
  it.each([
    [stroke("=", ctrl), { type: "zoom", direction: 1 }],
    [stroke("+", { ...ctrl, shiftKey: true }), { type: "zoom", direction: 1 }],
    [stroke("-", ctrl), { type: "zoom", direction: -1 }],
    [stroke("0", ctrl), { type: "fit" }],
    [stroke("!", { shiftKey: true, code: "Digit1" }), { type: "fit" }],
    [stroke("@", { shiftKey: true, code: "Digit2" }), { type: "fitSelection" }],
  ])("maps %o", (input, action) => {
    expect(imageZoomActionFor(input)).toEqual(action);
  });

  it("ignores plain keys and editable targets", () => {
    expect(imageZoomActionFor(stroke("="))).toBeNull();
    const input = document.createElement("input");
    expect(imageZoomActionFor(stroke("=", { ...ctrl, target: input }))).toBeNull();
  });
});

describe("canvasActionFor", () => {
  it("leaves arrow keys to sliders and menus but still nudges from plain buttons", () => {
    const slider = document.createElement("span");
    slider.setAttribute("role", "slider");
    const inMenu = document.createElement("div");
    inMenu.setAttribute("role", "menuitem");
    const inner = document.createElement("span");
    inMenu.appendChild(inner);
    const button = document.createElement("button");
    expect(canvasActionFor(stroke("ArrowLeft", { target: slider }))).toBeNull();
    expect(canvasActionFor(stroke("ArrowLeft", { target: inner }))).toBeNull();
    expect(canvasActionFor(stroke("ArrowLeft", { target: button }))).toEqual({ type: "nudge", dx: -1, dy: 0 });
    expect(canvasActionFor(stroke("Delete", { target: slider }))).toEqual({ type: "delete" });
  });

  it("lets Escape close an open popover instead of clearing the selection", () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    const field = document.createElement("button");
    dialog.appendChild(field);
    expect(canvasActionFor(stroke("Escape", { target: field }))).toBeNull();
    expect(canvasActionFor(stroke("Escape", { target: document.body }))).toEqual({ type: "deselect" });
  });
});

describe("vector mode", () => {
  it("keeps only history and tool switches while drawing or editing points", () => {
    expect(vectorModeAction({ type: "delete" })).toBeNull();
    expect(vectorModeAction({ type: "deselect" })).toBeNull();
    expect(vectorModeAction({ type: "nudge", dx: 1, dy: 0 })).toBeNull();
    expect(vectorModeAction({ type: "undo" })).toEqual({ type: "undo" });
    expect(vectorModeAction({ type: "tool", tool: "draw" })).toEqual({ type: "tool", tool: "draw" });
    expect(vectorModeAction(null)).toBeNull();
    expect(vectorModeAction({ type: "shapeOp", kind: "union" })).toBeNull();
    expect(imageActionFor(stroke("U", { altKey: true, code: "KeyU" }))).toBeNull();
  });
});
