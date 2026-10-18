import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { ButtonActionView, ExitVerdict, TemplateButtonActions } from "@/lib/whatsapp-templates/exit";

const actions = vi.hoisted(() => ({
  getTemplateButtonActionsAction: vi.fn(),
  saveTemplateButtonActionsAction: vi.fn(),
  getTemplateExitVerdictAction: vi.fn(),
  getCampaignButtonRoutesAction: vi.fn(),
  saveCampaignButtonRoutesAction: vi.fn(),
  getAudienceExitsAction: vi.fn(),
  getDraftExitVerdictAction: vi.fn(),
}));
const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock("@/app/actions/template-exit", () => actions);
const access = vi.hoisted(() => ({ updateTemplates: true }));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({
    currentWorkspace: { id: "ws-1" },
    can: (resource: string, action: string) => (resource === "whatsapp_templates" && action === "update" ? access.updateTemplates : true),
  }),
}));
vi.mock("../use-action-param-options", () => ({
  TEAM_PREFIX: "team:",
  MEMBER_PREFIX: "user:",
  useHandOffOptions: () => ({ options: [], loading: false, failed: false }),
  useWorkflowOptions: () => ({ options: [{ value: "wf-1", label: "Cobrança" }], loading: false, failed: false }),
  useCallListOptions: () => ({ options: [], loading: false, failed: false }),
  useDealPipelineOptions: () => ({ options: [], loading: false, failed: false }),
  useDealStageOptions: () => ({ options: [], loading: false, failed: false }),
  useLeadSelectFields: () => ({ fields: [], loading: false, failed: false }),
}));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: vi.fn() } }));

import { ButtonDestinations } from "../ButtonDestinations";
import { CampaignExitSection } from "../CampaignExitSection";
import { useCampaignExit } from "../use-campaign-exit";

const t = ptMessages.templateExit;

const handOff: ButtonActionView = { buttonIndex: 0, buttonText: "Falar com atendente", kind: "hand_off", params: { departmentId: "d" }, confirmation: "", stale: false, version: 2 };

const NONE: ExitVerdict = {
  state: "none",
  buttons: [
    { index: 0, text: "Falar com atendente", action: handOff, source: "template", stale: false },
    { index: 1, text: "Não quero receber", action: null, stale: false },
  ],
  exitWords: [],
  templateExitRequired: false,
  campaignAcknowledgementRequired: true,
};

const OK: ExitVerdict = { ...NONE, state: "ok", exitWords: ["parar"], campaignAcknowledgementRequired: false };

const STORED: TemplateButtonActions = {
  templateId: "tpl-1",
  template: { name: "aviso_vencimento", language: "pt_BR" },
  version: 7,
  buttons: NONE.buttons,
  actions: [handOff],
  exitConfirmation: "",
  allowedKinds: ["opt_out", "hand_off", "start_workflow"],
};

const onUseAnotherTemplate = vi.fn();
const saved = vi.hoisted(() => ({ error: undefined as unknown }));

type HarnessProps = { mode?: "create" | "edit"; initialTemplateId?: string; campaignId?: string; numbers?: string[] };

function Harness({ mode = "create", initialTemplateId, campaignId, numbers }: HarnessProps) {
  const exit = useCampaignExit({ templateId: "tpl-1", campaignId, mode, initialTemplateId });
  const [done, setDone] = useState(false);
  return (
    <>
      <CampaignExitSection exit={exit} templateName="aviso_vencimento" onUseAnotherTemplate={onUseAnotherTemplate} numbers={numbers} />
      {exit.verdict ? <ButtonDestinations buttons={exit.verdict.buttons} overrides={exit.overrides} /> : null}
      <output data-testid="gate">{JSON.stringify({ blocks: exit.blocks, fields: exit.fields })}</output>
      <button
        type="button"
        onClick={async () => {
          saved.error = await exit.saveOverrides("camp-9");
          setDone(true);
        }}
      >
        save-routes
      </button>
      {done ? <span>routes-done</span> : null}
    </>
  );
}

function renderSection(props: HarnessProps = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <Harness {...props} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return () => JSON.parse(screen.getByTestId("gate").textContent ?? "{}");
}

beforeEach(() => {
  Object.values(actions).forEach((fn) => fn.mockReset());
  actions.getTemplateExitVerdictAction.mockResolvedValue({ data: NONE });
  actions.getTemplateButtonActionsAction.mockResolvedValue({ data: STORED });
  onUseAnotherTemplate.mockReset();
  access.updateTemplates = true;
  toastSuccess.mockReset();
  saved.error = undefined;
});

