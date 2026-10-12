import { describe, expect, it } from "vitest";

import { emptyArtboard, emptyVideoDocument, newMediaClip, newShapeLayer, newTextLayer, type ImageSurface, type Layer, type Transform, type VideoDocument } from "../document";
import { textShadowFor } from "../layer-effects";
import { overlayClip } from "../media-clips";
import { imageDesignChecks, MAX_CHECK_LINES, videoDesignChecks } from "./design-check";
import { layoutReport } from "./layout-report";
import { estimateTextWidth, type TextMeasure } from "./text-ink";

const box = (x: number, y: number, w: number, h: number): Transform => ({ x, y, w, h, rotation: 0, opacity: 1 });

function text(id: string, words: string, patch: Partial<Layer> = {}): Layer {
  return { ...newTextLayer(words, "heading", box(0.5, 0.5, 0.8, 0.14)), id, fontSize: 0.07, fill: "#111111", ...patch };
}

function shape(id: string, fill: string, transform: Transform = box(0.5, 0.5, 1, 1)): Layer {
  return { ...newShapeLayer("rect", transform), id, fill };
}

function art(layers: Layer[], background = "#ffffff"): ImageSurface {
  return { ...emptyArtboard({ width: 1080, height: 1080 }, background), layers };
}

function joined(lines: string[]): string {
  return lines.join("\n");
}

