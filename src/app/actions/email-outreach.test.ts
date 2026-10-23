import { beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({ apiClient: vi.fn() }));

vi.mock("@/lib/api/browser-client", () => ({ apiClient: client.apiClient }));

import { quoteEmailOutreachAction, startEmailConversationAction } from "@/app/actions/email-outreach";

const STARTED = { conversation_id: "conv-1", entry_type: "email", message_id: "m-1", lead_id: "lead-1", repeated: false, recorded: true };

beforeEach(() => {
  client.apiClient.mockReset();
});

describe("startEmailConversationAction", () => {
  it("posts the composition with its idempotency key in the body", async () => {
    client.apiClient.mockResolvedValue({ data: STARTED });
    const payload = { lead_id: "lead-1", subject: "Oi", text: "Olá {{first_name}}", idempotency_key: "key-1" };

    const result = await startEmailConversationAction(payload);

    expect(client.apiClient).toHaveBeenCalledWith("/email/outreach/conversations", { method: "POST", body: JSON.stringify(payload) });
    expect(result).toEqual({ conversation: STARTED, error: null });
  });

  it("returns the coded refusal with its details", async () => {
    client.apiClient.mockResolvedValue({ error: { message: "short", status: 402, code: "email_balance_insufficient", details: { missing_micros: 700 } } });

    const result = await startEmailConversationAction({ address: "ana@loja.com", subject: "Oi", design_id: "d-1", idempotency_key: "key-2" });

    expect(result).toEqual({
      conversation: null,
      error: { code: "email_balance_insufficient", message: "short", status: 402, details: { missing_micros: 700 } },
    });
  });

  it("falls back to the send failure code when the refusal has none", async () => {
    client.apiClient.mockResolvedValue({ error: { message: "boom", status: 500 } });

    const result = await startEmailConversationAction({ address: "ana@loja.com", subject: "Oi", text: "x", idempotency_key: "key-3" });

    expect(result.error?.code).toBe("email_send_failed");
  });

  it("treats an empty answer as a failed send", async () => {
    client.apiClient.mockResolvedValue({});

    const result = await startEmailConversationAction({ address: "ana@loja.com", subject: "Oi", text: "x", idempotency_key: "key-4" });

    expect(result).toEqual({ conversation: null, error: { code: "email_send_failed", message: "" } });
  });
});

describe("quoteEmailOutreachAction", () => {
  it("reads the price of one email", async () => {
    const quote = { unit_micros: 700, unit_brl: 0.0035, exchange_rate: 5, exchange_rate_updated_at: "2026-10-21T10:00:00Z" };
    client.apiClient.mockResolvedValue({ data: quote });

    const result = await quoteEmailOutreachAction();

    expect(client.apiClient).toHaveBeenCalledWith("/email/outreach/quote", { method: "GET", signal: undefined });
    expect(result).toEqual({ quote, error: null });
  });

  it("returns the coded pricing refusal", async () => {
    client.apiClient.mockResolvedValue({ error: { message: "no rate", status: 503, code: "email_exchange_rate_unavailable" } });

    const result = await quoteEmailOutreachAction();

    expect(result).toEqual({ quote: null, error: { code: "email_exchange_rate_unavailable", message: "no rate", status: 503 } });
  });

  it("falls back to the pricing failure code", async () => {
    client.apiClient.mockResolvedValue({});

    const result = await quoteEmailOutreachAction();

    expect(result).toEqual({ quote: null, error: { code: "email_pricing_failed", message: "" } });
  });
});
