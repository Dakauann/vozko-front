import { describe, expect, it } from "vitest";

import { emptyVideoDocument, fullFrame, newMediaClip, type Clip, type VideoDocument } from "./document";
import type { GroupClip } from "./group-scope";
import { audioPlan, audioVoiceKeys, soundAssetIds, visualPlan } from "./playback";
import { videoSources } from "./scene/scene";
import { videoScene } from "./scene/video-scene";

function group(extra: Partial<GroupClip> = {}): GroupClip {
  const shot: Clip = { ...newMediaClip("video", "m-shot", 0, 3000), id: "shot" };
  const voice: Clip = { ...newMediaClip("audio", "m-voice", 0, 3000), id: "voice" };
  return {
    id: "g",
    type: "group",
    startMs: 1000,
    durationMs: 2000,
    trimInMs: 500,
    volume: 0.5,
    fadeInMs: 0,
    fadeOutMs: 0,
    transform: { ...fullFrame(), w: 0.5, h: 0.5 },
    tracks: [
      { id: "inner-v", kind: "visual", clips: [shot] },
      { id: "inner-a", kind: "audio", clips: [voice] },
    ],
    ...extra,
  };
}

function film(g: GroupClip = group()): VideoDocument {
  const doc = emptyVideoDocument("story");
  doc.tracks = [{ id: "v", kind: "visual", clips: [g] }];
  doc.durationMs = 3000;
  return doc;
}

describe("group playback", () => {
  it("plans the inner timeline at the group's inner time and speed", () => {
    const items = visualPlan(film(group({ speed: 2 })), 1500, 0);
    expect(items).toHaveLength(1);
    const [item] = items;
    expect(item.type).toBe("group");
    expect(item.transform.w).toBe(0.5);
    const inner = item.group!.items.find((candidate) => candidate.clipId === "shot")!;
    expect(inner.sourceMs).toBe(1500);
    expect(inner.speed).toBe(2);
  });

  it("composes one group node whose videos the decoders still see", () => {
    const doc = film();
    const scene = videoScene(doc, visualPlan(doc, 1500));
    expect(scene.nodes).toHaveLength(1);
    const node = scene.nodes[0];
    expect(node.source.kind).toBe("group");
    expect(node.fit).toBe("fill");
    expect(videoSources(scene).map((video) => video.source.clipId)).toEqual(["shot"]);
  });

  it("mixes inner sound inside the window at the group volume", () => {
    const doc = film();
    expect(soundAssetIds(doc)).toEqual(["m-voice"]);
    const [voice] = audioPlan(doc, 0);
    expect(voice.clipId).toBe("voice");
    expect(voice.delayMs).toBe(1000);
    expect(voice.offsetMs).toBe(500);
    expect(voice.durationMs).toBe(2000);
    expect(voice.gain[0].value).toBeCloseTo(0.5, 9);
    const later = audioPlan(doc, 2000)[0];
    expect([later.delayMs, later.offsetMs, later.durationMs]).toEqual([0, 1500, 1000]);
    expect(audioPlan(doc, 3000)).toEqual([]);
  });

  it("restarts inner voices when the group moves and silences hidden or solo-skipped groups", () => {
    const doc = film();
    const moved = film(group({ startMs: 900 }));
    expect(audioVoiceKeys(doc).get("voice")).not.toBe(audioVoiceKeys(moved).get("voice"));
    const hidden = film();
    hidden.tracks[0].hidden = true;
    expect(audioPlan(hidden, 0)).toEqual([]);
    expect(audioPlan(doc, 0, { soloTrackIds: ["other"] })).toEqual([]);
  });

  it("fades the inner sound with the group fades", () => {
    const [voice] = audioPlan(film(group({ fadeInMs: 1000 })), 0);
    expect(voice.gain[0].value).toBeCloseTo(0, 9);
    expect(voice.gain.at(-1)!.value).toBeCloseTo(0.5, 9);
  });
});
