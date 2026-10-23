import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ download: vi.fn() }));
vi.mock("@/lib/api/browser-client", () => ({ apiClient: vi.fn() }));
vi.mock("@/lib/api/download-file", () => ({ downloadApiFile: (...args: unknown[]) => api.download(...args) }));

import { downloadWorkflowRunAction, downloadWorkflowRunsAction } from "../workflows";

beforeEach(() => {
  api.download.mockReset();
  api.download.mockResolvedValue({ error: null });
});

describe("run JSON downloads", () => {
  it("downloads one run through the scoped download with a JSON fallback name", async () => {
    expect(await downloadWorkflowRunAction("run/1")).toEqual({ error: null });
    expect(api.download).toHaveBeenCalledWith("/workflow-runs/run%2F1/export", "execucao-run/1.json", { accept: "application/json" });
  });

  it("exports the runs of a period with the list filters as NDJSON", async () => {
    await downloadWorkflowRunsAction("wf-1", { from: "2026-10-01T03:00:00.000Z", to: "2026-10-08T03:00:00.000Z", status: "error", entryId: "e-1" });
    const [path, fallback, options] = api.download.mock.calls[0];
    const url = new URL(`https://x${path}`);
    expect(url.pathname).toBe("/workflows/wf-1/runs/export");
    expect(Object.fromEntries(url.searchParams)).toEqual({ from: "2026-10-01T03:00:00.000Z", to: "2026-10-08T03:00:00.000Z", status: "error", entryId: "e-1" });
    expect(fallback).toBe("execucoes.ndjson");
    expect(options).toEqual({ accept: "application/x-ndjson" });
  });

  it("keeps the refusal code so the screen can translate it", async () => {
    const refusal = { status: 422, code: "export_too_large", message: "A exportação passa de 5.000 execuções" };
    api.download.mockResolvedValue({ error: refusal });
    expect(await downloadWorkflowRunsAction("wf-1", { from: "a", to: "b" })).toEqual({ error: refusal });
  });
});