describe("image design checks", () => {
  it("stays quiet for a clean, legible composition", () => {
    expect(imageDesignChecks(art([text("t", "Oferta")]))).toEqual([]);
  });

  it("flags text hidden behind an opaque layer stacked above it", () => {
    const report = joined(imageDesignChecks(art([text("t", "Oferta"), shape("bg", "#0b0f12")])));
    expect(report).toContain("erro");
    expect(report).toContain("t");
    expect(report).toContain("atrás de bg");
  });

  it("measures contrast against what is really behind the text", () => {
    expect(joined(imageDesignChecks(art([text("t", "Tempo de menos", { fill: "#12b5a5", fontSize: 0.04 })])))).toContain("contraste");
    expect(imageDesignChecks(art([shape("bg", "#0b0f12"), text("t", "Oferta", { fill: "#ffffff" })]))).toEqual([]);
  });

  it("flags a heavy black shadow that turns into a smudge on a dark background", () => {
    const smudge = text("t", "Uma plataforma", { fill: "#ffffff", shadow: { color: "#000000", blur: 18, x: 0, y: 4 } });
    expect(joined(imageDesignChecks(art([shape("bg", "#0b0f12"), smudge])))).toContain("sombra");
  });

  it("suggests the shared text shadow, scaled to the letter, when a shadow is heavy", () => {
    const heavy = text("t", "Oferta", { shadow: { color: "#000000", blur: 40, x: 0, y: 4 } });
    const suggested = textShadowFor(0.07 * 1080);
    expect(joined(imageDesignChecks(art([heavy])))).toContain(`use cor como ${suggested.color} com blur perto de ${suggested.blur} e y perto de ${suggested.y}`);
  });

  it("flags tiny text, text leaving the art and text that does not fit its box", () => {
    expect(joined(imageDesignChecks(art([text("t", "Oferta", { fontSize: 0.015 })])))).toContain("pequeno");
    expect(joined(imageDesignChecks(art([text("t", "Oferta", { transform: box(0.95, 0.5, 0.4, 0.14) })])))).toContain("sai da arte");
    const long = "Uma plataforma unificada com CRM ligações Meta Ads editor de vídeo e agentes de inteligência artificial";
    expect(joined(imageDesignChecks(art([text("t", long, { transform: box(0.5, 0.5, 0.5, 0.1) })])))).toContain("esconde");
  });

  it("names the words a box hides when its lines do not fit, as an error when the text is really measured", () => {
    const price = text("price", "R$ 189,90", { fontSize: 0.05, fontWeight: 400, transform: box(0.5, 0.5, 0.2, 0.07) });
    const measured: TextMeasure = (words, layer, fontPx) => estimateTextWidth(words, layer, fontPx);
    const report = imageDesignChecks(art([price]), measured);
    expect(report).toContainEqual(expect.stringMatching(/^erro: o texto price \("R\$ 189,90"\) esconde a linha "189,90"/));
    expect(joined(report)).toContain("1 de 2 linhas");
    expect(imageDesignChecks(art([price]))).toContainEqual(expect.stringMatching(/^aviso: o texto price \("R\$ 189,90"\) esconde a linha "189,90"/));
  });

  it("gives the font_size that shows every line of a clipped box, and that size fits", () => {
    const measured: TextMeasure = (words, layer, fontPx) => estimateTextWidth(words, layer, fontPx);
    const price = text("price", "R$ 189,90", { fontSize: 0.05, fontWeight: 400, transform: box(0.5, 0.5, 0.2, 0.07) });
    const line = imageDesignChecks(art([price]), measured).find((entry) => entry.includes("esconde")) ?? "";
    const size = Number(/use font_size ([\d.]+)/.exec(line)?.[1]);
    expect(size).toBeGreaterThan(0);
    expect(size).toBeLessThan(0.05);
    expect(joined(imageDesignChecks(art([{ ...price, fontSize: size }]), measured))).not.toContain("esconde");
  });

  it("flags a single word wider than its box as an error that names the word, even when it overflows only a little", () => {
    const measured: TextMeasure = (words, layer, fontPx) => estimateTextWidth(words, layer, fontPx);
    const mark = text("mark", "ELORA", { fontSize: 0.1, fontWeight: 500, transform: box(0.5, 0.5, 0.309, 0.14) });
    const line = imageDesignChecks(art([mark]), measured).find((entry) => entry.includes("mais larga")) ?? "";
    expect(line).toMatch(/^erro: o texto mark \("ELORA"\) tem a palavra "ELORA" mais larga que a caixa/);
    expect(line).toContain("parte a palavra no meio");
    const size = Number(/use font_size ([\d.]+)/.exec(line)?.[1]);
    expect(size).toBeLessThan(0.1);
    const fitted = joined(imageDesignChecks(art([{ ...mark, fontSize: size }]), measured));
    expect(fitted).not.toContain("mais larga");
    expect(fitted).not.toContain("esconde");
    const width = Number(/alargue w para pelo menos ([\d.]+)/.exec(line)?.[1]);
    expect(joined(imageDesignChecks(art([{ ...mark, transform: box(0.5, 0.5, width, 0.14) }]), measured))).not.toContain("mais larga");
  });

  it("keeps a slightly wide word a warning when the width is only estimated", () => {
    const mark = text("mark", "ELORA", { fontSize: 0.1, fontWeight: 500, transform: box(0.5, 0.5, 0.309, 0.14) });
    expect(imageDesignChecks(art([mark]))).toContainEqual(expect.stringMatching(/^aviso: o texto mark \("ELORA"\) tem a palavra "ELORA" mais larga que a caixa/));
    expect(imageDesignChecks(art([{ ...mark, transform: box(0.5, 0.5, 0.25, 0.14) }]))).toContainEqual(expect.stringMatching(/^erro: o texto mark \("ELORA"\) tem a palavra "ELORA"/));
  });

  it("says nothing about a box that shows every line", () => {
    const price = text("price", "R$ 189,90", { fontSize: 0.05, fontWeight: 400, transform: box(0.5, 0.5, 0.2, 0.13) });
    expect(joined(imageDesignChecks(art([price])))).not.toContain("esconde");
  });

  it("flags texts drawn on top of each other", () => {
    expect(joined(imageDesignChecks(art([text("a", "Oferta"), text("b", "Hoje")])))).toContain("se sobrepõem");
  });

  it("judges tilted strips by their real corners, not by the upright box around them", () => {
    const tilted = (x: number, y: number, w: number, h: number): Transform => ({ ...box(x, y, w, h), rotation: -12 });
    const band = shape("band_white", "#ffffff", tilted(0.5, 0.62, 1.6, 0.02));
    const when = text("when", "SÁBADO 16H", { fill: "#ffffff", fontSize: 0.06, transform: box(0.5, 0.75, 0.6, 0.08) });
    const report = joined(imageDesignChecks(art([band, when], "#0b0f19")));
    expect(report).not.toContain("contraste");
    const strip = shape("strip2", "#ffc75f", tilted(0.5, 0.48, 1.3, 0.06));
    const label = text("strip1_text", "DOCES BOLOS TORTAS", { fill: "#ffffff", fontSize: 0.03, transform: tilted(0.5, 0.39, 1.2, 0.04) });
    const hidden = joined(imageDesignChecks(art([shape("strip1", "#c2255c", tilted(0.5, 0.39, 1.3, 0.06)), label, strip], "#fff1e6")));
    expect(hidden).not.toContain("escondido atrás");
    expect(joined(imageDesignChecks(art([text("a", "Oferta", { transform: tilted(0.5, 0.3, 0.8, 0.06) }), text("b", "Hoje", { transform: tilted(0.5, 0.45, 0.8, 0.06) })])))).not.toContain("se sobrepõem");
  });

  it("keeps the report short", () => {
    const crowd = Array.from({ length: 30 }, (_, i) => text(`t${i}`, "Oferta", { fontSize: 0.015 }));
    const report = imageDesignChecks(art(crowd));
    expect(report.length).toBeLessThanOrEqual(MAX_CHECK_LINES + 1);
    expect(report[report.length - 1]).toContain("mais");
  });
});

