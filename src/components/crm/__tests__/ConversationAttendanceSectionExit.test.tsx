import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

const events = vi.hoisted(() => [
  {
    id: "ev-1",
    workspace_id: "ws-1",
    entry_id: "entry-1",
    entry_type: "whatsapp",
    event_type: "lead_exit_action",
    actor_id: "system",
    actor_kind: "system",
    channel: "whatsapp",
    details: JSON.stringify({ trigger: "button", kind: "opt_out", outcome: "changed", button_text: "SAIR", confirmation: "sent", lead_id: "lead-1" }),
    created_at: "2026-10-16T19:59:00Z",
  },
  {
    id: "ev-2",
    workspace_id: "ws-1",
    entry_id: "entry-1",
    entry_type: "whatsapp",
    event_type: "lead_send_refused",
    actor_id: "system",
    actor_kind: "system",
    details: JSON.stringify({ reason: "lead_opted_out", workflow_id: "wf-1" }),
    created_at: "2026-10-16T19:59:10Z",
  },
  {
    id: "ev-3",
    workspace_id: "ws-1",
    entry_id: "entry-1",
    entry_type: "whatsapp",
    event_type: "lead_exit_action",
    actor_id: "system",
    actor_kind: "system",
    details: JSON.stringify({ trigger: "button", kind: "opt_out", outcome: "failed", button_text: "PARAR", reason: "lead_exit_action_failed" }),
    created_at: "2026-10-16T19:59:20Z",
  },
]);

vi.mock("@/app/actions/conversations", () => ({
  listConversationEventsAction: vi.fn(async () => ({ events, page: 1, pageSize: 40, totalItems: 3, totalPages: 1 })),
}));
vi.mock("@/app/actions/workspace", () => ({
  listAssignableMembersAction: vi.fn(async () => ({ members: [], error: null })),
}));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws-1" } }) }));
vi.mock("@/hooks/use-outcome-capture", () => ({ useOutcomeCapture: () => ({ capture: null, loaded: true }) }));

import ConversationAttendanceSection from "../ConversationAttendanceSection";

const types = ptMessages.crmContactPanel.activity.types;
const exitCopy = ptMessages.leadExit.events;

describe("ConversationAttendanceSection exit lines", () => {
  it("renders the exit tap and the refused workflow send as conversation lines", async () => {
    render(
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
        <ConversationAttendanceSection entryType="whatsapp" entryId="entry-1" />
      </NextIntlClientProvider>,
    );
    expect(await screen.findAllByText(types.lead_exit_action)).toHaveLength(2);
    expect(screen.getByText("Tocou SAIR: opt-out registrado")).toBeInTheDocument();
    expect(screen.getByText(exitCopy.confirmation.sent)).toBeInTheDocument();
    expect(screen.getByText(types.lead_send_refused)).toBeInTheDocument();
    expect(screen.getByText(exitCopy.sendRefused.lead_opted_out)).toBeInTheDocument();
    expect(screen.queryByText(/lead-1/)).toBeNull();
  });

  it("colours each exit line by what happened, so a failed exit never looks healthy", async () => {
    render(
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
        <ConversationAttendanceSection entryType="whatsapp" entryId="entry-1" />
      </NextIntlClientProvider>,
    );
    const tileOf = (line: HTMLElement) => line.closest("li")?.querySelector("[class*=\"tile-\"]")?.className ?? "";
    expect(tileOf(await screen.findByText("Tocou SAIR: opt-out registrado"))).toContain("tile-healthy");
    expect(tileOf(screen.getByText(`Tocou PARAR: ${exitCopy.failed}`))).toContain("tile-warning");
    expect(tileOf(screen.getByText(`Tocou PARAR: ${exitCopy.failed}`))).not.toContain("tile-healthy");
    expect(tileOf(screen.getByText(exitCopy.sendRefused.lead_opted_out))).toContain("tile-warning");
  });
});
