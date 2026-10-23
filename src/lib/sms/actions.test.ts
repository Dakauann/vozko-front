import { beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({ apiClient: vi.fn() }));

vi.mock("@/lib/api/browser-client", () => ({ apiClient: client.apiClient }));

import { checkSmsTextAction, smsTextToGsmAction } from "@/app/actions/sms";

beforeEach(() => {
  client.apiClient.mockReset();
});

describe("SMS text actions", () => {
  it("asks the backend to measure a text on a route", async () => {
    const check = {
      measurement: { encoding: "gsm7", units: 12, segments: 1, per_segment: 160, remaining: 148 },
      composed_text: "Loja: Oi",
      variable_slots: 0,
      issues: [],
      price: { charge_kind: "sms_segment", unit_micros: 45000, quantity: 1, total_micros: 45000 },
    };
    client.apiClient.mockResolvedValue({ data: check });
    const controller = new AbortController();
    const result = await checkSmsTextAction({ text: "Oi", route_id: "rt-1" }, controller.signal);
    expect(client.apiClient).toHaveBeenCalledWith("/sms/text/check", { method: "POST", body: JSON.stringify({ text: "Oi", route_id: "rt-1" }), signal: controller.signal });
    expect(result.data).toEqual(check);
  });

  it("asks the backend to remove the accents", async () => {
    client.apiClient.mockResolvedValue({ data: { text: "Ola" } });
    const result = await smsTextToGsmAction({ text: "Olá" });
    expect(client.apiClient).toHaveBeenCalledWith("/sms/text/to-gsm", { method: "POST", body: JSON.stringify({ text: "Olá" }) });
    expect(result.data).toEqual({ text: "Ola" });
  });
});
