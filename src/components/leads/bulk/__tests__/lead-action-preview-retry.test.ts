import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/lead-actions", () => ({ previewLeadActionAction: vi.fn(), getLeadActionPreviewAction: vi.fn() }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws-1" } }) }));

import { sectionRetryDelay, shouldRetrySection } from "@/lib/analytics/section-query";

import { LeadActionPreviewError } from "../use-lead-action-preview";

describe("preview retries", () => {
  it("retries a busy gate after its Retry-After, and a server failure once", () => {
    const busy = new LeadActionPreviewError({ status: 503 });
    expect(shouldRetrySection(0, busy)).toBe(true);
    expect(shouldRetrySection(3, busy)).toBe(false);
    expect(sectionRetryDelay(0, busy)).toBe(5_000);
    expect(shouldRetrySection(0, new LeadActionPreviewError({ status: 502 }))).toBe(true);
    expect(shouldRetrySection(1, new LeadActionPreviewError({ status: 502 }))).toBe(false);
  });

  it("never retries a refusal the server explained", () => {
    expect(shouldRetrySection(0, new LeadActionPreviewError({ status: 503, code: "lead_actions_unavailable" }))).toBe(false);
    expect(shouldRetrySection(0, new LeadActionPreviewError({ status: 413, code: "lead_action_selection_too_large" }))).toBe(false);
    expect(shouldRetrySection(0, new LeadActionPreviewError({ status: 403, code: "forbidden" }))).toBe(false);
  });
});
