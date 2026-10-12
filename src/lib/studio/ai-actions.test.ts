import { describe, expect, it } from "vitest";

import { AI_ACTIONS, aiActionsFor, clipSubjectKind, imageSubjectKind, laneSubjectKind, runningActions, subjectList, type AiActionSubject } from "./ai-actions";
import { newMediaClip, newShapeLayer, newTextLayer, type Clip, type Layer, type Track } from "./document";

function subject(patch: Partial<AiActionSubject>): AiActionSubject {
  return { editor: "image", kind: "image", locked: false, hasSource: true, running: [], activeKinds: [], canAskElo: true, ...patch };
}

const ids = (s: AiActionSubject) => aiActionsFor(s).map((a) => a.definition.id);
function reasonOf(s: AiActionSubject, id: string) {
  const found = aiActionsFor(s).find((a) => a.definition.id === id);
  return found ? found.reason : "absent";
}

describe("the contextual AI action registry", () => {
  it("defines every action once", () => {
    const all = AI_ACTIONS.map((a) => a.id);
    expect(new Set(all).size).toBe(all.length);
  });

  it("offers background removal, an AI edit, a variation and Elo on an image layer", () => {
    expect(ids(subject({}))).toEqual(["removeBackground", "editImage", "imageVariation", "eloAsk"]);
  });

  it("offers background removal and Elo on an image clip, with no image editing the video editor lacks", () => {
    expect(ids(subject({ editor: "video" }))).toEqual(["removeBackground", "eloAsk"]);
  });

  it("offers the Elo text helpers on a text layer or clip in both editors", () => {
    const expected = ["eloRewrite", "eloTranslate", "eloShorten", "eloAsk"];
    expect(ids(subject({ kind: "text" }))).toEqual(expected);
    expect(ids(subject({ editor: "video", kind: "text" }))).toEqual(expected);
  });

  it("offers only Elo on shapes, groups, selections and other elements", () => {
    for (const kind of ["shape", "group", "selection", "element"] as const) expect(ids(subject({ kind }))).toEqual(["eloAsk"]);
  });

  it("offers cleanup, captions and Elo on an audio clip, and captions and Elo on a video clip", () => {
    expect(ids(subject({ editor: "video", kind: "audio" }))).toEqual(["denoise", "captions", "eloAsk"]);
    expect(ids(subject({ editor: "video", kind: "video" }))).toEqual(["captions", "eloAsk"]);
  });

  it("offers the sound generators on an audio lane and the image generator on a visual lane", () => {
    expect(ids(subject({ editor: "video", kind: "audioLane", hasSource: false }))).toEqual(["generateMusic", "generateVoice", "generateSfx"]);
    expect(ids(subject({ editor: "video", kind: "visualLane", hasSource: false }))).toEqual(["generateImage"]);
  });

  it("marks the paid actions as paid and the processing as free", () => {
    const cost = Object.fromEntries(AI_ACTIONS.map((a) => [a.id, a.cost]));
    expect(cost).toMatchObject({ removeBackground: "free", denoise: "free", captions: "free", editImage: "paid", imageVariation: "paid", generateMusic: "paid", generateVoice: "paid", generateSfx: "paid", generateImage: "paid", eloAsk: "elo" });
  });

  it("blocks edits of a locked layer but still lets the person ask Elo or make a new version beside it", () => {
    const locked = subject({ locked: true });
    expect(reasonOf(locked, "removeBackground")).toBe("locked");
    expect(reasonOf(locked, "editImage")).toBeNull();
    expect(reasonOf(locked, "eloAsk")).toBeNull();
    expect(reasonOf(subject({ kind: "text", locked: true }), "eloRewrite")).toBe("locked");
  });

  it("blocks image actions until the image has its media", () => {
    const loading = subject({ hasSource: false });
    expect(reasonOf(loading, "removeBackground")).toBe("loading");
    expect(reasonOf(loading, "editImage")).toBe("loading");
    expect(reasonOf(loading, "eloAsk")).toBeNull();
  });

  it("blocks a job that is already running for the same element", () => {
    expect(reasonOf(subject({ running: ["removeBackground"] }), "removeBackground")).toBe("running");
    expect(reasonOf(subject({ running: ["removeBackground"] }), "editImage")).toBeNull();
  });

  it("blocks a job when its lane is full and leaves the other lane free", () => {
    const full = subject({ activeKinds: ["image", "image", "image"] });
    expect(reasonOf(full, "editImage")).toBe("busy");
    expect(reasonOf(full, "removeBackground")).toBeNull();
    expect(reasonOf(subject({ activeKinds: ["cutout", "denoise"] }), "removeBackground")).toBe("busy");
  });

  it("fails closed on Elo when the person may not use the assistant", () => {
    const denied = subject({ kind: "text", canAskElo: false });
    expect(reasonOf(denied, "eloRewrite")).toBe("noElo");
    expect(reasonOf(denied, "eloAsk")).toBe("noElo");
  });

  it("blocks generation on a locked lane", () => {
    expect(reasonOf(subject({ editor: "video", kind: "audioLane", locked: true, hasSource: false }), "generateMusic")).toBe("locked");
  });

  it("reports a usable action as enabled", () => {
    const [first] = aiActionsFor(subject({}));
    expect(first).toMatchObject({ enabled: true, reason: null });
  });
});

