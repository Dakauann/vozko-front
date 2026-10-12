import { describe, expect, it } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { VIDEO_JOB_PURPOSES } from "./view-store";

describe("job labels", () => {
  it("names every kind of job Elo can follow", () => {
    const actions = ptMessages.studio.agent.actions as Record<string, string>;
    expect(VIDEO_JOB_PURPOSES.filter((purpose) => !actions[`job_${purpose}`])).toEqual([]);
  });
});
