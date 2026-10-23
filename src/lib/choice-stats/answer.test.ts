import { describe, expect, it } from "vitest";

import { choiceStatsAnswer } from "./answer";
import { readPromptChoiceStats } from "./stats";

const body = {
  from: null,
  to: null,
  timezone: "UTC",
  prompt: { sends: 0, clickedPrompts: 0, clickRate: 0, freeText: { count: 0, rate: 0 }, options: [] },
};

describe("choiceStatsAnswer", () => {
  it("hands over a readable body", () => {
    expect(choiceStatsAnswer({ data: body }, readPromptChoiceStats)).toEqual({ status: "ready", stats: { ...body } });
  });

  it("marks a body it cannot read as unreadable instead of zeros", () => {
    expect(choiceStatsAnswer({ data: { prompt: {} } }, readPromptChoiceStats)).toEqual({ status: "unreadable" });
  });

  it("keeps the backend code and status of a refusal", () => {
    expect(choiceStatsAnswer({ error: { message: "nope", code: "invalid_period", status: 400 } }, readPromptChoiceStats)).toEqual({
      status: "failed",
      message: "nope",
      code: "invalid_period",
      httpStatus: 400,
    });
  });
});
