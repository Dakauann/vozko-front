import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { newTextLayer, type Clip, type ImageDocument, type Layer, type VideoDocument } from "./document";
import {
  baseRunStyle,
  clipRunText,
  collapsedSpans,
  COUNTER_SLOT,
  counterRunStyles,
  drawnText,
  findTextRanges,
  hasRuns,
  rangeValue,
  retextClipPatch,
  retextLayerPatch,
  retextRuns,
  styleAt,
  styleRuns,
  textSpans,
  textRunsIssue,
  textStylePatch,
  withoutRunKeys,
  type TextRun,
} from "./text-runs";
import { documentIssue } from "./validate";

function layer(text: string, extra: Partial<Layer> = {}): Layer {
  return { ...newTextLayer(text), fill: "#111111", fontId: "inter", fontWeight: 400, fontSize: 0.05, ...extra };
}

describe("text runs", () => {
  it("styles a range and keeps the runs sorted, merged and free of values equal to the layer", () => {
    const base = baseRunStyle(layer("Compre agora"));
    const bold = styleRuns([], 12, base, { start: 0, end: 6 }, { fontWeight: 800, fill: "#FFCC00" });
    expect(bold).toEqual([{ start: 0, end: 6, fontWeight: 800, fill: "#FFCC00" }]);
    const extended = styleRuns(bold, 12, base, { start: 6, end: 12 }, { fontWeight: 800, fill: "#ffcc00" });
    expect(extended).toEqual([{ start: 0, end: 12, fontWeight: 800, fill: "#FFCC00" }]);
    const back = styleRuns(extended, 12, base, { start: 3, end: 12 }, { fontWeight: 400 });
    expect(back).toEqual([
      { start: 0, end: 3, fontWeight: 800, fill: "#FFCC00" },
      { start: 3, end: 12, fill: "#FFCC00" },
    ]);
    expect(styleRuns(back, 12, base, { start: 3, end: 12 }, { fill: null })).toEqual([{ start: 0, end: 3, fontWeight: 800, fill: "#FFCC00" }]);
  });

  it("drops flags that are off and keeps a flag that turns off a layer value", () => {
    const base = baseRunStyle(layer("abc", { italic: true }));
    expect(styleRuns([], 3, base, { start: 0, end: 2 }, { underline: false, caps: true, italic: false })).toEqual([{ start: 0, end: 2, caps: true, italic: false }]);
    expect(styleRuns([], 3, base, { start: 0, end: 2 }, { italic: true, underline: false })).toEqual([]);
  });

  it("writes the layer itself when the whole text is styled and strips that value from the runs", () => {
    const styled = layer("Oferta hoje", { runs: [{ start: 0, end: 6, fontWeight: 800, fill: "#ff0000" }] });
    expect(textStylePatch(styled, null, { fontWeight: 300 })).toEqual({ fontWeight: 300, runs: [{ start: 0, end: 6, fill: "#ff0000" }] });
    expect(textStylePatch(styled, { start: 0, end: 11 }, { fill: "#00ff00" })).toEqual({ fill: "#00ff00", runs: [{ start: 0, end: 6, fontWeight: 800 }] });
    expect(textStylePatch(styled, null, { underline: true })).toEqual({ runs: [
      { start: 0, end: 6, fontWeight: 800, fill: "#ff0000", underline: true },
      { start: 6, end: 11, underline: true },
    ] });
  });

  it("drops the gradient when the whole text takes a solid color", () => {
    const graded = layer("abc", { gradient: { from: "#000000", to: "#ffffff", angle: 0 } });
    expect(textStylePatch(graded, null, { fill: "#123456" })).toEqual({ fill: "#123456", gradient: undefined, runs: undefined });
  });

  it("styles part of the text through runs only", () => {
    const plain = layer("Oferta hoje");
    expect(textStylePatch(plain, { start: 7, end: 11 }, { caps: true, letterSpacing: 0.1 })).toEqual({ runs: [{ start: 7, end: 11, caps: true, letterSpacing: 0.1 }] });
  });

  it("follows edits of the text: typed letters take the style before them and replacements the style they replace", () => {
    const runs: TextRun[] = [{ start: 7, end: 11, fontWeight: 800 }];
    const base = baseRunStyle(layer("Oferta hoje"));
    expect(retextRuns(runs, "Oferta hoje", "Oferta hoje!", base)).toEqual([{ start: 7, end: 12, fontWeight: 800 }]);
    expect(retextRuns(runs, "Oferta hoje", "Oferta já", base)).toEqual([{ start: 7, end: 9, fontWeight: 800 }]);
    expect(retextRuns(runs, "Oferta hoje", "Oferta, hoje", base)).toEqual([{ start: 8, end: 12, fontWeight: 800 }]);
    expect(retextRuns(runs, "Oferta hoje", "Oferta hojeee", base)).toEqual([{ start: 7, end: 13, fontWeight: 800 }]);
    expect(retextRuns(runs, "Oferta hoje", "Grande oferta hoje", base)).toEqual([{ start: 14, end: 18, fontWeight: 800 }]);
    expect(retextRuns(runs, "Oferta hoje", "Oferta je", base)).toEqual([{ start: 7, end: 9, fontWeight: 800 }]);
    expect(retextRuns([{ start: 0, end: 2, fill: "#ff0000" }], "ab cd", "xyz", base)).toEqual([{ start: 0, end: 3, fill: "#ff0000" }]);
    expect(retextRuns(runs, "Oferta hoje", "", base)).toEqual([]);
  });

  it("counts code points, so emoji and accents keep their indexes", () => {
    const text = "Ação 🎉 já";
    expect([...text].length).toBe(9);
    expect(findTextRanges(text, "já", false)).toEqual([{ start: 7, end: 9 }]);
    expect(textSpans(layer(text, { runs: [{ start: 5, end: 6, fontSize: 0.08 }] })).map((span) => span.text)).toEqual(["Ação ", "🎉", " já"]);
  });

  it("finds text exactly first, then ignoring case, and every match on request", () => {
    expect(findTextRanges("Sale sale SALE", "sale", false)).toEqual([{ start: 5, end: 9 }]);
    expect(findTextRanges("Sale sale SALE", "sale", true)).toEqual([{ start: 5, end: 9 }]);
    expect(findTextRanges("Sale sale SALE", "SAle", true)).toEqual([
      { start: 0, end: 4 },
      { start: 5, end: 9 },
      { start: 10, end: 14 },
    ]);
    expect(findTextRanges("abc", "zz", false)).toEqual([]);
    expect(findTextRanges("abc", "", false)).toEqual([]);
  });

  it("reads the value of a range or says it is mixed", () => {
    const styled = layer("Oferta hoje", { runs: [{ start: 0, end: 6, fontWeight: 800 }] });
    expect(rangeValue(styled, { start: 0, end: 6 }, "fontWeight")).toEqual({ mixed: false, value: 800 });
    expect(rangeValue(styled, { start: 7, end: 11 }, "fontWeight")).toEqual({ mixed: false, value: 400 });
    expect(rangeValue(styled, null, "fontWeight")).toEqual({ mixed: true });
    expect(rangeValue(styled, { start: 3, end: 3 }, "fontWeight")).toEqual({ mixed: false, value: 800 });
    expect(rangeValue(styled, null, "underline")).toEqual({ mixed: false, value: false });
    expect(styleAt(styled, 2).fontWeight).toBe(800);
  });

  it("splits text into styled spans and draws caps per letter", () => {
    const spans = textSpans(layer("ab cd", { runs: [{ start: 3, end: 5, caps: true, fill: "#ff0000" }] }));
    expect(spans.map((span) => [span.start, span.end, span.text, span.style.caps, span.style.fill])).toEqual([
      [0, 3, "ab ", false, "#111111"],
      [3, 5, "cd", true, "#ff0000"],
    ]);
    expect(drawnText("straße", spans[1].style)).toBe("STRASSE");
    expect(drawnText("abc", spans[0].style)).toBe("abc");
  });

  it("collapses white space like the one line text and keeps the style of the first blank", () => {
    const spans = collapsedSpans(layer("ab  \n cd", { runs: [{ start: 2, end: 3, fill: "#ff0000" }, { start: 6, end: 8, fontWeight: 700 }] }));
    expect(spans.map((span) => [span.text, span.style.fill, span.style.fontWeight])).toEqual([
      ["ab", "#111111", 400],
      [" ", "#ff0000", 400],
      ["cd", "#111111", 700],
    ]);
  });

  it("refuses runs that overlap, leave the text, carry no style or carry a bad value", () => {
    const text = layer("abcdef");
    const issue = (runs: TextRun[], length = 6) => textRunsIssue({ ...text, runs }, length);
    expect(issue([])).toBeNull();
    expect(issue([{ start: 0, end: 2, fill: "#ff0000" }, { start: 2, end: 6, underline: true }])).toBeNull();
    expect(issue([{ start: 0, end: 3, fill: "#ff0000" }, { start: 2, end: 6, caps: true }])).toBe("invalid");
    expect(issue([{ start: 2, end: 6, caps: true }, { start: 0, end: 1, caps: true }])).toBe("invalid");
    expect(issue([{ start: 0, end: 7, caps: true }])).toBe("invalid");
    expect(issue([{ start: 3, end: 3, caps: true }])).toBe("invalid");
    expect(issue([{ start: 0.5, end: 2, caps: true }])).toBe("invalid");
    expect(issue([{ start: 0, end: 2 }])).toBe("invalid");
    expect(issue([{ start: 0, end: 2, underline: false }])).toBe("invalid");
    expect(issue([{ start: 0, end: 2, fill: "red" }])).toBe("invalid");
    expect(issue([{ start: 0, end: 2, fontId: "comic" as never }])).toBe("unknown");
    expect(issue([{ start: 0, end: 2, fontWeight: 450 }])).toBe("out_of_range");
    expect(issue([{ start: 0, end: 2, fontSize: 0.9 }])).toBe("out_of_range");
    expect(issue([{ start: 0, end: 2, letterSpacing: 3 }])).toBe("out_of_range");
    expect(issue([{ start: 0, end: 2, italic: false }])).toBeNull();
    expect(textRunsIssue({ ...text, type: "shape", runs: [{ start: 0, end: 2, caps: true }] }, 6)).toBe("invalid");
  });

  it("keeps runs in step when a patch rewrites the text of a layer", () => {
    const styled = layer("Oferta hoje", { runs: [{ start: 7, end: 11, fontWeight: 800 }] });
    expect(retextLayerPatch(styled, { text: "Super oferta hoje" })).toEqual({ text: "Super oferta hoje", runs: [{ start: 13, end: 17, fontWeight: 800 }] });
    expect(retextLayerPatch(styled, { text: "Oferta hoje", fill: "#000000" })).toEqual({ text: "Oferta hoje", fill: "#000000" });
    expect(retextLayerPatch(styled, { text: "x", runs: [{ start: 0, end: 1, caps: true }] })).toEqual({ text: "x", runs: [{ start: 0, end: 1, caps: true }] });
    expect(retextLayerPatch(layer("abc"), { text: "abcd" })).toEqual({ text: "abcd" });
    expect(hasRuns(styled)).toBe(true);
    expect(hasRuns(layer("abc", { runs: [] }))).toBe(false);
  });

  it("indexes a counter by its prefix, one slot for the number and its suffix", () => {
    const clip = {
      type: "overlay",
      layer: layer("10.000", { runs: [{ start: 0, end: 2, fill: "#ffcc00" }, { start: 3, end: 4, fontWeight: 800 }, { start: 4, end: 5, fontSize: 0.03 }] }),
      counter: { value: 0, decimals: 0, locale: "pt-BR", grouping: true, prefix: "R$ ", suffix: "%" },
    } as unknown as Clip;
    expect(clipRunText(clip)).toBe(`R$ ${COUNTER_SLOT}%`);
    const styles = counterRunStyles(clip.layer!, clip.counter!);
    expect(styles.prefix.map((style) => style.fill)).toEqual(["#ffcc00", "#ffcc00", "#111111"]);
    expect(styles.number.fontWeight).toBe(800);
    expect(styles.suffix.map((style) => style.fontSize)).toEqual([0.03]);
  });

  it("keeps clip runs valid when the text, the counter affixes or the counter itself change", () => {
    const styled = layer("Oferta hoje", { runs: [{ start: 7, end: 11, fontWeight: 800 }] });
    const clip = { type: "overlay", layer: styled } as unknown as Clip;
    expect(retextClipPatch(clip, { layer: { ...styled, text: "Oferta já" } }).layer?.runs).toEqual([{ start: 7, end: 9, fontWeight: 800 }]);
    const counter = { value: 0, decimals: 0, locale: "pt-BR" as const, grouping: true, prefix: "R$" };
    const counted = { type: "overlay", layer: { ...styled, runs: [{ start: 0, end: 2, fill: "#ff0000" }] }, counter } as unknown as Clip;
    expect(retextClipPatch(counted, { counter: { ...counter, prefix: "US$" } }).layer?.runs).toEqual([{ start: 0, end: 3, fill: "#ff0000" }]);
    expect(retextClipPatch(counted, { counter: { ...counter, value: 50 } })).toEqual({ counter: { ...counter, value: 50 } });
    expect(retextClipPatch(counted, { counter: undefined }).layer?.runs).toBeUndefined();
    expect(retextClipPatch(clip, { counter }).layer?.runs).toBeUndefined();
    expect(retextClipPatch(clip, { volume: 1 })).toEqual({ volume: 1 });
  });

  it("removes chosen fields from every run", () => {
    const styled = layer("abcdef", { runs: [{ start: 0, end: 2, fontWeight: 800, fill: "#ff0000" }, { start: 2, end: 4, fontId: "oswald" }] });
    expect(withoutRunKeys(styled, ["fontWeight", "fontId"])).toEqual([{ start: 0, end: 2, fill: "#ff0000" }]);
  });
});

