import { describe, expect, it } from "vitest";

import { emptyArtboard, IMAGE_DOCUMENT_VERSION, IMAGE_SCHEMA, newShapeLayer, newTextLayer, type Artboard, type ImageDocument, type Layer } from "../document";
import { FILTER_PRESETS } from "../image-edits";
import { documentIssue } from "../validate";
import { planBatch } from "./batch";
import { VECTOR_PRESETS } from "../vector-presets";
import { applyImageOperation, IMAGE_ID_FIELDS, type ImageOpContext, type ImageOperation } from "./image-ops";

function doc(): ImageDocument {
  const main: Artboard = {
    ...emptyArtboard({ width: 1080, height: 1080 }),
    id: "main",
    layers: [
      { ...newShapeLayer("rect"), id: "bg" },
      { ...newTextLayer("Promoção"), id: "title" },
      { ...newShapeLayer("ellipse"), id: "dot", locked: true },
    ],
  };
  return { schema: IMAGE_SCHEMA, version: IMAGE_DOCUMENT_VERSION, artboards: [main] };
}

function main(d: ImageDocument): Artboard {
  return d.artboards[0];
}

function layerById(d: ImageDocument, id: string): Layer | undefined {
  return d.artboards.flatMap((a) => a.layers).find((l) => l.id === id);
}

const ctx: ImageOpContext = {
  naturalSize: (id) => (id === "photo" ? { width: 2000, height: 1000 } : undefined),
  icons: ["heart", "star", "fire"],
  activeArtboard: "main",
};

function run(ops: ImageOperation[], base: ImageDocument = doc()) {
  return planBatch(base, ops, (d, op) => applyImageOperation(d, op, ctx), IMAGE_ID_FIELDS);
}

function done(ops: ImageOperation[], base?: ImageDocument): ImageDocument {
  const plan = run(ops, base);
  if (!plan.ok) throw new Error(`${plan.op}: ${plan.reason}`);
  expect(documentIssue("image", plan.final)).toBeNull();
  return plan.final;
}

