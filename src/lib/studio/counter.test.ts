import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newOverlayClip, newShapeLayer, newTextLayer, type Clip, type VideoDocument } from "./document";
import {
  counterCells,
  counterIssue,
  counterLocaleFor,
  startCounterPatch,
  counterPatch,
  counterPresetClip,
  counterRange,
  counterText,
  counterTokens,
  counterValueAt,
  countPatch,
  formatCounterNumber,
  newCounter,
  shownText,
  type Counter,
} from "./counter";
import { COUNTER_RANGE } from "./text-properties";
import { documentIssue } from "./validate";

function textClip(patch: Partial<Clip> = {}): Clip {
  return { ...newOverlayClip({ ...newTextLayer("0"), id: "l-count" }, 0, 3000), id: "c-count", ...patch };
}

function film(clip: Clip): VideoDocument {
  const doc = emptyVideoDocument("story");
  doc.durationMs = 3000;
  doc.tracks = [{ id: "t-1", kind: "visual", clips: [clip] }];
  return doc;
}

const reais: Counter = { value: 1234567.891, decimals: 2, locale: "pt-BR", grouping: true, prefix: "R$ ", suffix: " mil" };

describe("counter text", () => {
  it("groups thousands and marks decimals by locale", () => {
    expect(formatCounterNumber(1234567.891, 2, "pt-BR", true)).toBe("1.234.567,89");
    expect(formatCounterNumber(1234567.891, 2, "en-US", true)).toBe("1,234,567.89");
    expect(formatCounterNumber(1234567.891, 2, "de-DE", true)).toBe("1.234.567,89");
    expect(formatCounterNumber(1234567.891, 1, "es-ES", false)).toBe("1234567,9");
    expect(formatCounterNumber(999, 0, "pt-BR", true)).toBe("999");
    expect(formatCounterNumber(1000, 0, "pt-BR", true)).toBe("1.000");
  });

  it("rounds half away from zero and never shows a negative zero", () => {
    expect(formatCounterNumber(2.5, 0, "en-US", true)).toBe("3");
    expect(formatCounterNumber(-2.5, 0, "en-US", true)).toBe("-3");
    expect(formatCounterNumber(-0.4, 0, "pt-BR", true)).toBe("0");
    expect(formatCounterNumber(-1500, 0, "pt-BR", true)).toBe("-1.500");
    expect(formatCounterNumber(0.05, 3, "en-US", true)).toBe("0.050");
  });

  it("writes the prefix and the suffix around the number", () => {
    expect(counterText(reais, reais.value)).toBe("R$ 1.234.567,89 mil");
    expect(counterText(newCounter("en-US"), 42)).toBe("42");
  });
});

describe("counter value over time", () => {
  it("shows the static value when nothing is keyed", () => {
    expect(counterValueAt(textClip({ counter: { ...newCounter("pt-BR"), value: 7 } }), 1500)).toBe(7);
  });

  it("follows the counter keys with their easing", () => {
    const clip = textClip({ counter: newCounter("pt-BR"), keyframes: { counter: [{ atMs: 0, value: 0, easing: "linear" }, { atMs: 1000, value: 1000, easing: "linear" }] } });
    expect(counterValueAt(clip, 0)).toBe(0);
    expect(counterValueAt(clip, 500)).toBe(500);
    expect(counterValueAt(clip, 2000)).toBe(1000);
  });

  it("counts from one value to another with two keys", () => {
    const clip = textClip({ counter: newCounter("pt-BR") });
    const counted = { ...clip, ...countPatch(clip, { from: 0, to: 10_000, startMs: 200, durationMs: 1000, easing: "easeOut" }) };
    expect(counted.keyframes?.counter).toEqual([
      { atMs: 200, value: 0, easing: "easeOut" },
      { atMs: 1200, value: 10_000, easing: "linear" },
    ]);
    expect(counterRange(counted)).toEqual({ from: 0, to: 10_000, startMs: 200, durationMs: 1000, easing: "easeOut" });
    expect(counterText(counted.counter!, counterValueAt(counted, 1200))).toBe("10.000");
  });

  it("holds a single value when the count has no length", () => {
    const clip = textClip({ counter: newCounter("pt-BR"), keyframes: { counter: [{ atMs: 0, value: 0, easing: "linear" }, { atMs: 900, value: 5, easing: "linear" }] } });
    const held = { ...clip, ...countPatch(clip, { from: 3, to: 3, startMs: 0, durationMs: 1000, easing: "linear" }) };
    expect(held.keyframes).toBeUndefined();
    expect(held.counter?.value).toBe(3);
  });
});

