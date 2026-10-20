import { describe, expect, it } from "vitest";

import { RUN_STEPS_PAGE_SIZE, runStepsMeta, runStepsRequest } from "./run-steps";

describe("runStepsRequest", () => {
  it("asks for the steps a page at a time, 500 per page", () => {
    expect(RUN_STEPS_PAGE_SIZE).toBe(500);
    expect(runStepsRequest(1)).toEqual({ stepsOffset: 0, stepsLimit: 500 });
    expect(runStepsRequest(3)).toEqual({ stepsOffset: 1000, stepsLimit: 500 });
  });
});

describe("runStepsMeta", () => {
  it("turns the step window into a page the paged list can follow", () => {
    expect(runStepsMeta({ offset: 0, limit: 500, total: 1200, hasMore: true }, 500)).toEqual({
      page: 1,
      pageSize: 500,
      totalPages: 3,
      totalItems: 1200,
    });
    expect(runStepsMeta({ offset: 1000, limit: 500, total: 1200, hasMore: false }, 200)).toEqual({
      page: 3,
      pageSize: 500,
      totalPages: 3,
      totalItems: 1200,
    });
  });

  it("keeps a next page while the server says there is more, even when its total lags behind", () => {
    expect(runStepsMeta({ offset: 500, limit: 500, total: 900, hasMore: true }, 500).totalPages).toBe(3);
  });

  it("reads a detail without a window as one complete page", () => {
    expect(runStepsMeta(undefined, 12)).toEqual({ page: 1, pageSize: 12, totalPages: 1, totalItems: 12 });
  });
});
