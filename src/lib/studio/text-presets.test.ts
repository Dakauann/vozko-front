import { describe, expect, it } from "vitest";

import { emptyVideoDocument } from "./document";
import { placeStack } from "./edits";
import { TEXT_STYLE_PRESETS, textPresetClips } from "./text-presets";
import { documentIssue } from "./validate";

describe("text presets", () => {
  it.each(TEXT_STYLE_PRESETS)("%s builds overlays the backend accepts", (preset) => {
    const clips = textPresetClips(preset, "Compre agora", 1000);
    const placed = placeStack(emptyVideoDocument("story"), clips);
    expect(placed).not.toBeNull();
    expect(documentIssue("video", placed!.document)).toBeNull();
    expect(clips.every((c) => c.startMs === 1000 && c.type === "overlay")).toBe(true);
    expect(clips.at(-1)?.layer?.text).toBe("Compre agora");
  });

  it("links the plate and the text of a two piece preset", () => {
    const [bar, label] = textPresetClips("cta", "Fale conosco", 0);
    expect(bar.layer?.type).toBe("shape");
    expect(bar.linkId).toBeTruthy();
    expect(label.linkId).toBe(bar.linkId);
  });
});
