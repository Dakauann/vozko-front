import { describe, expect, it } from "vitest";

import { imageActionFor } from "./keymap";

const press = (key: string, code: string) => ({ key, code, ctrlKey: true, metaKey: false, shiftKey: false, altKey: true });

describe("component shortcuts", () => {
  it("create a component with Ctrl+Alt+K and detach an instance with Ctrl+Alt+B", () => {
    expect(imageActionFor(press("k", "KeyK"))).toEqual({ type: "component" });
    expect(imageActionFor(press("˚", "KeyK"))).toEqual({ type: "component" });
    expect(imageActionFor(press("b", "KeyB"))).toEqual({ type: "detach" });
    expect(imageActionFor({ ...press("k", "KeyK"), shiftKey: true })).toBeNull();
  });
});

describe("auto layout shortcut", () => {
  it("adds an auto layout with Shift+A and leaves Ctrl+A to select all", () => {
    expect(imageActionFor({ key: "A", code: "KeyA", ctrlKey: false, metaKey: false, shiftKey: true, altKey: false })).toEqual({ type: "autoLayout" });
    expect(imageActionFor({ key: "a", code: "KeyA", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false })).toEqual({ type: "selectAll" });
  });
});
