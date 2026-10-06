import { describe, expect, it } from "vitest";

import { mediaPlaceholderOf, toolStartFrame } from "./generating-media";

describe("toolStartFrame", () => {
  it("takes the aspect the user approved", () => {
    expect(toolStartFrame("generate_image", { id: "a", toolName: "generate_image", args: { prompt: "x", aspect: "story" } })).toBe("story");
  });

  it("reads the approval card when the arguments were not kept after a reload", () => {
    const stored = { id: "a", toolName: "generate_image", fields: [{ key: "image", value: "x" }, { key: "format", value: "portrait" }] };
    expect(toolStartFrame("generate_image", stored)).toBe("portrait");
  });

  it("falls back to a square for an image without a known aspect", () => {
    expect(toolStartFrame("generate_image")).toBe("square");
    expect(toolStartFrame("generate_image", { id: "a", toolName: "generate_image", args: { aspect: "panorama" } })).toBe("square");
  });

  it("frames a video in the aspect the user approved", () => {
    expect(toolStartFrame("render_video", { id: "a", toolName: "render_video", args: { aspect: "story", scenes: [] } })).toBe("story");
  });

  it("frames music and voice-overs as audio", () => {
    expect(toolStartFrame("generate_music", { id: "a", toolName: "generate_music", args: { prompt: "samba" } })).toBe("audio");
    expect(toolStartFrame("generate_voiceover")).toBe("audio");
  });

  it("gives other tools no media at all", () => {
    expect(toolStartFrame("create_ad", { id: "a", toolName: "create_ad", args: { aspect: "story" } })).toBeUndefined();
  });
});

describe("mediaPlaceholderOf", () => {
  const image = { kind: "tool" as const, name: "generate_image", summary: "", ok: true, frame: "portrait" as const };

  it("stands in for the image while it is generated", () => {
    expect(mediaPlaceholderOf({ ...image, running: true })).toEqual({ kind: "image", frame: "portrait", failed: false });
  });

  it("turns into the failure when the generation fails", () => {
    expect(mediaPlaceholderOf({ ...image, summary: "error", ok: false })).toEqual({ kind: "image", frame: "portrait", failed: true });
  });

  it("gives way to the media once it arrives", () => {
    expect(mediaPlaceholderOf({ ...image, summary: "ok" })).toBeNull();
  });

  it("names what each tool makes", () => {
    expect(mediaPlaceholderOf({ kind: "tool", name: "generate_music", summary: "", ok: true, running: true, frame: "audio" })).toEqual({
      kind: "music",
      frame: "audio",
      failed: false,
    });
    expect(mediaPlaceholderOf({ kind: "tool", name: "generate_voiceover", summary: "", ok: true, running: true, frame: "audio" })?.kind).toBe("voice");
    expect(mediaPlaceholderOf({ kind: "tool", name: "render_video", summary: "", ok: true, running: true, frame: "square" })?.kind).toBe("video");
  });

  it("never draws a frame for media that was not generated here", () => {
    expect(mediaPlaceholderOf({ kind: "tool", name: "generate_image", summary: "error", ok: false })).toBeNull();
    expect(mediaPlaceholderOf({ kind: "tool", name: "calculate", summary: "", ok: true, running: true, frame: "square" })).toBeNull();
  });
});