describe("counter glyphs", () => {
  it("lists every glyph the counter can draw once", () => {
    const cells = counterCells(reais);
    expect(cells.slice(0, 10)).toEqual(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
    expect(cells).toContain(".");
    expect(cells).toContain(",");
    expect(cells).toContain("-");
    expect(cells).toContain("R$ ");
    expect(cells).toContain(" mil");
    expect(new Set(cells).size).toBe(cells.length);
  });

  it("leaves out separators the counter never shows", () => {
    const cells = counterCells({ value: 0, decimals: 0, locale: "en-US", grouping: false });
    expect(cells).not.toContain(",");
    expect(cells).not.toContain(".");
  });

  it("spells the shown text as cells, digits marked", () => {
    const cells = counterCells(reais);
    const tokens = counterTokens(reais, 1500.5);
    expect(tokens.map((token) => cells[token.cell]).join("")).toBe("R$ 1.500,50 mil");
    expect(tokens.filter((token) => token.digit).length).toBe(6);
  });
});

describe("counter rules", () => {
  it("accepts a counter on a text overlay and the document passes", () => {
    const clip = { ...textClip({ counter: reais }), ...countPatch(textClip({ counter: reais }), { from: 0, to: 500, startMs: 0, durationMs: 1000, easing: "easeInOut" }) };
    expect(counterIssue(clip)).toBeNull();
    expect(documentIssue("video", film(clip))).toBeNull();
  });

  it("refuses a counter on anything but text", () => {
    const shape = { ...newOverlayClip(newShapeLayer("rect"), 0, 3000), id: "c-shape", counter: newCounter("pt-BR") };
    expect(counterIssue(shape)).toBe("invalid");
    expect(documentIssue("video", film(shape))).not.toBeNull();
  });

  it("checks every field", () => {
    expect(counterIssue(textClip({ counter: { ...reais, decimals: 4 } }))).toBe("out_of_range");
    expect(counterIssue(textClip({ counter: { ...reais, decimals: 1.5 } }))).toBe("invalid");
    expect(counterIssue(textClip({ counter: { ...reais, value: COUNTER_RANGE[1] * 2 } }))).toBe("out_of_range");
    expect(counterIssue(textClip({ counter: { ...reais, locale: "fr-FR" as Counter["locale"] } }))).toBe("unknown");
    expect(counterIssue(textClip({ counter: { ...reais, prefix: "x".repeat(17) } }))).toBe("too_large");
    expect(counterIssue(textClip({ counter: { ...reais, suffix: "a\nb" } }))).toBe("invalid");
  });

  it("refuses counter keys without a counter", () => {
    const clip = textClip({ keyframes: { counter: [{ atMs: 0, value: 1, easing: "linear" }] } });
    expect(counterIssue(clip)).toBe("invalid");
    expect(documentIssue("video", film(clip))).not.toBeNull();
  });

  it("turns the counter off together with its keys", () => {
    const clip = textClip({ counter: newCounter("pt-BR"), keyframes: { counter: [{ atMs: 0, value: 1, easing: "linear" }], opacity: [{ atMs: 0, value: 1, easing: "linear" }] } });
    expect(counterPatch(clip, null)).toEqual({ counter: undefined, keyframes: { opacity: [{ atMs: 0, value: 1, easing: "linear" }] } });
  });
});

describe("counter preset", () => {
  it("inserts a text overlay that counts and passes the rules", () => {
    const clip = counterPresetClip("pt-BR", 500);
    expect(clip.startMs).toBe(500);
    expect(clip.layer?.type).toBe("text");
    expect(counterIssue(clip)).toBeNull();
    expect(counterRange(clip)?.to).toBeGreaterThan(0);
    expect(shownText(clip)).toBe(counterText(clip.counter!, counterRange(clip)!.to));
  });

  it("starts a counter in the locale of the app", () => {
    expect(counterLocaleFor("de")).toBe("de-DE");
    expect(counterLocaleFor("en-GB")).toBe("en-US");
    expect(counterLocaleFor("es-ES")).toBe("es-ES");
    expect(counterLocaleFor("ja")).toBe("pt-BR");
    const clip = textClip();
    const started = { ...clip, ...startCounterPatch(clip, "en-US") };
    expect(started.counter?.locale).toBe("en-US");
    expect(counterRange(started)).toMatchObject({ from: 0, startMs: 0 });
    expect(counterIssue(started)).toBeNull();
  });

  it("shows the layer text when there is no counter", () => {
    expect(shownText(textClip())).toBe("0");
  });
});

describe("text motion contract", () => {
  it("accepts the same counter and text path document the backend contract test reads", () => {
    const raw = JSON.parse(readFileSync(resolve(__dirname, "../../../../vozko-back/domain/studio/testdata/editor_text_motion.json"), "utf8"));
    expect(documentIssue("video", raw)).toBeNull();
    const money = (raw as VideoDocument).tracks[0].clips[0];
    expect(counterText(money.counter!, counterValueAt(money, 2000))).toBe("R$ 12.500,5 mil");
  });
});