describe("subject kinds", () => {
  const image: Layer = { id: "i", type: "image", assetId: "m", transform: { x: 0, y: 0, w: 1, h: 1, rotation: 0, opacity: 1 } };

  it("reads a single layer by its type and several as a selection", () => {
    expect(imageSubjectKind([image])).toBe("image");
    expect(imageSubjectKind([newTextLayer("Oi")])).toBe("text");
    expect(imageSubjectKind([newShapeLayer("rect")])).toBe("shape");
    expect(imageSubjectKind([{ ...image, type: "icon" }])).toBe("element");
    expect(imageSubjectKind([image, { ...image, id: "j" }])).toBe("selection");
    expect(imageSubjectKind([newShapeLayer("rect"), newTextLayer("Oi")])).toBe("selection");
    expect(imageSubjectKind([])).toBeNull();
  });

  it("reads anything that shows exactly one picture as an image, and several pictures as a selection", () => {
    expect(imageSubjectKind([newShapeLayer("rect")], 1)).toBe("image");
    expect(imageSubjectKind([newShapeLayer("rect"), image, newTextLayer("Oi")], 1)).toBe("image");
    expect(imageSubjectKind([image, { ...image, id: "j" }], 2)).toBe("selection");
    expect(imageSubjectKind([newShapeLayer("rect")], 0)).toBe("shape");
  });

  it("reads an overlay that shows a picture as an image clip", () => {
    const visual: Track = { id: "v", kind: "visual", clips: [] };
    const logo: Clip = { ...newMediaClip("image", "x", 0, 1000), type: "overlay", assetId: undefined, layer: { ...image, id: "logo" } };
    expect(clipSubjectKind(logo, visual, 1)).toBe("image");
  });

  it("reads a clip by its media, its overlay and its track", () => {
    const visual: Track = { id: "v", kind: "visual", clips: [] };
    const audio: Track = { id: "a", kind: "audio", clips: [] };
    const overlay = (layer: Layer): Clip => ({ ...newMediaClip("image", "x", 0, 1000), type: "overlay", assetId: undefined, layer });
    expect(clipSubjectKind(newMediaClip("image", "m", 0, 1000), visual, 1)).toBe("image");
    expect(clipSubjectKind(newMediaClip("video", "m", 0, 1000), visual, 1)).toBe("video");
    expect(clipSubjectKind(newMediaClip("video", "m", 0, 1000), audio, 1)).toBe("element");
    expect(clipSubjectKind(newMediaClip("audio", "m", 0, 1000), audio, 1)).toBe("audio");
    expect(clipSubjectKind(overlay(newTextLayer("Oi")), visual, 1)).toBe("text");
    expect(clipSubjectKind(overlay(newShapeLayer("rect")), visual, 1)).toBe("shape");
    expect(clipSubjectKind({ ...newMediaClip("image", "m", 0, 1000), type: "group" }, visual, 1)).toBe("group");
    expect(clipSubjectKind(newMediaClip("image", "m", 0, 1000), visual, 2)).toBe("selection");
  });

  it("reads a lane by its track kind", () => {
    expect(laneSubjectKind({ kind: "audio" })).toBe("audioLane");
    expect(laneSubjectKind({ kind: "visual" })).toBe("visualLane");
  });

  it("maps running job purposes to the actions they belong to", () => {
    expect(runningActions(["cutout", "edit", "generate", "denoise", "captions", "music"])).toEqual(["removeBackground", "editImage", "denoise", "captions"]);
  });
});

describe("the subject list Elo reads", () => {
  it("names each element with its kind and id", () => {
    expect(subjectList([{ id: "l_1", label: "Título", kind: "Texto" }, { id: "l_2", label: "Foto", kind: "Imagem" }])).toBe('"Título" (Texto, id l_1); "Foto" (Imagem, id l_2)');
  });

  it("keeps a long selection short and says how many were left out", () => {
    const items = Array.from({ length: 15 }, (_, i) => ({ id: `l_${i}`, label: `C${i}`, kind: "Forma" }));
    const listed = subjectList(items);
    expect(listed.split("; ")).toHaveLength(13);
    expect(listed.endsWith("+3")).toBe(true);
  });
});
