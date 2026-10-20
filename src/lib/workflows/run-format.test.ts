import { describe, expect, it } from "vitest";

import type { WorkflowRun, WorkflowRunLog } from "./types";
import { alertIdFromSearch, durationUnit, hasLiveRuns, isRunStatus, isTerminalRunStatus, nodeIdFromSearch, parseStartedBy, runDurationMs, runIdFromSearch, stepTabs, stepWaterfall, workflowHref, workflowNodeHref, workflowRunHref } from "./run-format";

function run(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    id: "r1",
    workflowId: "w1",
    workspaceId: "ws",
    entryId: "e1",
    entryType: "whatsapp",
    status: "completed",
    state: {},
    retryCount: 0,
    startedAt: "2026-10-19T10:00:00.000Z",
    updatedAt: "2026-10-19T10:00:05.000Z",
    completedAt: "2026-10-19T10:00:02.500Z",
    ...overrides,
  };
}

function log(overrides: Partial<WorkflowRunLog> = {}): WorkflowRunLog {
  return {
    id: "l1",
    runId: "r1",
    nodeId: "n1",
    nodeType: "action_code",
    status: "executed",
    executedAt: "2026-10-19T10:00:01.000Z",
    attempt: 1,
    durationMs: 0,
    ...overrides,
  };
}

describe("parseStartedBy", () => {
  it.each([
    ["agent:ag-1", { kind: "agent", ref: "ag-1" }],
    ["webhook:dl-9", { kind: "webhook", ref: "dl-9" }],
    ["exit:msg-3", { kind: "exit", ref: "msg-3" }],
    ["manual:user-2", { kind: "manual", ref: "user-2" }],
    ["trigger:trigger_webhook", { kind: "trigger", ref: "trigger_webhook" }],
  ])("splits %s into who started the run and its reference", (raw, expected) => {
    expect(parseStartedBy(raw)).toEqual(expected);
  });

  it.each([undefined, "", "robot:1", "agent"])("returns null for %s so the list shows n/d instead of guessing", (raw) => {
    expect(parseStartedBy(raw)).toBeNull();
  });
});

describe("isTerminalRunStatus", () => {
  it("only lets running and waiting runs be cancelled", () => {
    expect(isTerminalRunStatus("running")).toBe(false);
    expect(isTerminalRunStatus("waiting")).toBe(false);
    expect(isTerminalRunStatus("completed")).toBe(true);
    expect(isTerminalRunStatus("error")).toBe(true);
    expect(isTerminalRunStatus("cancelled")).toBe(true);
  });
});

describe("isRunStatus", () => {
  it("accepts only the statuses a run can have, so an unknown handler status shows no chip", () => {
    for (const status of ["running", "waiting", "completed", "error", "cancelled"]) expect(isRunStatus(status)).toBe(true);
    expect(isRunStatus("paused")).toBe(false);
    expect(isRunStatus(undefined)).toBe(false);
    expect(isRunStatus("")).toBe(false);
  });
});

describe("hasLiveRuns", () => {
  it("is true while any listed run is running or waiting, so the list keeps refreshing", () => {
    expect(hasLiveRuns([run(), run({ id: "r2", status: "waiting" })])).toBe(true);
    expect(hasLiveRuns([run({ status: "running" })])).toBe(true);
  });

  it("is false when every listed run is over, so the list stops refreshing", () => {
    expect(hasLiveRuns([run(), run({ status: "error" }), run({ status: "cancelled" })])).toBe(false);
    expect(hasLiveRuns([])).toBe(false);
  });
});

describe("runDurationMs", () => {
  it("measures a finished run from start to completion", () => {
    expect(runDurationMs(run())).toBe(2500);
  });

  it("has no duration while the run is still going", () => {
    expect(runDurationMs(run({ status: "waiting", completedAt: undefined }))).toBeNull();
  });

  it("has no duration when a timestamp cannot be read", () => {
    expect(runDurationMs(run({ startedAt: "nope" }))).toBeNull();
  });
});

describe("durationUnit", () => {
  it.each([
    [0, { value: 0, unit: "millisecond", maximumFractionDigits: 0 }],
    [850, { value: 850, unit: "millisecond", maximumFractionDigits: 0 }],
    [1250, { value: 1.25, unit: "second", maximumFractionDigits: 1 }],
    [125000, { value: 125000 / 60000, unit: "minute", maximumFractionDigits: 1 }],
    [7200000, { value: 2, unit: "hour", maximumFractionDigits: 1 }],
  ])("picks a readable unit for %i ms", (ms, expected) => {
    expect(durationUnit(ms)).toEqual(expected);
  });
});

