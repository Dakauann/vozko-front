import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { emptyVideoDocument } from "../document";
import type { LottieAnimation } from "../lottie/lottie-types";
import { findClip } from "../timeline";
import { parseDocument } from "../validate";
import { planBatch } from "./batch";
import type { LottieLookup } from "./lottie-ops";
import { applyVideoOperation, VIDEO_ID_FIELDS, videoIds, type VideoOpContext, type VideoOperation } from "./video-ops";

const FIXTURES = join(process.cwd(), "..", "vozko-back", "domain", "studio", "testdata", "lottie");

function animation(name: string): LottieAnimation {
  return JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), "utf8")) as LottieAnimation;
}

const LOOKUP: LottieLookup = (id) => {
  if (id === "m-logo") return { name: "Logo", animation: animation("keyframes") };
  if (id === "m-refused") return { name: "Recusado", animation: animation("unsupported") };
  if (id === "m-broken") return { name: "Quebrado", animation: null, fault: "brokenArchive" };
  return undefined;
};

const CTX: VideoOpContext = {
  playheadMs: 700,
  magnetic: false,
  mediaType: () => null,
  sourceDuration: () => undefined,
  captions: () => undefined,
  captionTrackName: "Legendas",
  icons: [],
  speech: () => undefined,
  loudness: () => undefined,
  lottie: LOOKUP,
};

function run(ops: VideoOperation[]) {
  return planBatch(emptyVideoDocument("story"), ops, (doc, op) => applyVideoOperation(doc, op, CTX), VIDEO_ID_FIELDS, videoIds);
}

describe("Elo imports a Lottie file from the library", () => {
  it("inserts the converted group at the playhead and reports its id", () => {
    const plan = run([{ op: "import_lottie", ref: "logo", media_id: "m-logo" }]);
    if (!plan.ok) throw new Error(plan.reason);
    const found = findClip(plan.final, plan.created.logo[0])!;
    expect(found.clip).toMatchObject({ type: "group", name: "Logo", startMs: 700 });
    expect(parseDocument("video", plan.final).ok).toBe(true);
  });

  it("refuses with the list of what the file uses that cannot become clips", () => {
    const plan = run([{ op: "import_lottie", media_id: "m-refused" }]);
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.reason).toContain("Tremida: expressões");
    expect(plan.reason).toContain("Foto: camadas de imagem");
  });

  it("refuses unknown media, broken archives and a missing media_id", () => {
    for (const [media_id, text] of [["m-nope", "não está na biblioteca"], ["m-broken", "corrompido"], ["", "precisa de media_id"]] as const) {
      const plan = run([{ op: "import_lottie", media_id }]);
      expect(plan.ok).toBe(false);
      if (!plan.ok) expect(plan.reason).toContain(text);
    }
  });
});
