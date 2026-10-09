import { beforeEach, describe, expect, it, vi } from "vitest";

const apiClient = vi.fn();
vi.mock("@/lib/api/browser-client", () => ({ apiClient: (...args: unknown[]) => apiClient(...args) }));

import { fetchDialTargets } from "./sip-trunks";
import { DialTargetsError } from "@/lib/dialer/dial-targets";

describe("fetchDialTargets", () => {
  beforeEach(() => apiClient.mockReset());

  it("asks for the numbers and lines of one lead with the caller's signal", async () => {
    apiClient.mockResolvedValue({
      data: { leadId: "lead 1", numbers: [{ number: "5584994409684", identity: true }], trunks: [{ id: "t1", name: "Matriz" }] },
    });
    const controller = new AbortController();

    const out = await fetchDialTargets("lead 1", controller.signal);

    const [url, init] = apiClient.mock.calls[0];
    expect(url).toBe("/dial-targets?leadId=lead%201");
    expect(init).toMatchObject({ method: "GET", signal: controller.signal });
    expect(out).toEqual({ leadId: "lead 1", numbers: [{ number: "5584994409684", identity: true }], trunks: [{ id: "t1", name: "Matriz" }] });
  });

  it("asks only for the lines when no lead is named", async () => {
    apiClient.mockResolvedValue({ data: { leadId: "", numbers: [], trunks: [], trunkRefusal: "no_dialable_trunk" } });

    const out = await fetchDialTargets(null);

    expect(apiClient.mock.calls[0][0]).toBe("/dial-targets");
    expect(out.trunkRefusal).toBe("no_dialable_trunk");
  });

  it("raises why the answer could not be read", async () => {
    apiClient.mockResolvedValue({ error: { message: "nope", status: 403, code: "forbidden" } });
    await expect(fetchDialTargets("lead-1")).rejects.toMatchObject({ failure: "forbidden", status: 403 });

    apiClient.mockResolvedValue({ error: { message: "down", status: 503, code: "not_configured" } });
    const failure = await fetchDialTargets("lead-1").catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(DialTargetsError);
    expect(failure).toMatchObject({ failure: "unavailable", status: 503 });
  });

  it("refuses an empty answer instead of reading it as callable", async () => {
    apiClient.mockResolvedValue({ data: undefined });
    await expect(fetchDialTargets("lead-1")).rejects.toMatchObject({ failure: "unavailable" });
  });
});