describe("CampaignExitSection", () => {
  it("confirms the template exit in green with nothing to tick", async () => {
    actions.getTemplateExitVerdictAction.mockResolvedValue({ data: OK });
    const gate = renderSection();
    expect(await screen.findByText(t.verdict.ok)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: t.risk.confirm })).not.toBeInTheDocument();
    expect(gate()).toEqual({ blocks: false, fields: {} });
  });

  it("blocks creation until the user acknowledges a template with no exit", async () => {
    const gate = renderSection();
    expect(await screen.findByText(t.verdict.none)).toBeInTheDocument();
    expect(gate()).toEqual({ blocks: true, fields: {} });
    fireEvent.click(screen.getByRole("checkbox", { name: t.risk.confirm }));
    expect(gate()).toEqual({ blocks: false, fields: { exitRiskAcknowledged: true } });
  });

  it("offers the user's own fixes", async () => {
    renderSection();
    await screen.findByText(t.verdict.none);
    expect(screen.getByRole("link", { name: t.campaign.editTemplate })).toHaveAttribute("href", "/dashboard/whatsapp-templates/tpl-1");
    fireEvent.click(screen.getByRole("button", { name: t.campaign.otherTemplate }));
    expect(onUseAnotherTemplate).toHaveBeenCalledTimes(1);
  });

  it("sends the person to edit a template without quick replies, since a stored word is never an exit", async () => {
    actions.getTemplateButtonActionsAction.mockResolvedValue({ data: { ...STORED, buttons: [], actions: [] } });
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: t.campaign.defineOnTemplate }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText(t.define.noButtons)).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: t.campaign.editTemplate })).toHaveAttribute("href", "/dashboard/whatsapp-templates/tpl-1");
    expect(within(dialog).queryByRole("radio")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("saves an exit action on the template from the campaign form", async () => {
    actions.saveTemplateButtonActionsAction.mockResolvedValue({ status: "saved", actions: { ...STORED, version: 8 } });
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: t.campaign.defineOnTemplate }));
    expect(await screen.findByText(t.define.note)).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("combobox", { name: t.define.button }));
    fireEvent.click(await screen.findByRole("option", { name: "Não quero receber" }));
    fireEvent.click(screen.getByRole("combobox", { name: t.action.label }));
    fireEvent.click(await screen.findByRole("option", { name: t.kinds.opt_out }));
    fireEvent.change(screen.getByLabelText(t.action.confirmation), { target: { value: "Você não recebe mais." } });
    fireEvent.click(screen.getByRole("button", { name: t.define.save }));

    await waitFor(() =>
      expect(actions.saveTemplateButtonActionsAction).toHaveBeenCalledWith("tpl-1", 7, {
        actions: [
          { buttonIndex: 0, buttonText: "Falar com atendente", kind: "hand_off", params: { departmentId: "d" }, confirmation: "" },
          { buttonIndex: 1, buttonText: "Não quero receber", kind: "opt_out", params: {}, confirmation: "Você não recebe mais." },
        ],
        exitConfirmation: "",
      }),
    );
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith(t.define.saved));
    await waitFor(() => expect(actions.getTemplateExitVerdictAction).toHaveBeenCalledTimes(2));
  });

  it("changes where a non-exit button leads for this campaign only", async () => {
    actions.getCampaignButtonRoutesAction.mockResolvedValue({ data: { campaignId: "camp-9", version: 2, routes: [], buttons: [] } });
    actions.saveCampaignButtonRoutesAction.mockResolvedValue({ status: "saved", routes: {} });
    renderSection();
    await screen.findByText(t.verdict.none);
    const toggle = t.campaign.overrideToggle.replace("{text}", "Falar com atendente");
    fireEvent.click(screen.getByRole("button", { name: toggle }));
    fireEvent.click(screen.getByRole("combobox", { name: t.action.label }));
    const names = (await screen.findAllByRole("option")).map((option) => option.textContent);
    expect(names).toEqual([t.kinds.none, t.kinds.hand_off, t.kinds.start_workflow]);
    fireEvent.click(await screen.findByRole("option", { name: t.kinds.start_workflow }));
    fireEvent.click(screen.getByRole("button", { name: "save-routes" }));
    await screen.findByText("routes-done");
    expect(actions.saveCampaignButtonRoutesAction).toHaveBeenCalledWith("camp-9", 2, [
      { buttonIndex: 0, buttonText: "Falar com atendente", kind: "start_workflow", params: {}, confirmation: "" },
    ]);
    expect(saved.error).toBeNull();
  });

  it("asks for the acknowledgement when an edit changes the template", async () => {
    const changed = renderSection({ mode: "edit", initialTemplateId: "tpl-0" });
    expect(await screen.findByText(t.verdict.none)).toBeInTheDocument();
    expect(changed()).toEqual({ blocks: true, fields: {} });
    fireEvent.click(screen.getByRole("checkbox", { name: t.risk.confirm }));
    expect(changed()).toEqual({ blocks: false, fields: { exitRiskAcknowledged: true } });
  });

  it("does not ask again when an edit keeps the template", async () => {
    const kept = renderSection({ mode: "edit", initialTemplateId: "tpl-1" });
    expect(await screen.findByText(t.verdict.none)).toBeInTheDocument();
    expect(kept()).toEqual({ blocks: false, fields: {} });
  });

  it("says how many contacts of the list already left", async () => {
    actions.getAudienceExitsAction.mockResolvedValue({ data: { optedOut: 30, blocked: 7, notReceiving: 37 } });
    renderSection({ numbers: ["5511987650001", " ", "5511987650002"] });
    expect(await screen.findByText(t.campaign.leftTitle, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText(/37 contatos da lista não recebem/)).toBeInTheDocument();
    expect(actions.getAudienceExitsAction).toHaveBeenCalledWith(["5511987650001", "5511987650002"]);
  });

  it("says when nobody of the list left and asks nothing without a list", async () => {
    actions.getAudienceExitsAction.mockResolvedValue({ data: { optedOut: 0, blocked: 0, notReceiving: 0 } });
    renderSection({ numbers: ["5511987650001"] });
    expect(await screen.findByText(t.campaign.leftNone, {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it("blocks while the template exit is still being checked", async () => {
    actions.getTemplateExitVerdictAction.mockReturnValue(new Promise(() => undefined));
    const gate = renderSection();
    expect(await screen.findByText(t.verdict.loading)).toBeInTheDocument();
    expect(gate().blocks).toBe(true);
  });

  it("blocks when the template exit could not be checked and checks again on retry", async () => {
    actions.getTemplateExitVerdictAction.mockResolvedValueOnce({ error: "down", status: 503 }).mockResolvedValue({ data: OK });
    const gate = renderSection();
    expect(await screen.findByText(t.verdict.failed)).toBeInTheDocument();
    expect(gate().blocks).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: t.verdict.retry }));
    expect(await screen.findByText(t.verdict.ok)).toBeInTheDocument();
    expect(gate()).toEqual({ blocks: false, fields: {} });
  });

  it("offers to set the exit on the template only to who may change templates", async () => {
    access.updateTemplates = false;
    renderSection();
    await screen.findByText(t.verdict.none);
    expect(screen.queryByRole("button", { name: t.campaign.defineOnTemplate })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.campaign.otherTemplate })).toBeInTheDocument();
  });

  it("shows the template's own action again once this campaign's route is removed", async () => {
    const routed: ButtonActionView = { ...handOff, kind: "start_workflow", params: { workflowId: "wf-1" } };
    actions.getTemplateExitVerdictAction.mockImplementation(async (_templateId: string, campaignId?: string) => ({
      data: campaignId ? { ...NONE, buttons: [{ ...NONE.buttons[0], action: routed, source: "campaign" }, NONE.buttons[1]] } : NONE,
    }));
    renderSection({ mode: "edit", initialTemplateId: "tpl-1", campaignId: "camp-1" });
    const destination = (action: string) => t.campaign.destination.replace("{text}", "Falar com atendente").replace("{action}", action);
    expect(await screen.findAllByRole("listitem", { name: destination(t.kinds.start_workflow) })).not.toHaveLength(0);

    fireEvent.click(screen.getByRole("combobox", { name: t.action.label }));
    fireEvent.click(await screen.findByRole("option", { name: t.kinds.none }));

    expect(await screen.findAllByRole("listitem", { name: destination(t.kinds.hand_off) })).not.toHaveLength(0);
    expect(screen.queryAllByRole("listitem", { name: destination(t.kinds.start_workflow) })).toHaveLength(0);
  });

  it("explains a count it could not make", async () => {
    actions.getAudienceExitsAction.mockResolvedValue({ error: "too many", code: "campaign_exit_too_many_numbers", status: 413 });
    renderSection({ numbers: ["5511987650001"] });
    expect(await screen.findByText(t.errors.campaign_exit_too_many_numbers, {}, { timeout: 3000 })).toBeInTheDocument();
  });
});
