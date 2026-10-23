import { describe, expect, it } from "vitest";

import { EMAIL_LOG_STATUSES, type EmailWebhookEndpoint } from "@/lib/email-api/types";

import { emailLogEntryPath, endpointHealth, logStatusTone, sendCurl } from "./presentation";

const endpoint: EmailWebhookEndpoint = {
  id: "e-1",
  url: "https://hooks.acme.com",
  events: ["email.delivered"],
  enabled: true,
  secret_hint: "abcd",
  failing_since: null,
  last_success_at: null,
  last_failure_at: null,
  created_at: "2026-10-22T00:00:00Z",
  updated_at: "2026-10-22T00:00:00Z",
};

describe("email API presentation", () => {
  it("gives every log status a tone", () => {
    for (const status of EMAIL_LOG_STATUSES) expect(logStatusTone(status)).toBeTruthy();
    expect(logStatusTone("delivered")).toBe("healthy");
    expect(logStatusTone("bounced")).toBe("fault");
  });

  it("reads endpoint health from what the backend reports", () => {
    expect(endpointHealth(endpoint)).toBe("healthy");
    expect(endpointHealth({ ...endpoint, failing_since: "2026-10-22T01:00:00Z" })).toBe("failing");
    expect(endpointHealth({ ...endpoint, enabled: false, failing_since: "2026-10-22T01:00:00Z" })).toBe("paused");
  });

  it("builds a curl sample on the configured API address with a quoted body", () => {
    const curl = sendCurl({ baseUrl: "https://api.example.com/", from: "no-reply@loja.com", to: "ana@cliente.com", subject: "Seu código", html: "<p>It's 123</p>", idempotencyKey: "reset-1" });
    expect(curl.startsWith("curl -X POST https://api.example.com/email/transactional/messages \\")).toBe(true);
    expect(curl).toContain('"idempotency_key": "reset-1"');
    expect(curl).toContain("It'\\''s 123");
    expect(curl).not.toMatch(/[–—]/);
  });

  it("links a log entry by its id", () => {
    expect(emailLogEntryPath("a b")).toBe("/dashboard/email/api/a%20b");
  });
});
