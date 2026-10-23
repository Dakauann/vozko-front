import { describe, expect, it } from "vitest";

import { defaultRunsExportRange, runsExportQuery, stepJsonText } from "./run-export";
import type { WorkflowRunLog } from "./types";

describe("runsExportQuery", () => {
  it("sends the chosen days as local midnights with the end day included", () => {
    expect(runsExportQuery({ dateFrom: "2026-10-01", dateTo: "2026-10-07" }, {})).toEqual({
      from: new Date(2026, 9, 1).toISOString(),
      to: new Date(2026, 9, 8).toISOString(),
    });
  });

  it("carries the list filters the panel already shows", () => {
    expect(runsExportQuery({ dateFrom: "2026-10-01", dateTo: "2026-10-01" }, { status: "error", entryId: "e-1" })).toMatchObject({
      status: "error",
      entryId: "e-1",
    });
  });

  it("leaves the period rules to the backend and only refuses a day it cannot read", () => {
    expect(runsExportQuery({ dateFrom: "2026-10-09", dateTo: "2026-10-01" }, {})).not.toBeNull();
    expect(runsExportQuery({ dateFrom: "", dateTo: "2026-10-01" }, {})).toBeNull();
    expect(runsExportQuery({ dateFrom: "2026-10-01", dateTo: "amanhã" }, {})).toBeNull();
  });
});

describe("defaultRunsExportRange", () => {
  it("offers the last seven days ending today", () => {
    expect(defaultRunsExportRange(new Date(2026, 9, 22, 15))).toEqual({ dateFrom: "2026-10-16", dateTo: "2026-10-22" });
  });
});

describe("stepJsonText", () => {
  const step = { id: "s1", runId: "r1", nodeId: "http", nodeType: "action_http_request", status: "executed", executedAt: "", attempt: 1, durationMs: 3 } as WorkflowRunLog;

  it("copies the parameters used and the output exactly as loaded", () => {
    const text = stepJsonText({ ...step, input: { url: "https://api", token: "••••" }, output: { status: 200 } });
    expect(JSON.parse(text)).toEqual({ input: { url: "https://api", token: "••••" }, output: { status: 200 } });
  });

  it("writes null for a side the step did not record", () => {
    expect(JSON.parse(stepJsonText(step))).toEqual({ input: null, output: null });
  });
});