describe("stepWaterfall", () => {
  it("places each bar at its start and sizes it by its duration, to the scale of the whole run", () => {
    const bars = stepWaterfall([
      log({ startedAt: "2026-10-19T10:00:00.000Z", finishedAt: "2026-10-19T10:00:01.000Z", durationMs: 1000 }),
      log({ startedAt: "2026-10-19T10:00:01.000Z", finishedAt: "2026-10-19T10:00:04.000Z", durationMs: 3000 }),
    ]);

    expect(bars).toEqual([
      { offsetPct: 0, widthPct: 25 },
      { offsetPct: 25, widthPct: 75 },
    ]);
  });

  it("falls back to the execution time minus the duration for steps recorded before the trace model", () => {
    const bars = stepWaterfall([
      log({ executedAt: "2026-10-19T10:00:02.000Z", durationMs: 2000 }),
      log({ executedAt: "2026-10-19T10:00:04.000Z", durationMs: 2000 }),
    ]);

    expect(bars).toEqual([
      { offsetPct: 0, widthPct: 50 },
      { offsetPct: 50, widthPct: 50 },
    ]);
  });

  it("keeps instant steps visible with a minimum width", () => {
    const bars = stepWaterfall([
      log({ startedAt: "2026-10-19T10:00:00.000Z", finishedAt: "2026-10-19T10:00:00.000Z", durationMs: 0 }),
      log({ startedAt: "2026-10-19T10:00:00.000Z", finishedAt: "2026-10-19T10:00:10.000Z", durationMs: 10000 }),
    ]);

    expect(bars[0].widthPct).toBeGreaterThan(0);
    expect(bars[1]).toEqual({ offsetPct: 0, widthPct: 100 });
  });

  it("scales to the whole run, so the bars of a loaded page stay put when a later page of steps arrives", () => {
    const span = run({ startedAt: "2026-10-19T10:00:00.000Z", completedAt: "2026-10-19T10:00:04.000Z" });
    const first = [log({ startedAt: "2026-10-19T10:00:01.000Z", finishedAt: "2026-10-19T10:00:02.000Z", durationMs: 1000 })];
    const later = [log({ id: "l2", startedAt: "2026-10-19T10:00:02.000Z", finishedAt: "2026-10-19T10:00:04.000Z", durationMs: 2000 })];

    expect(stepWaterfall(first, span)).toEqual([{ offsetPct: 25, widthPct: 25 }]);
    expect(stepWaterfall([...first, ...later], span)).toEqual([
      { offsetPct: 25, widthPct: 25 },
      { offsetPct: 50, widthPct: 50 },
    ]);
  });

  it("stretches past the run end when a live run has steps after it", () => {
    const live = run({ status: "running", startedAt: "2026-10-19T10:00:00.000Z", completedAt: undefined });
    const bars = stepWaterfall([log({ startedAt: "2026-10-19T10:00:02.000Z", finishedAt: "2026-10-19T10:00:04.000Z", durationMs: 2000 })], live);
    expect(bars).toEqual([{ offsetPct: 50, widthPct: 50 }]);
  });

  it("does not let a minimum width spill past the end of the track", () => {
    const bars = stepWaterfall([
      log({ startedAt: "2026-10-19T10:00:00.000Z", finishedAt: "2026-10-19T10:00:10.000Z", durationMs: 10000 }),
      log({ startedAt: "2026-10-19T10:00:10.000Z", finishedAt: "2026-10-19T10:00:10.000Z", durationMs: 0 }),
    ]);

    expect(bars[1].offsetPct + bars[1].widthPct).toBeLessThanOrEqual(100);
  });

  it("returns nothing for no steps", () => {
    expect(stepWaterfall([])).toEqual([]);
  });
});

describe("workflowHref", () => {
  it("opens the workflow editor, escaping the id", () => {
    expect(workflowHref("w 1")).toBe("/dashboard/workflows/w%201");
  });
});

describe("workflowRunHref", () => {
  it("opens the editor with the run selected, so links from the CRM land on the run detail", () => {
    expect(workflowRunHref("wf 1", "run/2")).toBe("/dashboard/workflows/wf%201?run=run%2F2");
  });

  it("reads the run back from the editor URL", () => {
    expect(runIdFromSearch("?run=run%2F2&x=1")).toBe("run/2");
    expect(runIdFromSearch("")).toBeNull();
  });

  it("reads an alert from the editor URL, so a notification can open the Alertas panel on it", () => {
    expect(alertIdFromSearch("?alert=al%201&run=r")).toBe("al 1");
    expect(alertIdFromSearch("?alert=")).toBeNull();
    expect(alertIdFromSearch("")).toBeNull();
  });
});

describe("workflowNodeHref", () => {
  it("opens the editor on a node, so a fix from the list lands on its config", () => {
    expect(workflowNodeHref("wf 1", "n/2")).toBe("/dashboard/workflows/wf%201?node=n%2F2");
  });

  it("reads the node back from the editor URL", () => {
    expect(nodeIdFromSearch("?node=n%2F2&run=r")).toBe("n/2");
    expect(nodeIdFromSearch("?node=")).toBeNull();
    expect(nodeIdFromSearch("")).toBeNull();
  });
});

describe("stepTabs", () => {
  it("hides every tab that has no data", () => {
    expect(stepTabs(log())).toEqual([]);
    expect(stepTabs(log({ input: {}, output: {}, errorChain: [], http: [], scriptLogs: [] }))).toEqual([]);
  });

  it("lists the tabs in reading order when the step recorded everything", () => {
    expect(
      stepTabs(
        log({
          input: { url: "x" },
          output: { status_code: 500 },
          error: "boom",
          http: [{ method: "GET", url: "x", latencyMs: 1 }],
          scriptLogs: [{ level: "info", message: "oi" }],
        }),
      ),
    ).toEqual(["input", "output", "error", "http", "logs"]);
  });

  it("shows the error tab for a classified error even without a message", () => {
    expect(stepTabs(log({ errorKind: "timeout" }))).toEqual(["error"]);
  });
});
