import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { BLEND_MODES } from "./document";
import { LUMA_KEY_MODES, LUMA_RANGES } from "./luma-key";
import { MATTE_CHANNELS } from "./matte";
import { documentIssue } from "./validate";

describe("the compositing contract shared with the server", () => {
  const fixture = JSON.parse(readFileSync(resolve(__dirname, "../../../../vozko-back/domain/studio/testdata/editor_compositing.json"), "utf8"));

  it("lists the same blend modes, luma key modes and ranges, and matte channels", () => {
    expect(fixture.blendModes).toEqual([...BLEND_MODES]);
    expect(fixture.lumaModes).toEqual([...LUMA_KEY_MODES]);
    expect(fixture.lumaRanges).toEqual({ threshold: [...LUMA_RANGES.threshold], softness: [...LUMA_RANGES.softness] });
    expect(fixture.matteChannels).toEqual([...MATTE_CHANNELS]);
  });

  it("accepts the shared document", () => {
    expect(documentIssue("video", fixture.valid)).toBeNull();
  });
});
