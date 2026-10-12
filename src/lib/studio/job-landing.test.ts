import { describe, expect, it } from "vitest";

import type { MediaGenerationJob } from "@/lib/media-generation/types";

import { jobLanding, jobStartAsset } from "./job-landing";

const queued = (patch: Partial<MediaGenerationJob>): MediaGenerationJob => ({ id: "j", kind: "cutout", status: "queued", referenceMediaIds: [], createdAt: "", updatedAt: "", ...patch });

describe("the asset a job started from", () => {
  it("is the source of a processing job, asked or queued", () => {
    expect(jobStartAsset({ kind: "cutout", sourceMediaId: "foto" })).toBe("foto");
    expect(jobStartAsset({ kind: "denoise", sourceMediaId: "som" })).toBe("som");
    expect(jobStartAsset(queued({ sourceMediaId: "foto" }))).toBe("foto");
  });

  it("is the first reference of an AI edit", () => {
    expect(jobStartAsset({ kind: "image", model: "m", prompt: "p", aspect: "square", referenceMediaIds: ["foto", "estilo"] })).toBe("foto");
    expect(jobStartAsset(queued({ kind: "image", referenceMediaIds: ["foto", "estilo"] }))).toBe("foto");
  });

  it("is unknown for a generation from nothing or a job that does not say", () => {
    expect(jobStartAsset({ kind: "image", model: "m", prompt: "p", aspect: "square" })).toBeNull();
    expect(jobStartAsset({ kind: "music", model: "m", prompt: "p" })).toBeNull();
    expect(jobStartAsset(queued({}))).toBeNull();
    expect(jobStartAsset(null)).toBeNull();
  });
});

describe("where a job result lands", () => {
  it("replaces the target only while it still shows the asset the job started from", () => {
    expect(jobLanding("foto", "foto")).toBe("inPlace");
  });

  it("never overwrites a target whose picture was replaced while the job ran", () => {
    expect(jobLanding("foto", "outra")).toBe("targetChanged");
    expect(jobLanding("foto", null)).toBe("targetChanged");
  });

  it("fails closed when the job does not say what it started from", () => {
    expect(jobLanding(null, "foto")).toBe("targetChanged");
    expect(jobLanding(undefined, undefined)).toBe("targetChanged");
  });
});
