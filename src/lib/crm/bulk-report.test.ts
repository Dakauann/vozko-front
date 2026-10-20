import { describe, expect, it, vi } from "vitest";

import { reportBulkResult } from "./bulk-report";

function setup() {
  const toaster = { success: vi.fn(), warning: vi.fn() };
  const t = (key: string, values?: Record<string, number>) => `${key} ${JSON.stringify(values ?? {})}`;
  return { toaster, t };
}

describe("the bulk result toast", () => {
  it("summarises every per-conversation failure in one warning", () => {
    const { toaster, t } = setup();
    reportBulkResult(t, { succeeded: 3, failed: [{ entryId: "a", error: "x" }, { entryId: "b", error: "y" }], eligible: 5 }, toaster);
    expect(toaster.warning).toHaveBeenCalledTimes(1);
    expect(toaster.warning).toHaveBeenCalledWith('partial {"succeeded":3,"eligible":5,"failed":2}');
    expect(toaster.success).not.toHaveBeenCalled();
  });

  it("counts the eligible conversations from the outcome when the server leaves it out", () => {
    const { toaster, t } = setup();
    reportBulkResult(t, { succeeded: 1, failed: [{ entryId: "a", error: "x" }] }, toaster);
    expect(toaster.warning).toHaveBeenCalledWith('partial {"succeeded":1,"eligible":2,"failed":1}');
  });

  it("warns when the action stopped at the per-call limit", () => {
    const { toaster, t } = setup();
    reportBulkResult(t, { succeeded: 2000, failed: [], matched: 2400, truncated: true }, toaster);
    expect(toaster.warning).toHaveBeenCalledWith('truncated {"succeeded":2000,"matched":2400}');
  });

  it("confirms a clean run", () => {
    const { toaster, t } = setup();
    reportBulkResult(t, { succeeded: 4, failed: [] }, toaster);
    expect(toaster.success).toHaveBeenCalledWith('updated {"count":4}');
  });
});
