import { describe, expect, it } from "vitest";

import { imagePlaceholderOf, toolStartAspect } from "./generating-image";

describe("toolStartAspect", () => {
  it("takes the aspect the user approved", () => {
    expect(toolStartAspect("generate_image", { id: "a", toolName: "generate_image", args: { prompt: "x", aspect: "story" } })).toBe("story");
  });

  it("reads the approval card when the arguments were not kept after a reload", () => {
    const stored = { id: "a", toolName: "generate_image", fields: [{ key: "image", value: "x" }, { key: "format", value: "portrait" }] };
    expect(toolStartAspect("generate_image", stored)).toBe("portrait");
  });

  it("falls back to a square for an image without a known aspect", () => {
    expect(toolStartAspect("generate_image")).toBe("square");
    expect(toolStartAspect("generate_image", { id: "a", toolName: "generate_image", args: { aspect: "panorama" } })).toBe("square");
  });

  it("gives other tools no image at all", () => {
    expect(toolStartAspect("create_ad", { id: "a", toolName: "create_ad", args: { aspect: "story" } })).toBeUndefined();
  });
});

describe("imagePlaceholderOf", () => {
  const image = { kind: "tool" as const, name: "generate_image", summary: "", ok: true, aspect: "portrait" as const };

  it("stands in for the image while it is generated", () => {
    expect(imagePlaceholderOf({ ...image, running: true })).toEqual({ aspect: "portrait", failed: false });
  });

  it("turns into the failure when the generation fails", () => {
    expect(imagePlaceholderOf({ ...image, summary: "error", ok: false })).toEqual({ aspect: "portrait", failed: true });
  });

  it("gives way to the image once it arrives", () => {
    expect(imagePlaceholderOf({ ...image, summary: "ok" })).toBeNull();
  });

  it("never draws a frame for an image that was not generated here", () => {
    expect(imagePlaceholderOf({ kind: "tool", name: "generate_image", summary: "error", ok: false })).toBeNull();
    expect(imagePlaceholderOf({ kind: "tool", name: "calculate", summary: "", ok: true, running: true, aspect: "square" })).toBeNull();
  });
});
