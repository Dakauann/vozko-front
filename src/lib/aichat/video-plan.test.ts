import { describe, expect, it } from "vitest";

import { parseVideoPlan } from "./video-plan";

const plan = {
  aspect: "story",
  scenes: [
    { mediaId: "img-1", url: "https://cdn.example.com/pao.jpg", kind: "image", seconds: 4 },
    { mediaId: "vid-1", url: "https://cdn.example.com/forno.mp4", kind: "video", seconds: 6.5 },
  ],
  music: { mediaId: "aud-1", url: "https://cdn.example.com/samba.m4a" },
  voice: { mediaId: "aud-2", url: "https://cdn.example.com/locucao.m4a" },
};

describe("parseVideoPlan", () => {
  it("reads the scenes, their seconds and the total, with the music and the voice", () => {
    expect(parseVideoPlan(plan)).toEqual({ ...plan, totalSeconds: 10.5 });
  });

  it("keeps a plan with only one of the audio tracks", () => {
    const withoutVoice = { aspect: plan.aspect, scenes: plan.scenes, music: plan.music };
    expect(parseVideoPlan(withoutVoice)).toEqual({ ...withoutVoice, totalSeconds: 10.5 });
  });

  it("refuses a plan whose aspect is unknown", () => {
    expect(parseVideoPlan({ ...plan, aspect: "panorama" })).toBeNull();
  });

  it("refuses a plan without scenes", () => {
    expect(parseVideoPlan({ ...plan, scenes: [] })).toBeNull();
    expect(parseVideoPlan({ aspect: "square" })).toBeNull();
    expect(parseVideoPlan(null)).toBeNull();
  });

  it("refuses a plan with a scene it cannot show", () => {
    expect(parseVideoPlan({ ...plan, scenes: [{ ...plan.scenes[0], url: "" }] })).toBeNull();
    expect(parseVideoPlan({ ...plan, scenes: [{ ...plan.scenes[0], kind: "audio" }] })).toBeNull();
    expect(parseVideoPlan({ ...plan, scenes: [{ ...plan.scenes[0], seconds: 0 }] })).toBeNull();
    expect(parseVideoPlan({ ...plan, scenes: [{ ...plan.scenes[0], seconds: "4" }] })).toBeNull();
  });

  it("refuses an audio track without a url", () => {
    expect(parseVideoPlan({ ...plan, music: { mediaId: "aud-1", url: "" } })).toBeNull();
  });
});
