import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

const events = vi.hoisted(() => [
  {
    id: "ev-1",
    workspace_id: "ws-1",
    entry_id: "entry-1",
    entry_type: "email",
    event_type: "email_forward_skipped",
    actor_id: "system",
    actor_kind: "system",
    channel: "email",
    details: JSON.stringify({ reason: "balance_insufficient" }),
    created_at: "2026-10-21T12:00:00Z",
  },
]);

vi.mock("@/app/actions/conversations", () => ({
  listConversationEventsAction: vi.fn(async () => ({ events, page: 1, pageSize: 40, totalItems: 1, totalPages: 1 })),
}));
vi.mock("@/app/actions/workspace", () => ({
  listAssignableMembersAction: vi.fn(async () => ({ members: [], error: null })),
}));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws-1" } }) }));
vi.mock("@/hooks/use-outcome-capture", () => ({ useOutcomeCapture: () => ({ capture: null, loaded: true }) }));

import ConversationAttendanceSection from "../ConversationAttendanceSection";

const activity = ptMessages.crmContactPanel.activity;

describe("ConversationAttendanceSection skipped email forward", () => {
  it("names the skipped copy and why, without the raw reason", async () => {
    render(
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
        <ConversationAttendanceSection entryType="email" entryId="entry-1" />
      </NextIntlClientProvider>,
    );
    const title = await screen.findByText(activity.types.email_forward_skipped);
    expect(screen.getByText(activity.details.emailForwardSkipped.balance_insufficient)).toBeInTheDocument();
    expect(screen.queryByText(/balance_insufficient/)).toBeNull();
    expect(title.closest("li")?.querySelector("[class*=\"tile-\"]")?.className ?? "").toContain("tile-warning");
  });
});