describe("image operations", () => {
  it("composes a headline with style in one batch", () => {
    const plan = run([
      { op: "add_text", ref: "h", text: "Black Friday", style: "heading", y: 0.2, fill: "#ffffff", font_id: "bebas-neue" },
      { op: "align_layers", layer_ids: ["@h"], alignment: "center" },
    ]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const heading = layerById(plan.final, plan.created.h[0])!;
    expect(heading).toMatchObject({ type: "text", text: "Black Friday", fill: "#ffffff", fontId: "bebas-neue" });
    expect(heading.transform.y).toBe(0.2);
  });

  it("adds a library image fitted to the art, keeping its proportion", () => {
    const plan = run([{ op: "add_image", ref: "p", media_id: "photo" }]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const photo = layerById(plan.final, plan.created.p[0])!;
    expect(photo.assetId).toBe("photo");
    expect(photo.transform.w / photo.transform.h).toBeCloseTo(2, 1);
    expect(run([{ op: "add_image", media_id: "ghost" }]).ok).toBe(false);
  });

  it("updates position, text and style of a layer", () => {
    const next = done([{ op: "update_layer", layer_id: "title", text: "Liquidação", x: 0.3, font_size: 0.09, letter_spacing: 0.05 }]);
    expect(layerById(next, "title")).toMatchObject({ text: "Liquidação", fontSize: 0.09, letterSpacing: 0.05 });
    expect(layerById(next, "title")!.transform.x).toBe(0.3);
  });

  it("applies what fits each layer and reports the fields it ignored", () => {
    const plan = run([
      { op: "add_shape", ref: "band", shape: "rect", path_preset: "diagonalBand", font_id: "inter", fill: "#e10600", x: 0.5, y: 0.8, w: 1, h: 0.3 },
      { op: "update_layer", layer_ids: ["title", "bg"], font_size: 0.1, fill: "#111111" },
    ]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(layerById(plan.final, plan.created.band[0])).toMatchObject({ shape: "path", fill: "#e10600" });
    expect(layerById(plan.final, plan.created.band[0])?.fontId).toBeUndefined();
    expect(layerById(plan.final, "title")).toMatchObject({ fontSize: 0.1, fill: "#111111" });
    expect(layerById(plan.final, "bg")).toMatchObject({ fill: "#111111" });
    expect(plan.notes).toEqual([
      "operação 1 (add_shape): shape rect ignorado, path_preset diagonalBand define a forma",
      "operação 1 (add_shape): font_id só vale para camadas de texto",
      "operação 2 (update_layer): camada bg: font_size só vale para camadas de texto",
    ]);
  });

  it("still refuses an edit where nothing fits the layer", () => {
    const plan = run([{ op: "update_layer", layer_id: "bg", font_size: 0.1, italic: true }]);
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toContain("font_size só vale para camadas de texto");
  });

  it("refuses text settings on a shape and edits on a locked layer", () => {
    expect(run([{ op: "update_layer", layer_id: "bg", font_size: 0.1 }]).ok).toBe(false);
    expect(run([{ op: "update_layer", layer_id: "dot", fill: "#000000" }]).ok).toBe(false);
  });

  it("orders, duplicates, groups and hides layers", () => {
    const plan = run([
      { op: "order_layers", layer_ids: ["title"], direction: "back" },
      { op: "duplicate_layers", ref: "copy", layer_ids: ["bg"] },
      { op: "group_layers", ref: "g", layer_ids: ["bg", "@copy"] },
      { op: "set_hidden", layer_ids: ["title"], hidden: true },
    ]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(main(plan.final).layers[0].id).toBe("title");
    expect(main(plan.final).layers.find((l) => l.id === "title")!.hidden).toBe(true);
    expect(main(plan.final).groups?.map((g) => g.id)).toEqual(plan.created.g);
  });

  it("makes the lowest layer the parent of the others and moves the family with it", () => {
    const plan = run([
      { op: "scaffold_layers", ref: "card", layer_ids: ["title", "bg"] },
      { op: "update_layer", layer_id: "bg", x: 0.3 },
    ]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(main(plan.final).groups?.find((g) => g.id === plan.created.card[0])?.baseId).toBe("bg");
    expect(layerById(plan.final, "title")!.transform.x).toBeCloseTo(0.3);
    expect(run([{ op: "scaffold_layers", layer_ids: ["title"] }]).ok).toBe(false);
  });

  it("deletes layers and explains a missing one", () => {
    const next = done([{ op: "delete_layers", layer_ids: ["bg"] }]);
    expect(layerById(next, "bg")).toBeUndefined();
    const plan = run([{ op: "delete_layers", layer_ids: ["nope"] }]);
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toContain("studio_read");
  });

  it("resizes the art and changes its background", () => {
    const next = done([{ op: "update_artboard", width: 1080, height: 1350, background: "#101820" }]);
    expect(main(next).canvas).toMatchObject({ width: 1080, height: 1350, background: "#101820" });
    expect(run([{ op: "update_artboard", width: 20, height: 20 }]).ok).toBe(false);
  });

  it("replaces the picture of an image layer", () => {
    const withPhoto = run([{ op: "add_image", ref: "p", media_id: "photo" }]);
    if (!withPhoto.ok) throw new Error(withPhoto.reason);
    const id = withPhoto.created.p[0];
    const replaced = run([{ op: "replace_image", layer_id: id, media_id: "photo" }], withPhoto.final);
    expect(replaced.ok).toBe(true);
    expect(run([{ op: "replace_image", layer_id: "title", media_id: "photo" }]).ok).toBe(false);
  });
});

function refusal(ops: ImageOperation[], base?: ImageDocument): string {
  const plan = run(ops, base);
  if (plan.ok) throw new Error("the batch was accepted");
  return plan.reason;
}

function order(d: ImageDocument): string[] {
  return main(d).layers.map((l) => l.id);
}

function withPhoto(): ImageDocument {
  const plan = run([{ op: "add_image", ref: "p", media_id: "photo" }]);
  if (!plan.ok) throw new Error(plan.reason);
  const base = structuredClone(plan.final);
  const layers = main(base).layers;
  layers[layers.length - 1].id = "photo";
  return base;
}

describe("advanced image editing", () => {
  it("fills a circle with a radial gradient that has a middle color", () => {
    const plan = run([{ op: "add_shape", ref: "c", shape: "ellipse", x: 0.5, y: 0.5, w: 0.4, h: 0.4, gradient: { kind: "radial", from: "#fff7cc", via: "#ff8a00", to: "#7a1f00", cy: 0.4 } }]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(documentIssue("image", plan.final)).toBeNull();
    expect(layerById(plan.final, plan.created.c[0])!.gradient).toEqual({ kind: "radial", from: "#fff7cc", via: "#ff8a00", to: "#7a1f00", angle: 0, cx: 0.5, cy: 0.4, radius: 1 });
  });

  it("swaps a gradient for a solid fill and clears effects by name", () => {
    const styled = done([{ op: "update_layer", layer_id: "bg", gradient: { from: "#000000", to: "#ffffff", angle: 90 }, shadow: { y: 6 } }]);
    expect(layerById(styled, "bg")!.shadow).toBeDefined();
    const solid = done([{ op: "update_layer", layer_id: "bg", fill: "#ff0000", clear: ["shadow"] }], styled);
    expect(layerById(solid, "bg")).toMatchObject({ fill: "#ff0000" });
    expect(layerById(solid, "bg")!.gradient).toBeUndefined();
    expect(layerById(solid, "bg")!.shadow).toBeUndefined();
    expect(refusal([{ op: "update_layer", layer_id: "bg", clear: ["sparkle"] }])).toContain("gradient");
  });

  it("names the gradient field that is wrong", () => {
    expect(refusal([{ op: "update_layer", layer_id: "bg", gradient: { from: "#000000" } }])).toContain("from e to");
    expect(refusal([{ op: "update_layer", layer_id: "bg", gradient: { kind: "radial", from: "#000000", to: "#ffffff", radius: 3 } }])).toContain("gradient.radius vai de 0.05 a 2");
    expect(refusal([{ op: "update_layer", layer_id: "bg", gradient: { kind: "conic", from: "#000000", to: "#ffffff" } }])).toContain("linear, radial");
  });

  it("adds a soft shadow with sensible defaults and explains its range", () => {
    const next = done([{ op: "update_layer", layer_id: "title", shadow: { blur: 20 } }]);
    expect(layerById(next, "title")!.shadow).toEqual({ color: "#00000066", blur: 20, x: 0, y: 6 });
    expect(refusal([{ op: "update_layer", layer_id: "title", shadow: { blur: 999 } }])).toContain("shadow.blur vai de 0 a 200");
  });

  it("places layers exactly above or below another, keeping their own order", () => {
    expect(order(done([{ op: "order_layers", layer_ids: ["bg"], above_id: "title" }]))).toEqual(["title", "bg", "dot"]);
    expect(order(done([{ op: "order_layers", layer_ids: ["dot"], below_id: "bg" }]))).toEqual(["dot", "bg", "title"]);
    expect(order(done([{ op: "order_layers", layer_ids: ["bg", "title"], above_id: "dot" }]))).toEqual(["dot", "bg", "title"]);
    const plan = run([
      { op: "add_text", ref: "t", text: "Novo" },
      { op: "order_layers", layer_ids: ["@t"], below_id: "title" },
    ]);
    expect(plan.ok && order(plan.final).indexOf(plan.created.t[0])).toBe(1);
    expect(refusal([{ op: "order_layers", layer_ids: ["bg"] }])).toContain("above_id");
    expect(refusal([{ op: "order_layers", layer_ids: ["bg"], above_id: "bg" }])).toContain("ela mesma");
  });

  it("draws vector shapes from path data, presets and tuned stars", () => {
    const plan = run([
      { op: "add_shape", ref: "band", shape: "path", path: "M0 0.6 L1 0.4 L1 1 L0 1 Z", x: 0.5, y: 0.8, w: 1, h: 0.4, fill: "#e10600" },
      { op: "add_shape", ref: "arch", path_preset: "arch", x: 0.6, y: 0.5, w: 0.5, h: 0.6 },
      { op: "add_shape", ref: "seal", shape: "star", points: 20, inner: 0.85, x: 0.8, y: 0.2, w: 0.2, h: 0.2, fill: "#ffcc00" },
      { op: "update_layer", layer_id: "@band", path: "M0 0.5 L1 0.3 L1 1 L0 1 Z" },
    ]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(documentIssue("image", plan.final)).toBeNull();
    expect(layerById(plan.final, plan.created.band[0])).toMatchObject({ shape: "path", path: "M0 0.5 L1 0.3 L1 1 L0 1 Z", fill: "#e10600" });
    expect(layerById(plan.final, plan.created.arch[0])).toMatchObject({ shape: "path", path: VECTOR_PRESETS.arch.kind === "path" ? VECTOR_PRESETS.arch.data : "", transform: { w: 0.5, h: 0.6 } });
    expect(layerById(plan.final, plan.created.seal[0])).toMatchObject({ shape: "star", points: 20, inner: 0.85 });
  });

  it("styles strokes with caps, joins, miter limits and dash patterns", () => {
    const plan = run([
      { op: "add_shape", ref: "line", shape: "path", path: "M0 0 L1 1", stroke: "#111111", stroke_width: 6, line_cap: "square", line_join: "miter", miter_limit: 6, dash_array: [3, 1], dash_offset: 0.5 },
      { op: "add_icon", ref: "star", icon_id: "star", line_cap: "butt" },
    ]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(layerById(plan.final, plan.created.line[0])).toMatchObject({ lineCap: "square", lineJoin: "miter", miterLimit: 6, dashArray: [3, 1], dashOffset: 0.5 });
    expect(layerById(plan.final, plan.created.star[0])?.lineCap).toBeUndefined();
    expect(plan.notes.join(" ")).toContain("line_cap");
    const cleared = run([{ op: "update_layer", layer_id: plan.created.line[0], dash_array: [] }], plan.final);
    expect(cleared.ok && layerById(cleared.final, plan.created.line[0])?.dashArray).toBeUndefined();
    for (const bad of [{ line_cap: "flat" }, { miter_limit: 50 }, { dash_array: [0, 0] }, { dash_array: [1, 2, 3, 4, 5, 6, 7, 8, 9] }]) {
      expect(run([{ op: "update_layer", layer_id: "bg", stroke_width: 2, ...bad }]).ok, JSON.stringify(bad)).toBe(false);
    }
  });

  it("puts arrow heads on open vector paths and notes them as ignored on closed ones", () => {
    const plan = run([
      { op: "add_shape", ref: "curve", shape: "path", path: "M0 1 C0 0 1 0 1 1", stroke: "#111111", stroke_width: 6, arrow_end: true },
      { op: "add_shape", ref: "box", shape: "path", path: "M0 0 L1 0 L1 1 Z", fill: "#111111", arrow_end: true },
    ]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(layerById(plan.final, plan.created.curve[0])?.arrowEnd).toBe(true);
    expect(layerById(plan.final, plan.created.box[0])?.arrowEnd).toBeUndefined();
    expect(plan.notes).toEqual(["operação 2 (add_shape): arrow_end só vale para linhas, setas e caminhos abertos"]);
    const opened = run([{ op: "update_layer", layer_id: plan.created.box[0], path: "M0 0 L1 0 L1 1", stroke: "#111111", stroke_width: 4, arrow_start: true }], plan.final);
    expect(opened.ok && layerById(opened.final, plan.created.box[0])?.arrowStart).toBe(true);
  });

  it("combines shapes with the same boolean operations people use", () => {
    const plan = run([
      { op: "add_shape", ref: "a", shape: "rect", x: 0.4, y: 0.4, w: 0.2, h: 0.2, fill: "#ff0000" },
      { op: "add_shape", ref: "b", shape: "ellipse", x: 0.5, y: 0.5, w: 0.2, h: 0.2, fill: "#0000ff" },
      { op: "combine_shapes", ref: "cut", layer_ids: ["@b", "@a"], mode: "subtract" },
    ]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const cut = layerById(plan.final, plan.created.cut[0])!;
    expect(cut).toMatchObject({ shape: "path", fill: "#ff0000", fillRule: "evenodd" });
    expect(main(plan.final).layers.some((l) => l.id === plan.created.a[0] || l.id === plan.created.b[0])).toBe(false);
    expect(refusal([{ op: "combine_shapes", layer_ids: ["bg", "title"], mode: "union" }])).toContain("formas");
    expect(refusal([{ op: "combine_shapes", layer_ids: ["bg"], mode: "union" }])).toContain("pelo menos 2");
    expect(refusal([{ op: "combine_shapes", layer_ids: ["bg", "title"] }])).toContain("mode");
  });

  it("cuts the holes of a vector shape with the even-odd fill rule", () => {
    const plan = run([{ op: "add_shape", ref: "ring", shape: "path", path: "M0 0 L1 0 L1 1 L0 1 Z M0.3 0.3 L0.7 0.3 L0.7 0.7 L0.3 0.7 Z", fill_rule: "evenodd" }]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(layerById(plan.final, plan.created.ring[0])?.fillRule).toBe("evenodd");
    const wrong = run([{ op: "add_shape", shape: "path", path: "M0 0 L1 1 L0 1 Z", fill_rule: "winding" }]);
    expect(wrong.ok).toBe(false);
  });

  it("explains a broken path, an unknown preset and vector fields on the wrong shape", () => {
    const reason = (ops: ImageOperation[]) => {
      const plan = run(ops);
      return plan.ok ? "" : plan.reason;
    };
    expect(reason([{ op: "add_shape", shape: "path" }])).toContain("path");
    expect(reason([{ op: "add_shape", shape: "path", path: "L0 0 Z" }])).toContain("caminho SVG");
    expect(reason([{ op: "add_shape", path_preset: "spiral" }])).toContain("arch");
    expect(reason([{ op: "update_layer", layer_id: "bg", points: 8 }])).toContain("points");
    expect(reason([{ op: "add_shape", shape: "star", points: 2 }])).toContain("points");
  });

  it("masks a picture with a shape below it, like a clipping mask", () => {
    const plan = run(
      [
        { op: "add_shape", ref: "m", shape: "ellipse", x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
        { op: "order_layers", layer_ids: ["@m"], below_id: "photo" },
        { op: "update_layer", layer_id: "photo", clip: true },
      ],
      withPhoto(),
    );
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const ids = order(plan.final);
    expect(ids.indexOf("photo")).toBe(ids.indexOf(plan.created.m[0]) + 1);
    expect(layerById(plan.final, "photo")!.clip).toBe(true);
    expect(refusal([{ op: "update_layer", layer_id: "bg", clip: true }])).toContain("logo abaixo");
  });

  it("frames a picture in a shape and takes the frame off", () => {
    const framed = done([{ op: "update_layer", layer_id: "photo", frame: "ellipse" }], withPhoto());
    expect(layerById(framed, "photo")!.frame).toBe("ellipse");
    expect(layerById(done([{ op: "update_layer", layer_id: "photo", frame: "none" }], framed), "photo")!.frame).toBeUndefined();
    expect(refusal([{ op: "update_layer", layer_id: "title", frame: "ellipse" }])).toContain("só vale para imagens");
  });

  it("crops a picture to a region of the original, keeping what stays in place", () => {
    const base = withPhoto();
    const before = layerById(base, "photo")!.transform;
    const next = done([{ op: "update_layer", layer_id: "photo", crop: { x: 0.25, y: 0, w: 0.5, h: 1 } }], base);
    const photo = layerById(next, "photo")!;
    expect(photo.crop).toEqual({ x: 0.25, y: 0, w: 0.5, h: 1 });
    expect(photo.transform.w).toBeCloseTo(before.w / 2, 5);
    expect(photo.transform.x).toBeCloseTo(before.x, 5);
    expect(refusal([{ op: "update_layer", layer_id: "photo", crop: { x: 0.6, y: 0, w: 0.5, h: 1 } }], base)).toContain("passa da imagem");
    expect(refusal([{ op: "update_layer", layer_id: "title", crop: { x: 0, y: 0, w: 0.5, h: 1 } }])).toContain("só vale para imagens");
  });

  it("adjusts filters, applies a preset, flips and blends a picture", () => {
    const base = withPhoto();
    const tuned = done([{ op: "update_layer", layer_id: "photo", filters: { brightness: 0.1 }, flip_x: true, blend_mode: "multiply" }], base);
    expect(layerById(tuned, "photo")).toMatchObject({ filters: { brightness: 0.1, contrast: 0, saturation: 0, blur: 0 }, flipX: true, blendMode: "multiply" });
    const vivid = done([{ op: "update_layer", layer_id: "photo", filter_preset: "vivid" }], base);
    expect(layerById(vivid, "photo")!.filters).toEqual(FILTER_PRESETS.find((p) => p.id === "vivid")!.filters);
    expect(refusal([{ op: "update_layer", layer_id: "photo", blend_mode: "dissolve" }], base)).toContain("multiply");
    expect(refusal([{ op: "update_layer", layer_id: "photo", filters: { contrast: 500 } }], base)).toContain("filters.contrast vai de -100 a 100");
  });

  it("styles text like a designer: italic, a highlight box and a curve", () => {
    const next = done([{ op: "update_layer", layer_id: "title", italic: true, highlight: { color: "#ffe14d" }, curve: 0.4 }]);
    expect(layerById(next, "title")).toMatchObject({ italic: true, highlight: { color: "#ffe14d", radius: 0.2 }, curve: 0.4 });
    expect(refusal([{ op: "update_layer", layer_id: "bg", italic: true }])).toContain("italic só vale para camadas de texto");
  });

  it("adds an icon from the catalog and lists the real ones when it does not exist", () => {
    const plan = run([{ op: "add_icon", ref: "i", icon_id: "heart", fill: "#ff3366", x: 0.8, y: 0.2, w: 0.1, h: 0.1 }]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(layerById(plan.final, plan.created.i[0])).toMatchObject({ type: "icon", iconId: "heart", fill: "#ff3366" });
    expect(refusal([{ op: "add_icon", icon_id: "unicorn" }])).toContain("heart, star, fire");
  });

  it("paints the art background with a radial gradient and goes back to a solid color", () => {
    const glowing = done([{ op: "update_artboard", gradient: { kind: "radial", from: "#3b0764", to: "#000000", radius: 1.2 } }]);
    expect(main(glowing).canvas.gradient).toMatchObject({ kind: "radial", radius: 1.2 });
    const flat = done([{ op: "update_artboard", background: "#111111" }], glowing);
    expect(main(flat).canvas.gradient).toBeUndefined();
    expect(main(flat).canvas.background).toBe("#111111");
    expect(main(done([{ op: "update_artboard", background: "transparent" }])).canvas.background).toBe("");
  });
});

describe("artboards", () => {
  it("adds an artboard to the right and builds on it in the same batch", () => {
    const plan = run([
      { op: "add_artboard", ref: "story", name: "Story", width: 1080, height: 1920, background: "#101820" },
      { op: "add_text", ref: "t", artboard_id: "@story", text: "Agora no story" },
    ]);
    if (!plan.ok) throw new Error(plan.reason);
    const story = plan.final.artboards.find((a) => a.id === plan.created.story[0])!;
    expect(story).toMatchObject({ name: "Story", y: 0, canvas: { width: 1080, height: 1920, background: "#101820" } });
    expect(story.x).toBeGreaterThan(1080);
    expect(story.layers.map((l) => l.id)).toEqual(plan.created.t);
    expect(main(plan.final).layers).toHaveLength(3);
  });

  it("creates new elements on the artboard the person is looking at when none is named", () => {
    const second: Artboard = { ...emptyArtboard({ width: 500, height: 500 }), id: "side", x: 1200 };
    const base = { ...doc(), artboards: [...doc().artboards, second] };
    const plan = planBatch(base, [{ op: "add_text", ref: "t", text: "Oi" } as ImageOperation], (d, op) => applyImageOperation(d, op, { ...ctx, activeArtboard: "side" }), IMAGE_ID_FIELDS);
    if (!plan.ok) throw new Error(plan.reason);
    expect(plan.final.artboards[1].layers.map((l) => l.id)).toEqual(plan.created.t);
  });

  it("duplicates an artboard as a version and edits the copy in the same batch, leaving the original intact", () => {
    const plan = run([
      { op: "duplicate_artboard", ref: "v2", artboard_id: "main", name: "Versão azul" },
      { op: "update_layer", layer_id: "@v2/title", text: "Promoção azul", fill: "#1d4ed8" },
    ]);
    if (!plan.ok) throw new Error(plan.reason);
    const copy = plan.final.artboards[1];
    expect(copy).toMatchObject({ id: plan.created.v2[0], name: "Versão azul" });
    expect(plan.copies.title).toBe(copy.layers[1].id);
    expect(copy.layers[1]).toMatchObject({ text: "Promoção azul", fill: "#1d4ed8" });
    expect(layerById(plan.final, "title")!.text).toBe("Promoção");
    expect(documentIssue("image", plan.final)).toBeNull();
  });

  it("makes a wide version by duplicating into another size", () => {
    const wide = done([{ op: "duplicate_artboard", artboard_id: "main", width: 1920, height: 1080 }]);
    expect(wide.artboards[1].canvas).toMatchObject({ width: 1920, height: 1080 });
    expect(wide.artboards[1].layers).toHaveLength(3);
  });

  it("refuses one operation over layers of two artboards, an unknown artboard and deleting the last one", () => {
    const twin = done([{ op: "duplicate_artboard", artboard_id: "main" }]);
    const copyTitle = twin.artboards[1].layers[1].id;
    expect(refusal([{ op: "group_layers", layer_ids: ["title", copyTitle] }], twin)).toContain("pranchetas diferentes");
    expect(refusal([{ op: "add_text", artboard_id: "nowhere", text: "Oi" }])).toContain("prancheta nowhere não existe");
    expect(refusal([{ op: "delete_artboard", artboard_id: "main" }])).toContain("última prancheta");
    expect(done([{ op: "delete_artboard", artboard_id: twin.artboards[1].id }], twin).artboards).toHaveLength(1);
  });

  it("renames and resizes an artboard by id", () => {
    const next = done([{ op: "update_artboard", artboard_id: "main", name: "Feed", width: 1080, height: 1350 }]);
    expect(main(next)).toMatchObject({ name: "Feed", canvas: { height: 1350 } });
  });

  it("moves layers to another artboard keeping their place on it, and refuses locked ones", () => {
    const twin = done([{ op: "add_artboard", width: 1080, height: 1080 }]);
    const target = twin.artboards[1].id;
    const moved = done([{ op: "move_to_artboard", layer_ids: ["title"], artboard_id: target }], twin);
    expect(moved.artboards[1].layers.map((l) => l.id)).toEqual(["title"]);
    expect(layerById(moved, "title")!.transform.x).toBeCloseTo(0.5);
    expect(refusal([{ op: "move_to_artboard", layer_ids: ["dot"], artboard_id: target }], twin)).toContain("travada");
  });

  it("selects whole artboards", () => {
    const plan = run([{ op: "select", artboard_id: "main" }]);
    if (!plan.ok) throw new Error(plan.reason);
    expect(plan.steps[0].select).toEqual(["main"]);
  });
});
