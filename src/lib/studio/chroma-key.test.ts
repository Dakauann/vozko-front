import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { emptyImageDocument, emptyVideoDocument, newImageLayer, newMediaClip, newOverlayClip, newTextLayer, type ImageDocument, type Layer, type VideoDocument } from "./document";
import { visualPlan } from "./playback";
import { videoScene, withChromaView } from "./scene/video-scene";
import { documentIssue } from "./validate";
import { CHROMA_DEFAULTS, CHROMA_PRESETS, chromaAt, chromaIssue, chromaKeyState, chromaPixel, chromaValue, editChromaValue, keyImageData, lowChroma, newChromaKey, setChromaLane, toggleChromaKey } from "./chroma-key";

describe("chroma key math", () => {
  it("removes the key color, keeps far colors and feathers the band between", () => {
    const key = newChromaKey();
    expect(chromaPixel(key, [0, 1, 0]).alpha).toBe(0);
    expect(chromaPixel(key, [1, 0.2, 0.6]).alpha).toBe(1);
    expect(chromaPixel(key, [0.5, 0.5, 0.5]).alpha).toBe(1);
    const edge = chromaPixel({ ...key, similarity: 0.3, smoothness: 0.3 }, [0.3, 0.7, 0.3]).alpha;
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(1);
  });

  it("pulls a greenish edge toward gray to remove spill", () => {
    const key = { ...newChromaKey(), similarity: 0.2, spill: 0.6 };
    const out = chromaPixel(key, [0.5, 0.8, 0.5]);
    expect(out.rgb[1] - out.rgb[0]).toBeLessThan(0.3);
    expect(out.alpha).toBe(1);
  });

  it("keys image pixels on the CPU with the same math and the same five tap edge filter as the GPU", () => {
    const key = newChromaKey();
    const width = 8;
    const height = 4;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) data.set(x < 4 ? [0, 255, 0, 255] : [0x99, 0x66, 0x33, 255], (y * width + x) * 4);
    }
    keyImageData(data, width, height, key);
    const at = (x: number, y: number) => Array.from(data.slice((y * width + x) * 4, (y * width + x) * 4 + 4));
    expect(at(0, 1)[3]).toBe(0);
    expect(at(2, 2)[3]).toBe(0);
    const subject = chromaPixel(key, [0x99 / 255, 0x66 / 255, 0x33 / 255]);
    expect(at(6, 1)).toEqual([...subject.rgb.map((v) => Math.round(v * 255)), 255]);
    expect(at(4, 1)[3]).toBeGreaterThan(at(3, 1)[3]);
    expect(at(3, 1)[3]).toBeLessThan(255);
  });

  it("leaves transparent pixels alone and scales the alpha a pixel already had", () => {
    const key = newChromaKey();
    const data = new Uint8ClampedArray([0, 0, 0, 0, 0x99, 0x66, 0x33, 128, 0x99, 0x66, 0x33, 128, 0x99, 0x66, 0x33, 128]);
    keyImageData(data, 2, 2, key);
    expect(Array.from(data.slice(0, 4))).toEqual([0, 0, 0, 0]);
    expect(data[7]).toBe(128);
  });

  it("warns when the picked color has almost no chroma", () => {
    expect(lowChroma("#808080")).toBe(true);
    expect(lowChroma(CHROMA_PRESETS.blue)).toBe(false);
  });
});

describe("chroma key values and keys", () => {
  it("starts from the proven defaults and animates a value from a moment on", () => {
    const key = newChromaKey(CHROMA_PRESETS.blue);
    expect(key).toEqual({ color: "#0099ff", similarity: CHROMA_DEFAULTS.similarity, smoothness: CHROMA_DEFAULTS.smoothness, spill: CHROMA_DEFAULTS.spill });
    const keyed = setChromaLane(key, "similarity", [
      { atMs: 0, value: 0.2, easing: "linear" },
      { atMs: 1000, value: 0.6, easing: "linear" },
    ]);
    expect(chromaValue(keyed, "similarity", 500)).toBeCloseTo(0.4);
    expect(chromaAt(keyed, 1000).similarity).toBeCloseTo(0.6);
    expect(chromaKeyState(keyed, "similarity", 1000)).toBe("key");
    expect(editChromaValue(keyed, "similarity", 0.5, null)).toBeNull();
    expect(toggleChromaKey(toggleChromaKey(key, "spill", 200), "spill", 200).keyframes).toBeUndefined();
  });

  it("checks color, ranges and keys like the backend", () => {
    expect(chromaIssue(newChromaKey())).toBeNull();
    expect(chromaIssue({ ...newChromaKey(), color: "green" })).toBe("invalid");
    expect(chromaIssue({ ...newChromaKey(), smoothness: 0 })).toBe("out_of_range");
    expect(chromaIssue({ ...newChromaKey(), keyframes: { spill: [{ atMs: 0, value: 2, easing: "linear" }] } })).toBe("out_of_range");
    expect(chromaIssue({ ...newChromaKey(), keyframes: { color: [{ atMs: 0, value: 1, easing: "linear" }] } as never })).toBe("invalid");
  });
});

