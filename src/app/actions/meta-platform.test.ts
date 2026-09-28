import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDataDeletionStatusAction } from "@/app/actions/meta-platform";

const apiClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/browser-client", () => ({ apiClient }));

beforeEach(() => {
  apiClient.mockReset();
});

describe("getDataDeletionStatusAction", () => {
  it("reads the public status by an encoded code", async () => {
    apiClient.mockResolvedValue({ data: { code: "a/b", status: "COMPLETED", requestedAt: "2026-09-01T00:00:00Z" } });

    const result = await getDataDeletionStatusAction("a/b");

    expect(apiClient).toHaveBeenCalledWith("/meta/data-deletion/a%2Fb", { method: "GET" });
    expect(result).toEqual({ request: { code: "a/b", status: "COMPLETED", requestedAt: "2026-09-01T00:00:00Z" } });
  });

  it("tells a missing request apart from a failure", async () => {
    apiClient.mockResolvedValue({ error: { message: "Deletion request not found", status: 404 } });
    expect(await getDataDeletionStatusAction("x")).toEqual({ notFound: true });

    apiClient.mockResolvedValue({ error: { message: "boom", status: 500 } });
    expect(await getDataDeletionStatusAction("x")).toEqual({ error: "boom" });
  });

  it("refuses an empty code without calling the server", async () => {
    expect(await getDataDeletionStatusAction("  ")).toEqual({ notFound: true });
    expect(apiClient).not.toHaveBeenCalled();
  });
});
