import { act, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  panelProps: vi.fn(),
  departmentProps: vi.fn(),
  can: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/components/channels/channel-automation-panel", () => ({
  ChannelAutomationPanel: (props: Record<string, unknown>) => {
    mocks.panelProps(props);
    return <div data-testid="automation-panel" />;
  },
}));
vi.mock("@/components/dashboard/DepartmentAssignmentCard", () => ({
  DepartmentAssignmentCard: (props: Record<string, unknown>) => {
    mocks.departmentProps(props);
    return <div data-testid="department-card" />;
  },
}));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ can: mocks.can }) }));
vi.mock("@/app/actions/email-inboxes", () => ({ updateEmailInboxAction: mocks.update }));

import rawPt from "@/i18n/messages/pt.json";
import { inboxSettingsOf } from "@/lib/email/inbox-automation";
import type { EmailInbox } from "@/lib/email/types";
import { brandedMessages } from "@/test/branded-messages";

import { EmailInboxSettingsPanel } from "../inbox-settings-panel";

const pt = brandedMessages(rawPt);
const copy = pt.emailMarketing.inboxSettings;

const INBOX: EmailInbox = {
  id: "snd-1",
  workspaceId: "ws-1",
  name: "Vendas",
  address: "vendas@loja.com.br",
  departmentId: null,
  pipelineId: null,
  agentId: "ag-1",
  workflowId: null,
  enableAgentResponses: false,
  enableWorkflow: false,
  enableAnalysis: false,
  enableAutoStaging: false,
  enableAutoMemory: false,
  createdAt: "2026-10-22T10:00:00Z",
  updatedAt: "2026-10-22T10:00:00Z",
};

function lastProps(mock: ReturnType<typeof vi.fn>) {
  return mock.mock.calls.at(-1)?.[0] as Record<string, unknown> & Record<string, (...args: unknown[]) => Promise<Record<string, unknown>>>;
}

function renderPanel(inbox: EmailInbox = INBOX, onSaved = vi.fn()) {
  const view = render(
    <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
      <EmailInboxSettingsPanel inbox={inbox} onSaved={onSaved} />
    </NextIntlClientProvider>,
  );
  return { onSaved, ...view };
}

describe("EmailInboxSettingsPanel", () => {
  beforeEach(() => {
    mocks.panelProps.mockReset();
    mocks.departmentProps.mockReset();
    mocks.update.mockReset();
    mocks.can.mockReset();
    mocks.can.mockReturnValue(true);
  });

  it("uses the shared panel with analysis, staging, memory and automatic deals of the email channel", () => {
    renderPanel();
    const props = lastProps(mocks.panelProps);
    expect(props.account).toBe(INBOX);
    expect(props.showHandling).toBe(true);
    expect(props.dealEntryType).toBe("email");
    expect(props.translationNamespace).toBe("emailMarketing.inboxSettings");
    expect(props.readOnly).toBe(false);
    expect(mocks.can).toHaveBeenCalledWith("email_inboxes", "update");
  });

  it("warns that conversations without a department stay hidden from department operators", () => {
    const { unmount } = renderPanel();
    expect(screen.getByText(copy.noDepartmentTitle)).toBeInTheDocument();
    expect(screen.getByTestId("department-card")).toBeInTheDocument();
    unmount();
    renderPanel({ ...INBOX, departmentId: "dep-1" });
    expect(screen.queryByText(copy.noDepartmentTitle)).not.toBeInTheDocument();
  });

  it("saves one panel change as the full inbox body", async () => {
    const saved = { ...INBOX, enableAnalysis: true, pipelineId: "pl-1" };
    mocks.update.mockResolvedValue({ inbox: saved });
    const { onSaved } = renderPanel();
    let result: Record<string, unknown> = {};
    await act(async () => {
      result = await lastProps(mocks.panelProps).onSave("snd-1", { enableAnalysis: true });
    });
    expect(mocks.update).toHaveBeenCalledWith("snd-1", { ...inboxSettingsOf(INBOX), enableAnalysis: true });
    expect(onSaved).toHaveBeenCalledWith(saved);
    expect(result.account).toBe(saved);
  });

  it("builds the next change on the last saved inbox", async () => {
    const first = { ...INBOX, enableAnalysis: true };
    mocks.update.mockResolvedValueOnce({ inbox: first }).mockResolvedValueOnce({ inbox: { ...first, enableAutoMemory: true } });
    renderPanel();
    await act(async () => {
      await lastProps(mocks.panelProps).onSave("snd-1", { enableAnalysis: true });
      await lastProps(mocks.panelProps).onSave("snd-1", { enableAutoMemory: true });
    });
    expect(mocks.update).toHaveBeenLastCalledWith("snd-1", { ...inboxSettingsOf(first), enableAutoMemory: true });
  });

  it("assigns the department through the same body", async () => {
    mocks.update.mockResolvedValue({ inbox: { ...INBOX, departmentId: "dep-1" } });
    renderPanel();
    await act(async () => {
      await lastProps(mocks.departmentProps).onAssign("dep-1");
    });
    expect(mocks.update).toHaveBeenCalledWith("snd-1", { ...inboxSettingsOf(INBOX), departmentId: "dep-1" });
  });

  it("explains a refusal by its code", async () => {
    mocks.update.mockResolvedValue({ error: "reference does not belong to the workspace", code: "reference_not_in_workspace" });
    renderPanel();
    let result: Record<string, unknown> = {};
    await act(async () => {
      result = await lastProps(mocks.panelProps).onSave("snd-1", { agentId: "ag-2" });
    });
    expect(result.error).toBe(pt.emailMarketing.errors.reference_not_in_workspace);
  });

  it("is read only without the update permission and hidden without read", () => {
    mocks.can.mockImplementation((_resource: string, action: string) => action === "read");
    const { unmount } = renderPanel();
    expect(lastProps(mocks.panelProps).readOnly).toBe(true);
    expect(screen.queryByTestId("department-card")).not.toBeInTheDocument();
    unmount();
    mocks.can.mockReturnValue(false);
    renderPanel();
    expect(screen.queryByTestId("automation-panel")).not.toBeInTheDocument();
  });
});
