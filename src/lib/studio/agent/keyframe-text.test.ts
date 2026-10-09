import { describe, expect, it } from "vitest";

import { keyframeFaultText, keyOutsideClipText } from "./keyframe-text";

describe("keyframeFaultText", () => {
  it("names the property, the instant, the value and the allowed range", () => {
    const text = keyframeFaultText({ kind: "value", property: "scale", atMs: 500, value: 0, range: [0.05, 5] });
    expect(text).toContain("scale em 500 ms vale 0");
    expect(text).toContain("de 0.05 a 5");
    expect(text).toContain("1 é o tamanho atual");
  });

  it("tells the largest scale that fits the clip", () => {
    expect(keyframeFaultText({ kind: "box", scale: 4.6, maxScale: 4.44 })).toContain("scale até 4.44");
  });

  it("lists the easings for an unknown one", () => {
    expect(keyframeFaultText({ kind: "easing", property: "y", atMs: 0, easing: "wiggle" })).toContain("linear, hold, easeIn, easeOut, easeInOut, backIn, backOut, backInOut, elastic, bounce, spring");
  });

  it("asks for distinct instants when two keys collide", () => {
    expect(keyframeFaultText({ kind: "order", property: "x", atMs: 400 })).toContain("400 ms");
  });

  it("never writes a long dash", () => {
    const faults = [
      keyframeFaultText({ kind: "empty" }),
      keyframeFaultText({ kind: "too_many", property: "x", limit: 32 }),
      keyframeFaultText({ kind: "time", property: "x", atMs: 90_001, limit: 90_000 }),
      keyOutsideClipText("opacity", 5200, 3000),
    ];
    for (const text of faults) expect(text).not.toMatch(/[–—]/);
  });
});

describe("keyOutsideClipText", () => {
  it("explains that at_ms counts from the clip start", () => {
    const text = keyOutsideClipText("opacity", 5200, 3000);
    expect(text).toContain("5200 ms");
    expect(text).toContain("de 0 a 3000 ms");
    expect(text).toContain("início do clipe");
  });
});
