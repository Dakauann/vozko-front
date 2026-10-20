import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

const events = vi.hoisted(() => [
  {
    id: "ev-1",
    workspace_id: "ws-1",
    entry_id: "entry-1",
    entry_type: "mercadolivre",
    event_type: "agent_reply_withheld",
    actor_id: "ai:agent-1",
    actor_kind: "ai",
    channel: "mercadolivre",
    details: JSON.stringify({ agent_id: "agent-1", reason: "channel_text_rules", violations: "charset", detail: "text has characters outside the channel charset" }),
    created_at: "2026-10-19T12:00:00Z",
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

describe("ConversationAttendanceSection withheld agent reply", () => {
  it("names the withheld reply and says the conversation went to a person, without the raw server detail", async () => {
    render(
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
        <ConversationAttendanceSection entryType="mercadolivre" entryId="entry-1" />
      </NextIntlClientProvider>,
    );
    const title = await screen.findByText(activity.types.agent_reply_withheld);
    expect(screen.getByText(activity.details.agentReplyWithheld)).toBeInTheDocument();
    expect(screen.queryByText(/channel_text_rules|outside the channel charset/)).toBeNull();
    expect(title.closest("li")?.querySelector("[class*=\"tile-\"]")?.className ?? "").toContain("tile-warning");
  });
});
