import { describe, expect, it, vi } from "vitest";

import { createCatalogLoader, type CatalogAnswer } from "./variable-catalog-loader";

const READY: CatalogAnswer = { catalog: { variables: [], unreadable: 0 } };
const FAILED: CatalogAnswer = { error: "boom", code: "variables_failed" };

describe("createCatalogLoader", () => {
  it("reads each node once per draft revision", async () => {
    const read = vi.fn(async () => READY);
    const loader = createCatalogLoader(read);
    await loader.load({ workflowId: "w1", revision: 3 }, "n1");
    await loader.load({ workflowId: "w1", revision: 3 }, "n1");
    expect(read).toHaveBeenCalledTimes(1);
    await loader.load({ workflowId: "w1", revision: 4 }, "n1");
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("forgets a failed read so retry asks the backend again", async () => {
    const read = vi.fn<(workflowId: string, nodeId: string) => Promise<CatalogAnswer>>().mockResolvedValueOnce(FAILED).mockResolvedValueOnce(READY);
    const loader = createCatalogLoader(read);
    expect(await loader.load({ workflowId: "w1", revision: 1 }, "n1")).toEqual(FAILED);
    expect(await loader.load({ workflowId: "w1", revision: 1 }, "n1")).toEqual(READY);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("answers unavailable for a workflow that was never saved, without a request", async () => {
    const read = vi.fn(async () => READY);
    const loader = createCatalogLoader(read);
    expect(await loader.load({ workflowId: null, revision: null }, "n1")).toEqual({ unavailable: true });
    expect(read).not.toHaveBeenCalled();
  });

  it("knows a ready catalog synchronously, so a hover can label without waiting", async () => {
    const loader = createCatalogLoader(async () => READY);
    const draft = { workflowId: "w1", revision: 1 };
    expect(loader.peek(draft, "n1")).toBeNull();
    await loader.load(draft, "n1");
    expect(loader.peek(draft, "n1")).toEqual(READY.catalog);
  });
});