function fixture<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(__dirname, `../../../../vozko-back/domain/studio/testdata/${name}`), "utf8")) as T;
}

describe("text runs contract", () => {
  it("accepts the same video and image documents the backend contract test reads", () => {
    expect(documentIssue("video", fixture("editor_text_runs.json"))).toBeNull();
    expect(documentIssue("image", fixture("editor_text_runs_image.json"))).toBeNull();
  });

  it("refuses the same broken runs the backend refuses", () => {
    const video = fixture<VideoDocument>("editor_text_runs.json");
    const money = video.tracks[1].clips[0];
    const past = structuredClone(video);
    past.tracks[1].clips[0].layer!.runs![2].end = 9;
    expect(documentIssue("video", past)?.code).toBe("invalid");
    const uncounted = structuredClone(video);
    delete uncounted.tracks[1].clips[0].counter;
    delete uncounted.tracks[1].clips[0].keyframes;
    expect(documentIssue("video", uncounted)?.code).toBe("invalid");
    expect(clipRunText(money)).toBe(`R$ ${COUNTER_SLOT} mil`);
    const image = fixture<ImageDocument>("editor_text_runs_image.json");
    const overlap = structuredClone(image);
    overlap.artboards[0].layers[0].runs![1].start = 10;
    expect(documentIssue("image", overlap)?.code).toBe("invalid");
    const font = structuredClone(image);
    font.artboards[0].layers[0].runs![1].fontId = "comic" as never;
    expect(documentIssue("image", font)?.code).toBe("unknown");
  });
});