function film(): VideoDocument {
  const d = emptyVideoDocument("square");
  d.durationMs = 6000;
  return d;
}

function timed(layer: Layer, startMs: number, durationMs: number, transform: Transform) {
  return { ...overlayClip(layer, startMs, transform), id: layer.id, startMs, durationMs };
}

describe("video design checks", () => {
  it("flags a background that covers a text while both are on screen", () => {
    const d = film();
    d.tracks = [
      { id: "v1", kind: "visual", clips: [timed(text("t", "Ferramentas soltas"), 0, 3000, box(0.5, 0.4, 0.88, 0.18))] },
      { id: "v2", kind: "visual", clips: [timed(shape("bg", "#0b0f12"), 1000, 4000, box(0.5, 0.5, 1, 1))] },
    ];
    const report = joined(videoDesignChecks(d));
    expect(report).toContain("atrás de bg");
    expect(report).toMatch(/em \d+(\.\d)? s/);
  });

  it("flags a text that leaves the screen before it can be read", () => {
    const d = film();
    d.tracks = [{ id: "v1", kind: "visual", clips: [timed(text("t", "Gerencie campanhas crie vídeos e atenda clientes em um só lugar"), 0, 900, box(0.5, 0.5, 0.9, 0.3))] }];
    expect(joined(videoDesignChecks(d))).toContain("pouco tempo");
  });

  it("does not ask subtitles to stay longer than the speech they follow", () => {
    const d = film();
    const cue = (i: number) => timed(text(`c${i}`, "vamos falar de como vender mais", { fill: "#ffffff", stroke: "#000000", strokeWidth: 6, fontSize: 0.04 }), i * 800, 800, box(0.5, 0.6, 0.9, 0.1));
    d.tracks = [{ id: "v1", kind: "visual", name: "Legendas", clips: [0, 1, 2, 3].map(cue) }];
    expect(joined(videoDesignChecks(d))).not.toContain("pouco tempo");
  });

  it("stays quiet when texts sit above their background", () => {
    const d = film();
    d.tracks = [
      { id: "v1", kind: "visual", clips: [timed(shape("bg", "#0b0f12"), 0, 6000, box(0.5, 0.5, 1, 1))] },
      { id: "v2", kind: "visual", clips: [timed(text("t", "Uma plataforma", { fill: "#ffffff" }), 500, 3000, box(0.5, 0.45, 0.9, 0.18))] },
    ];
    expect(videoDesignChecks(d)).toEqual([]);
  });
});