function film(): VideoDocument {
  const d = emptyVideoDocument("square");
  d.tracks = [
    { id: "v", kind: "visual", clips: [{ ...newMediaClip("video", "vid", 0, 2000), id: "c" }] },
    { id: "t", kind: "visual", clips: [{ ...newOverlayClip(newTextLayer("Oi"), 0, 2000), id: "o" }] },
    { id: "a", kind: "audio", clips: [{ ...newMediaClip("audio", "song", 0, 2000), id: "s" }] },
  ];
  d.durationMs = 2000;
  return d;
}

describe("chroma key in the document and the scene", () => {
  it("keys video and image clips only", () => {
    const d = film();
    d.tracks[0].clips[0].chromaKey = setChromaLane(newChromaKey(), "similarity", [{ atMs: 0, value: 0.3, easing: "linear" }]);
    expect(documentIssue("video", d)).toBeNull();
    const overlay = film();
    overlay.tracks[1].clips[0].chromaKey = newChromaKey();
    expect(documentIssue("video", overlay)).toEqual({ field: "document.tracks", code: "invalid" });
    const sound = film();
    sound.tracks[2].clips[0].chromaKey = newChromaKey();
    expect(documentIssue("video", sound)).toEqual({ field: "document.tracks", code: "invalid" });
    const wrong = film();
    wrong.tracks[0].clips[0].chromaKey = { ...newChromaKey(), spill: 3 };
    expect(documentIssue("video", wrong)).toEqual({ field: "document.tracks", code: "out_of_range" });
  });

  it("hands the key resolved at the moment to the renderer", () => {
    const d = film();
    d.tracks[0].clips[0].chromaKey = setChromaLane(newChromaKey(), "similarity", [
      { atMs: 0, value: 0.2, easing: "linear" },
      { atMs: 1000, value: 0.6, easing: "linear" },
    ]);
    const node = videoScene(d, visualPlan(d, 500)).nodes.find((n) => n.id === "c")!;
    expect(node.chroma?.similarity).toBeCloseTo(0.4);
    expect(node.chroma?.keyframes).toBeUndefined();
  });
});

describe("chroma views in the preview", () => {
  it("shows the matte or the original of one clip without touching the others", () => {
    const scene = { width: 10, height: 10, background: "#000000", nodes: [
      { id: "c", chroma: newChromaKey() },
      { id: "d", chroma: newChromaKey() },
    ] } as never;
    const matte = withChromaView(scene, { clipId: "c", mode: "matte" });
    expect(matte.nodes.map((node) => node.keyMatte ?? false)).toEqual([true, false]);
    const original = withChromaView(scene, { clipId: "c", mode: "original" });
    expect(original.nodes.map((node) => Boolean(node.chroma))).toEqual([false, true]);
    expect(withChromaView(scene, null)).toBe(scene);
  });
});

describe("chroma key on image layers", () => {
  function board(layer: Layer): ImageDocument {
    const doc = emptyImageDocument({ width: 400, height: 400 });
    doc.artboards[0].layers = [layer];
    return doc;
  }

  it("keys still image layers with a static key", () => {
    expect(documentIssue("image", board({ ...newImageLayer("photo"), id: "p", chromaKey: newChromaKey() }))).toBeNull();
  });

  it("refuses a key on other layers, animated keys and values out of range", () => {
    expect(documentIssue("image", board({ ...newTextLayer("x"), id: "t", chromaKey: newChromaKey() }))).not.toBeNull();
    const animated = { ...newChromaKey(), keyframes: { similarity: [{ atMs: 0, value: 0.3, easing: "linear" as const }] } };
    expect(documentIssue("image", board({ ...newImageLayer("photo"), id: "p", chromaKey: animated }))).not.toBeNull();
    expect(documentIssue("image", board({ ...newImageLayer("photo"), id: "p", chromaKey: { ...newChromaKey(), spill: 2 } }))).not.toBeNull();
    expect(documentIssue("image", board({ ...newImageLayer("photo"), id: "p", chromaKey: { ...newChromaKey(), color: "green" } }))).not.toBeNull();
  });

  it("accepts the same keyed image layer the backend contract test reads", () => {
    const raw = JSON.parse(readFileSync(resolve(__dirname, "../../../../vozko-back/domain/studio/testdata/editor_layer_chroma.json"), "utf8"));
    expect(documentIssue("image", raw)).toBeNull();
  });
});
