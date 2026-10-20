import { describe, expect, it, vi } from "vitest";

import {
  activatesOnEnter,
  bindKeymap,
  capturesArrowKeys,
  closestOverlay,
  hasCommandModifier,
  isEditableTarget,
  isInsideOverlay,
  strokeKey,
  type KeyStroke,
} from "./stroke";

function stroke(key: string, extra: Partial<KeyStroke> = {}): KeyStroke {
  return { key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...extra };
}

describe("editable targets swallow every shortcut", () => {
  it("treats text inputs, textareas, selects and editable content as typing", () => {
    const input = document.createElement("input");
    const area = document.createElement("textarea");
    const select = document.createElement("select");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    const inner = document.createElement("span");
    editable.appendChild(inner);
    expect(isEditableTarget(input)).toBe(true);
    expect(isEditableTarget(area)).toBe(true);
    expect(isEditableTarget(select)).toBe(true);
    expect(isEditableTarget(inner)).toBe(true);
  });

  it("leaves checkboxes, buttons and the page itself to the shortcuts", () => {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    expect(isEditableTarget(checkbox)).toBe(false);
    expect(isEditableTarget(document.createElement("button"))).toBe(false);
    expect(isEditableTarget(document.body)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe("elements that own a key keep it", () => {
  it("lets sliders, menus and listboxes keep the arrow keys", () => {
    const range = document.createElement("input");
    range.type = "range";
    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    const item = document.createElement("div");
    menu.appendChild(item);
    expect(capturesArrowKeys(range)).toBe(true);
    expect(capturesArrowKeys(item)).toBe(true);
    expect(capturesArrowKeys(document.body)).toBe(false);
  });

  it("lets buttons and links keep Enter", () => {
    const link = document.createElement("a");
    link.href = "#";
    expect(activatesOnEnter(document.createElement("button"))).toBe(true);
    expect(activatesOnEnter(link)).toBe(true);
    expect(activatesOnEnter(document.createElement("div"))).toBe(false);
  });

  it("knows when focus sits inside a dialog or a menu", () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    const button = document.createElement("button");
    dialog.appendChild(button);
    expect(isInsideOverlay(button)).toBe(true);
    expect(isInsideOverlay(document.body)).toBe(false);
    expect(closestOverlay(button)).toBe(dialog);
    expect(closestOverlay(document.body)).toBeNull();
  });
});

describe("stroke reading", () => {
  it("treats Ctrl and Cmd alike for the studio's command modifier", () => {
    expect(hasCommandModifier(stroke("z", { ctrlKey: true }))).toBe(true);
    expect(hasCommandModifier(stroke("z", { metaKey: true }))).toBe(true);
    expect(hasCommandModifier(stroke("z"))).toBe(false);
  });

  it("lowercases printable keys so caps lock does not change the meaning", () => {
    expect(strokeKey(stroke("J"))).toBe("j");
    expect(strokeKey(stroke("ArrowDown"))).toBe("ArrowDown");
  });
});

describe("binding a keymap", () => {
  it("handles a resolved stroke, prevents the default and unbinds", () => {
    const handle = vi.fn();
    const unbind = bindKeymap(window, (s) => (s.key === "s" ? "split" : null), handle);
    const event = new KeyboardEvent("keydown", { key: "s", cancelable: true });
    window.dispatchEvent(event);
    expect(handle).toHaveBeenCalledWith("split");
    expect(event.defaultPrevented).toBe(true);
    unbind();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "s" }));
    expect(handle).toHaveBeenCalledTimes(1);
  });

  it("ignores strokes another handler already claimed", () => {
    const handle = vi.fn();
    const unbind = bindKeymap(window, () => "any", handle);
    const event = new KeyboardEvent("keydown", { key: "s", cancelable: true });
    event.preventDefault();
    window.dispatchEvent(event);
    expect(handle).not.toHaveBeenCalled();
    unbind();
  });
});