function media(id: string, startMs: number, durationMs: number, transform: Transform = box(0.5, 0.5, 1, 1)) {
  return { ...newMediaClip("video", `asset-${id}`, startMs, durationMs), id, transform };
}

describe("video checks Elo used to miss", () => {
  it("flags a black gap between two clips that the export would show", () => {
    const d = film();
    d.tracks = [{ id: "v1", kind: "visual", clips: [media("a", 0, 2000), media("b", 2100, 3900)] }];
    const report = joined(videoDesignChecks(d));
    expect(report).toContain("erro");
    expect(report).toContain("de 2 s a 2.1 s");
    expect(report).toContain("só o fundo");
  });

  it("ignores a gap shorter than one frame", () => {
    const d = film();
    d.tracks = [{ id: "v1", kind: "visual", clips: [media("a", 0, 2005), media("b", 2030, 3970)] }];
    expect(joined(videoDesignChecks(d))).not.toContain("só o fundo");
  });

  it("flags footage that leaves the background showing at the edges", () => {
    const d = film();
    d.tracks = [{ id: "v1", kind: "visual", clips: [media("a", 0, 6000, box(0.5, 0.5, 0.94, 1))] }];
    expect(joined(videoDesignChecks(d))).toContain("bordas");
  });

  it("checks where a keyframed text comes to rest, not only the middle of its clip", () => {
    const d = film();
    const title = timed(text("t", "Oferta", { fill: "#ffffff" }), 0, 4000, box(0.5, 0.5, 0.4, 0.14));
    title.keyframes = {
      x: [
        { atMs: 0, value: 0.5, easing: "linear" },
        { atMs: 1900, value: 0.5, easing: "linear" },
        { atMs: 2200, value: 1.2, easing: "linear" },
      ],
    };
    d.tracks = [
      { id: "bg", kind: "visual", clips: [timed(shape("bg", "#0b0f12"), 0, 6000, box(0.5, 0.5, 1, 1))] },
      { id: "v1", kind: "visual", clips: [title] },
    ];
    expect(joined(videoDesignChecks(d))).toContain("sai da arte");
  });
});

describe("image checks a designer expects", () => {
  it("flags text pressed against the edge of the art", () => {
    const report = joined(imageDesignChecks(art([text("t", "Oferta", { align: "left", transform: box(0.22, 0.5, 0.42, 0.14) })])));
    expect(report).toContain("borda");
  });

  it("flags a text that is almost centered", () => {
    expect(joined(imageDesignChecks(art([text("t", "Oferta", { transform: box(0.51, 0.5, 0.8, 0.14) })])))).toContain("quase no centro");
  });

  it("flags two texts that are almost aligned", () => {
    const report = joined(
      imageDesignChecks(art([text("a", "Oferta", { align: "left", transform: box(0.45, 0.3, 0.7, 0.14) }), text("b", "Hoje", { align: "left", transform: box(0.457, 0.7, 0.7, 0.14) })])),
    );
    expect(report).toContain("quase alinhados");
  });

  it("flags a lone word on the last line of a paragraph", () => {
    const report = joined(imageDesignChecks(art([text("t", "Descontos de verão em toda a loja hoje", { fontSize: 0.05, transform: box(0.5, 0.5, 0.55, 0.3) })])));
    expect(report).toContain("palavra sozinha");
  });
});

