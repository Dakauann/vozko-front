import { act, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  panelProps: vi.fn(),
  departmentProps: vi.fn(),
  disclosureProps: vi.fn(),
  can: vi.fn(),
}));

vi.mock("@/components/channels/channel-automation-panel", () => ({
  ChannelAutomationPanel: (props: Record<string, unknown>) => {
    mocks.panelProps(props);
    return <div data-testid="automation-panel" />;
  },
}));
vi.mock("@/components/channels/automation-disclosure-editor", () => ({
  AutomationDisclosureEditor: (props: Record<string, unknown>) => {
    mocks.disclosureProps(props);
    return <div data-testid="disclosure" />;
  },
}));
vi.mock("@/components/dashboard/DepartmentAssignmentCard", () => ({
  DepartmentAssignmentCard: (props: Record<string, unknown>) => {
    mocks.departmentProps(props);
    return <div data-testid="department-card" />;
  },
}));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ can: mocks.can }) }));
vi.mock("@/hooks/use-exchange-rate", () => ({ useExchangeRate: () => null }));

import rawPt from "@/i18n/messages/pt.json";
import type { CarrierInboxSettings } from "@/lib/carrier-messaging/types";
import { automationFixture } from "@/lib/carrier-messaging/test-fixtures";
import { brandedMessages } from "@/test/branded-messages";

import { CarrierInboxSettingsPanel } from "./CarrierInboxSettings";

const pt = brandedMessages(rawPt);
const copy = pt.carrierMessaging.automation;

const SETTINGS: CarrierInboxSettings = { department_id: null, pipeline_id: null, automation: { ...automationFixture(), agent_id: "ag-1" } };

function lastProps(mock: ReturnType<typeof vi.fn>) {
  return mock.mock.calls.at(-1)?.[0] as Record<string, (...args: unknown[]) => Promise<Record<string, unknown>>>;
}

function renderPanel(save = vi.fn(), onSaved = vi.fn()) {
  render(
    <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
      <CarrierInboxSettingsPanel ownerId="snd-1" settings={SETTINGS} save={save} onSaved={onSaved} controlId="rcs" />
    </NextIntlClientProvider>,
  );
  return { save, onSaved };
}

describe("CarrierInboxSettingsPanel", () => {
  beforeEach(() => {
    mocks.panelProps.mockReset();
    mocks.departmentProps.mockReset();
    mocks.disclosureProps.mockReset();
    mocks.can.mockReset();
    mocks.can.mockReturnValue(true);
  });

  it("warns that conversations without a department stay hidden from department operators", () => {
    renderPanel();
    expect(screen.getByText(copy.noDepartmentTitle)).toBeInTheDocument();
    expect(screen.getByTestId("department-card")).toBeInTheDocument();
    expect(lastProps(mocks.panelProps).readOnly).toBe(false);
  });

  it("saves one panel change as the full inbox body", async () => {
    const answer = { data: { ...SETTINGS, pipeline_id: "pl-1", automation: { ...SETTINGS.automation, enable_agent_responses: true } }, error: null };
    const { save, onSaved } = renderPanel(vi.fn().mockResolvedValue(answer));
    let result: Record<string, unknown> = {};
    await act(async () => {
      result = await lastProps(mocks.panelProps).onSave("snd-1", { enableAgentResponses: true });
    });
    expect(save).toHaveBeenCalledWith({ ...SETTINGS, automation: { ...SETTINGS.automation, enable_agent_responses: true } });
    expect(onSaved).toHaveBeenCalledWith(answer.data);
    expect((result.account as Record<string, unknown>).pipelineId).toBe("pl-1");
  });

  it("assigns the department through the same body", async () => {
    const save = vi.fn().mockResolvedValue({ data: { ...SETTINGS, department_id: "dep-1" }, error: null });
    renderPanel(save);
    await act(async () => {
      await lastProps(mocks.departmentProps).onAssign("dep-1");
    });
    expect(save).toHaveBeenCalledWith({ ...SETTINGS, department_id: "dep-1" });
  });

  it("explains a refusal for references from another workspace", async () => {
    const save = vi.fn().mockResolvedValue({ data: null, error: { code: "carrier_inbox_refs_not_in_workspace", message: "x" } });
    renderPanel(save);
    let result: Record<string, unknown> = {};
    await act(async () => {
      result = await lastProps(mocks.panelProps).onSave("snd-1", { agentId: "ag-2" });
    });
    expect(result.error).toBe(pt.carrierMessaging.errors.carrier_inbox_refs_not_in_workspace);
  });

  it("is read only without the update permission and hidden without read", () => {
    mocks.can.mockImplementation((_resource: string, action: string) => action === "read");
    const { unmount } = render(
      <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
        <CarrierInboxSettingsPanel ownerId="snd-1" settings={SETTINGS} save={vi.fn()} onSaved={vi.fn()} controlId="rcs" />
      </NextIntlClientProvider>,
    );
    expect(lastProps(mocks.panelProps).readOnly).toBe(true);
    expect(lastProps(mocks.disclosureProps).readOnly).toBe(true);
    expect(screen.queryByTestId("department-card")).not.toBeInTheDocument();
    unmount();
    mocks.can.mockReturnValue(false);
    render(
      <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
        <CarrierInboxSettingsPanel ownerId="snd-1" settings={SETTINGS} save={vi.fn()} onSaved={vi.fn()} controlId="rcs" />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByTestId("automation-panel")).not.toBeInTheDocument();
  });
});
