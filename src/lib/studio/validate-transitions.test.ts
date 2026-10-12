import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, type Clip, type VideoDocument } from "./document";
import type { ClipTransition } from "./edge-transitions";
import type { Transition } from "./transitions";
import { documentIssue } from "./validate";

function film(change: (d: VideoDocument) => void): VideoDocument {
  const d = emptyVideoDocument("landscape");
  const clip = (id: string, startMs: number, durationMs: number): Clip => ({ ...newMediaClip("video", `m-${id}`, startMs, durationMs), id });
  d.tracks = [
    { id: "v1", kind: "visual", clips: [clip("a", 0, 2000), clip("b", 2000, 2000), clip("c", 5000, 1000)] },
    { id: "au", kind: "audio", clips: [{ ...newMediaClip("audio", "song", 0, 6000), id: "m" }] },
  ];
  d.durationMs = 6000;
  change(d);
  return d;
}

const wipe: ClipTransition = { kind: "wipe", durationMs: 500, easing: "linear" };
const dissolve: Transition = { id: "x", fromClipId: "a", toClipId: "b", kind: "dissolve", durationMs: 500, alignment: "center", easing: "linear" };
const clipAt = (d: VideoDocument, track: number, index: number) => d.tracks[track].clips[index];

describe("the transition contract shared with the backend", () => {
  it("accepts the fixture the backend accepts", () => {
    const raw = JSON.parse(readFileSync(resolve(__dirname, "../../../../vozko-back/domain/studio/testdata/editor_transitions.json"), "utf8"));
    expect(documentIssue("video", raw)).toBeNull();
  });

  it("accepts an entrance and an exit on the same clip", () => {
    const d = film((doc) => {
      clipAt(doc, 0, 2).transitionIn = { kind: "radialWipe", durationMs: 400, easing: "easeOut", softness: 0.2, originY: 1 };
      clipAt(doc, 0, 2).transitionOut = { kind: "slide", durationMs: 300, easing: "linear", direction: "left" };
    });
    expect(documentIssue("video", d)).toBeNull();
  });

  it("refuses what the backend refuses", () => {
    const cases: Record<string, (d: VideoDocument) => void> = {
      "a plain dissolve": (d) => void (clipAt(d, 0, 2).transitionIn = { ...wipe, kind: "dissolve" as never }),
      "a sound crossfade": (d) => void (clipAt(d, 0, 2).transitionIn = { ...wipe, kind: "constantPower" as never }),
      "the slide side": (d) => void (clipAt(d, 0, 2).transitionIn = { kind: "slide", durationMs: 300, easing: "linear", moving: "in" }),
      "a fade on the same side": (d) => {
        clipAt(d, 0, 2).transitionIn = wipe;
        clipAt(d, 0, 2).fadeInMs = 200;
      },
      "a slide preset on the same side": (d) => {
        clipAt(d, 0, 2).transitionOut = wipe;
        clipAt(d, 0, 2).motionOut = { edge: "top", durationMs: 200 };
      },
      "edges longer than the clip": (d) => {
        clipAt(d, 0, 2).transitionIn = { ...wipe, durationMs: 800 };
        clipAt(d, 0, 2).fadeOutMs = 300;
      },
      "a hold curve": (d) => void (clipAt(d, 0, 2).transitionIn = { ...wipe, easing: "hold" }),
      "a length under the minimum": (d) => void (clipAt(d, 0, 2).transitionIn = { ...wipe, durationMs: 50 }),
      "an entrance on a sound": (d) => void (clipAt(d, 1, 0).transitionIn = wipe),
      "an entrance on a joined edge": (d) => {
        d.tracks[0].transitions = [dissolve];
        clipAt(d, 0, 1).transitionIn = wipe;
      },
      "an exit on a joined edge": (d) => {
        d.tracks[0].transitions = [dissolve];
        clipAt(d, 0, 0).transitionOut = wipe;
      },
      "a map and a picture together": (d) => void (d.tracks[0].transitions = [{ ...dissolve, kind: "gradientWipe", map: "linear", mapAssetId: "m-9" }]),
      "blinds with no width": (d) => void (d.tracks[0].transitions = [{ ...dissolve, kind: "venetianBlinds", size: 0 }]),
      "a size on a plain wipe": (d) => void (d.tracks[0].transitions = [{ ...dissolve, kind: "wipe", size: 0.1 }]),
      "an unknown field": (d) => void (clipAt(d, 0, 2).transitionIn = { ...wipe, speed: 2 } as never),
    };
    for (const [name, change] of Object.entries(cases)) expect(documentIssue("video", film(change)), name).not.toBeNull();
  });
});