describe("near the center, a text is judged by the edge it is aligned to", () => {
  const INK_SHARE = 0.6;
  const BOX_SHARE = 0.7;
  const INK_MIDDLE = 0.51;
  const fixedInk: TextMeasure = (words) => (words === "Oferta" ? INK_SHARE * 1080 : words.length * 10);
  const boxX: Record<"left" | "center" | "right", number> = {
    left: INK_MIDDLE - INK_SHARE / 2 + BOX_SHARE / 2,
    center: INK_MIDDLE,
    right: INK_MIDDLE + INK_SHARE / 2 - BOX_SHARE / 2,
  };

  function nearMiddle(id: string, align: "left" | "center" | "right", y = 0.5): Layer {
    return text(id, "Oferta", { align, transform: box(boxX[align], y, BOX_SHARE, 0.14) });
  }

  it("flags a centered text whose center is a few pixels off the middle", () => {
    expect(joined(imageDesignChecks(art([nearMiddle("t", "center")]), fixedInk))).toContain("quase no centro");
  });

  it("leaves a left aligned text alone even when its ink happens to sit near the middle", () => {
    expect(imageDesignChecks(art([nearMiddle("t", "left")]), fixedInk)).toEqual([]);
  });

  it("leaves a right aligned text alone even when its ink happens to sit near the middle", () => {
    expect(imageDesignChecks(art([nearMiddle("t", "right")]), fixedInk)).toEqual([]);
  });

  it("judges a left aligned text by its left edge against the other left edges", () => {
    const report = joined(imageDesignChecks(art([nearMiddle("a", "left", 0.3), { ...nearMiddle("b", "left", 0.7), transform: box(boxX.left + 0.007, 0.7, BOX_SHARE, 0.14) }]), fixedInk));
    expect(report).toContain("quase alinhados na borda esquerda");
    expect(report).not.toContain("quase no centro");
  });
});

describe("near alignment comes from the same finder the layout report reads", () => {
  const left = (id: string, x: number, y: number): Layer => text(id, "Oferta", { align: "left", transform: box(x, y, 0.7, 0.14) });
  const misaligned = (doc: ImageSurface) => layoutReport(doc).findings.filter((finding) => finding.kind === "misalign").map((finding) => [...finding.ids].sort().join(","));

  it("names the same pair the layout report points at, in the check's own words", () => {
    const doc = art([left("a", 0.45, 0.3), left("b", 0.466, 0.7)]);
    expect(misaligned(doc)).toEqual(["a,b"]);
    expect(imageDesignChecks(doc)).toEqual(["aviso: os textos a e b estão quase alinhados na borda esquerda (17 px de diferença); alinhe pelo mesmo ponto"]);
  });

  it("stays quiet where the layout report sees a shared edge", () => {
    const doc = art([left("a", 0.45, 0.3), left("b", 0.45, 0.7)]);
    expect(misaligned(doc)).toEqual([]);
    expect(joined(imageDesignChecks(doc))).not.toContain("quase alinhados");
  });

  it("stays quiet where the layout report sees two edges set apart on purpose", () => {
    const doc = art([left("a", 0.45, 0.3), left("b", 0.5, 0.7)]);
    expect(misaligned(doc)).toEqual([]);
    expect(joined(imageDesignChecks(doc))).not.toContain("quase alinhados");
  });
});

describe("a stroke that crosses a text", () => {
  const rule = (y: number): Layer => ({ ...newShapeLayer("line", box(0.5, y, 1, 0.01)), id: "rule" });

  it("warns in the check's own words when a full width line runs through a text", () => {
    expect(imageDesignChecks(art([text("t", "Oferta"), rule(0.5)]))).toEqual(['aviso: a linha rule atravessa o texto t ("Oferta"); mova um dos dois ou, se for um risco de propósito, deixe assim']);
  });

  it("stays quiet for a line that runs below the letters", () => {
    expect(imageDesignChecks(art([text("t", "Oferta"), rule(0.6)]))).toEqual([]);
  });
});
