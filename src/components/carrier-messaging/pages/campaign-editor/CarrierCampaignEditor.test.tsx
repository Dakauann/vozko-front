import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const carrierChannels = vi.hoisted(() => ({ launched: new Set<string>(["rcs", "sms"]) }));
vi.mock("@/lib/carrier-messaging/use-carrier-channels", () => ({
  useCarrierChannels: () => ({ status: "ready", launched: (channel: string) => carrierChannels.launched.has(channel) }),
}));

const carrier = vi.hoisted(() => ({
  createCarrierCampaignAction: vi.fn(),
  updateCarrierCampaignAction: vi.fn(),
  transitionCarrierCampaignAction: vi.fn(),
  estimateCarrierCampaignAction: vi.fn(),
  testCarrierCampaignAction: vi.fn(),
}));
const rcs = vi.hoisted(() => ({ listRcsSendersAction: vi.fn(), checkRcsContentAction: vi.fn(), resolveRcsMediaAction: vi.fn() }));
const sms = vi.hoisted(() => ({ listSmsRoutesAction: vi.fn(), checkSmsTextAction: vi.fn(), smsTextToGsmAction: vi.fn() }));

vi.mock("@/app/actions/carrier-messaging", () => carrier);
vi.mock("@/app/actions/rcs", () => rcs);
vi.mock("@/app/actions/sms", () => sms);
vi.mock("@/hooks/use-exchange-rate", () => ({ useExchangeRate: () => 5 }));
vi.mock("@/hooks/use-lead-field-definitions", () => ({ useLeadFieldDefinitions: () => ({ definitions: [] }) }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws1" }, can: () => true }) }));
vi.mock("@/components/leads/LeadsToolbar", () => ({ LeadsToolbar: () => <div data-testid="leads-toolbar" /> }));
vi.mock("@/components/leads/LeadSavedViews", () => ({ default: () => null }));

const audienceActions = vi.hoisted(() => ({ countAudienceAction: vi.fn(), listAudienceFieldsAction: vi.fn() }));
vi.mock("@/app/actions/campaign-audience", () => audienceActions);

import rawPt from "@/i18n/messages/pt.json";
import { campaignFixture, estimateFixture, routeFixture } from "@/lib/carrier-messaging/test-fixtures";
import { senderFixture } from "@/lib/rcs/test-fixtures";
import { brandedMessages } from "@/test/branded-messages";

import { CarrierCampaignEditor } from "./CarrierCampaignEditor";

const pt = brandedMessages(rawPt);
const copy = pt.carrierMessaging.pages.campaignEditor;
const send = pt.campaignWizard.send;

function renderEditor(props: Partial<Parameters<typeof CarrierCampaignEditor>[0]> = {}) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
        <CarrierCampaignEditor {...props} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

async function click(name: string | RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

describe("CarrierCampaignEditor", () => {
  beforeEach(() => {
    for (const group of [carrier, rcs, sms, audienceActions]) for (const action of Object.values(group)) action.mockReset();
    audienceActions.listAudienceFieldsAction.mockResolvedValue({ data: [], error: null });
    audienceActions.countAudienceAction.mockResolvedValue({
      data: {
        channel: "carrier",
        source: "leads",
        matched: 1250,
        withContact: 1220,
        sendable: 1200,
        out: { no_phone: 30, opted_out: 20 },
        outTotal: 50,
        requiredVariables: 0,
        variables: [],
        blockers: [],
        selection: { selected: 1250, confirmCount: 1250, fingerprint: "fp-all" },
        list: null,
      },
      error: null,
    });
    rcs.listRcsSendersAction.mockResolvedValue({
      data: { senders: [senderFixture(), senderFixture({ id: "snd-2", brand_name: "Loja Lua", status: "draft", can_send: false })] },
      error: null,
    });
    sms.listSmsRoutesAction.mockResolvedValue({
      data: { routes: [routeFixture(), routeFixture({ id: "rt-2", brand_prefix: "Lua", status: "paused", can_send: false })] },
      error: null,
    });
    rcs.checkRcsContentAction.mockResolvedValue({ data: null, error: { code: "carrier_price_unavailable" } });
    sms.checkSmsTextAction.mockResolvedValue({ data: null, error: { code: "carrier_price_unavailable" } });
  });

  it("walks an SMS campaign from channel to launch", async () => {
    carrier.createCarrierCampaignAction.mockImplementation(async (draft) => ({ data: { ...campaignFixture(), ...draft, id: "cmp-7", status: "draft" }, error: null }));
    carrier.estimateCarrierCampaignAction.mockResolvedValue({ data: estimateFixture({ channel: "sms", worst_case_segments: 2, shortfall_micros: 5_000_000 }), error: null });
    carrier.testCarrierCampaignAction.mockResolvedValue({ data: { id: "msg-1", channel: "sms", reference: "r", status: "accepted", error_code: "" }, error: null });
    carrier.transitionCarrierCampaignAction.mockResolvedValue({ data: { ...campaignFixture(), id: "cmp-7", status: "scheduled" }, error: null });
    carrier.updateCarrierCampaignAction.mockImplementation(async (_id, change) => ({ data: { ...campaignFixture(), ...change, id: "cmp-7" }, error: null }));
    const onLaunched = vi.fn();
    renderEditor({ onLaunched });

    fireEvent.change(screen.getByLabelText(copy.channel.name), { target: { value: "Lembrete de pedido" } });
    await click(/^SMS/);
    const paused = await screen.findByRole("radio", { name: /Lua:/ });
    expect(paused).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: /Padaria Sol:/ }));
    await click(copy.nav.next);

    expect(screen.getByText("Padaria Sol:")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(pt.sms.composer.label), { target: { value: "Seu pedido saiu" } });
    await click(copy.nav.next);

    expect(screen.getByTestId("leads-toolbar")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: pt.campaignAudience.step.sources.list })).not.toBeInTheDocument();
    await click(pt.campaignAudience.step.pick.everyone);
    expect(await screen.findByText(pt.carrierMessaging.skipReasons.no_phone, undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(audienceActions.countAudienceAction).toHaveBeenLastCalledWith("carrier", { source: "leads", selection: { mode: "everyone" } }, { kind: "marketing" }, expect.any(AbortSignal));
    expect(screen.getByText("1.220")).toBeInTheDocument();
    await click(copy.nav.review);

    const draft = carrier.createCarrierCampaignAction.mock.calls[0][0];
    expect(draft).toMatchObject({
      name: "Lembrete de pedido",
      channel: "sms",
      sender_id: "rt-1",
      variants: [{ name: "", text: "Seu pedido saiu", bindings: [] }],
      audience: { mode: "everyone", expectedCount: 1250, fingerprint: "fp-all" },
      scheduled_at: null,
      recurrence: null,
    });
    expect(await screen.findByText("1.200")).toBeInTheDocument();
    expect(screen.getByText(/SMS com até 2 partes/)).toBeInTheDocument();
    expect(screen.getByText(/^Faltam R\$\s25,00 de saldo$/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(copy.review.testPhone), { target: { value: "+5511999990000" } });
    await click(copy.review.testSend);
    expect(carrier.testCarrierCampaignAction).toHaveBeenCalledWith("cmp-7", "+5511999990000", 0);
    expect(screen.getByText(copy.review.testSent)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/1\.?200/), { target: { value: "1200" } });
    await click(copy.nav.next);
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(send.schedule.title) }));
    await click(copy.schedule.modes.recurring);
    await click(send.schedule.action);
    await click(send.confirm.scheduleAction);
    expect(carrier.updateCarrierCampaignAction.mock.calls[0][1]).toMatchObject({ recurrence: { frequency: "weekly", time: "09:00", weekdays: [1] } });
    expect(carrier.updateCarrierCampaignAction).toHaveBeenLastCalledWith("cmp-7", { audience: { mode: "everyone", expectedCount: 1200, fingerprint: "fp-1" } });
    expect(carrier.transitionCarrierCampaignAction).toHaveBeenCalledWith("cmp-7", "launch");
    expect(onLaunched).toHaveBeenCalled();
  });

  it("offers launched RCS senders only and adds the fallback step", async () => {
    renderEditor();
    await click(/^RCS/);
    const draftSender = await screen.findByRole("radio", { name: /Loja Lua/ });
    expect(draftSender).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: /Padaria Sol/ }));
    expect(screen.getByText(copy.steps.fallback.title)).toBeInTheDocument();
    await click(copy.nav.next);
    await click(copy.message.startTest);
    const versions = screen.getByRole("group", { name: copy.message.variantsLabel });
    expect(within(versions).getAllByRole("button").map((button) => button.textContent)).toEqual(["A", "B"]);
  });

  it("starts on SMS and keeps RCS disabled while the backend says it is coming soon", async () => {
    carrierChannels.launched = new Set(["sms"]);
    renderEditor();
    const rcsOption = screen.getByRole("button", { name: /^RCS/ });
    expect(rcsOption).toBeDisabled();
    expect(rcsOption).toHaveTextContent(pt.carrierMessaging.comingSoon.chip);
    expect(await screen.findByRole("radio", { name: /Padaria Sol:/ })).toBeInTheDocument();
    expect(rcs.listRcsSendersAction).not.toHaveBeenCalled();
    carrierChannels.launched = new Set(["rcs", "sms"]);
  });

  it("blocks an existing RCS draft while RCS is coming soon", async () => {
    carrierChannels.launched = new Set(["sms"]);
    renderEditor({ initial: campaignFixture() });
    expect(screen.getByText(pt.carrierMessaging.comingSoon.rcs.title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.nav.next })).toBeDisabled();
    expect(rcs.listRcsSendersAction).not.toHaveBeenCalled();
    carrierChannels.launched = new Set(["rcs", "sms"]);
  });

  it("keeps the person on the step and explains a backend refusal", async () => {
    carrier.createCarrierCampaignAction.mockResolvedValue({ data: null, error: { code: "carrier_settings_invalid", message: "x" } });
    renderEditor();
    await screen.findByRole("radio", { name: /Padaria Sol/ });
    await click(copy.nav.saveDraft);
    await waitFor(() => expect(screen.getByText(copy.refusedTitle)).toBeInTheDocument());
    expect(screen.getByText(pt.carrierMessaging.errors.carrier_settings_invalid)).toBeInTheDocument();
  });

  it("saves the confirmed count and fingerprint of a filtered audience before launching, and recounts on drift", async () => {
    const audience = { mode: "all_matching" as const, filter: { groups: [] }, expectedCount: 300 };
    const initial = campaignFixture({ channel: "sms", sender_id: "rt-1", variants: [{ name: "", text: "Oi", bindings: [] }], fallback: {}, audience });
    carrier.updateCarrierCampaignAction.mockImplementation(async (_id, change) => ({ data: { ...initial, ...change }, error: null }));
    carrier.estimateCarrierCampaignAction.mockResolvedValue({ data: estimateFixture({ channel: "sms", recipients: 310, audience_fingerprint: "fp-f" }), error: null });
    carrier.transitionCarrierCampaignAction.mockResolvedValueOnce({
      data: null,
      error: { code: "carrier_campaign_audience_changed", message: "x", details: { expected: 310, matched: 312 } },
    });
    renderEditor({ initial });
    await screen.findByRole("radio", { name: /Padaria Sol:/ });
    await click(copy.nav.next);
    await click(copy.nav.next);
    await click(copy.nav.review);

    await screen.findByRole("button", { name: copy.review.audienceConfirm.confirm.replace("{count, number}", "310") });
    await click(copy.nav.next);
    expect(screen.getByRole("button", { name: send.now.action })).toBeDisabled();
    await click(copy.nav.back);
    await click(copy.review.audienceConfirm.confirm.replace("{count, number}", "310"));
    const estimated = carrier.estimateCarrierCampaignAction.mock.calls.length;
    await click(copy.nav.next);
    await click(send.now.action);
    await click(send.confirm.nowAction);

    expect(carrier.updateCarrierCampaignAction).toHaveBeenLastCalledWith("cmp-1", { audience: { ...audience, expectedCount: 310, fingerprint: "fp-f" } });
    expect(carrier.transitionCarrierCampaignAction).toHaveBeenCalledWith("cmp-1", "launch");
    expect(screen.getByText(/312/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: send.now.action })).toBeDisabled();
    await click(copy.nav.back);
    await waitFor(() => expect(carrier.estimateCarrierCampaignAction).toHaveBeenCalledTimes(estimated + 1));
  });

  it("shows who is left out from the same estimate that prices the campaign", async () => {
    const audience = { mode: "everyone" as const, expectedCount: 300 };
    const initial = campaignFixture({ channel: "sms", sender_id: "rt-1", variants: [{ name: "", text: "Oi", bindings: [] }], fallback: {}, audience });
    carrier.updateCarrierCampaignAction.mockImplementation(async (_id, change) => ({ data: { ...initial, ...change }, error: null }));
    const count = {
      channel: "carrier" as const,
      source: "leads" as const,
      matched: 320,
      withContact: 315,
      sendable: 310,
      out: { suppressed: 5, no_phone: 5 },
      outTotal: 10,
      requiredVariables: 0,
      variables: [],
      blockers: [],
      selection: { selected: 320, confirmCount: 320, fingerprint: "fp-f" },
      list: null,
      metadataMissing: [],
    };
    carrier.estimateCarrierCampaignAction.mockResolvedValue({ data: estimateFixture({ channel: "sms", recipients: 320, audience_fingerprint: "fp-f", count }), error: null });
    renderEditor({ initial });
    await screen.findByRole("radio", { name: /Padaria Sol:/ });
    await click(copy.nav.next);
    await click(copy.nav.next);
    await click(copy.nav.review);

    expect(await screen.findByText(pt.carrierMessaging.skipReasons.suppressed)).toBeInTheDocument();
    expect(screen.getByText(pt.campaignAudience.step.count.out)).toBeInTheDocument();
    expect(audienceActions.countAudienceAction).not.toHaveBeenCalled();
  });

  it("updates an existing campaign instead of creating a new one", async () => {
    carrier.updateCarrierCampaignAction.mockResolvedValue({ data: campaignFixture(), error: null });
    const onSaved = vi.fn();
    renderEditor({ initial: campaignFixture(), onSaved });
    await screen.findByRole("radio", { name: /Padaria Sol/ });
    await click(copy.nav.saveDraft);
    expect(carrier.updateCarrierCampaignAction.mock.calls[0][0]).toBe("cmp-1");
    expect(carrier.createCarrierCampaignAction).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
  });


  it("starts on RCS, keeps SMS disabled and never asks for routes while only RCS is launched", async () => {
    carrierChannels.launched = new Set(["rcs"]);
    renderEditor();
    const smsOption = screen.getByRole("button", { name: /^SMS/ });
    expect(smsOption).toBeDisabled();
    expect(smsOption).toHaveTextContent(pt.carrierMessaging.comingSoon.chip);
    expect(await screen.findByRole("radio", { name: /Padaria Sol/ })).toBeInTheDocument();
    expect(screen.getByText(copy.steps.fallback.title)).toBeInTheDocument();
    expect(sms.listSmsRoutesAction).not.toHaveBeenCalled();
    carrierChannels.launched = new Set(["rcs", "sms"]);
  });
  describe("Envio", () => {
    const smsCampaign = (overrides: Parameters<typeof campaignFixture>[0] = {}) =>
      campaignFixture({ channel: "sms", sender_id: "rt-1", variants: [{ name: "", text: "Oi", bindings: [] }], fallback: {}, ...overrides });

    async function openSend(initial: ReturnType<typeof campaignFixture>, onLaunched = vi.fn()) {
      carrier.updateCarrierCampaignAction.mockImplementation(async (_id, change) => ({ data: { ...initial, ...change }, error: null }));
      carrier.estimateCarrierCampaignAction.mockResolvedValue({ data: estimateFixture({ channel: "sms" }), error: null });
      carrier.transitionCarrierCampaignAction.mockImplementation(async (_id, transition) => ({ data: { ...initial, status: transition === "ready" ? "ready" : "running" }, error: null }));
      renderEditor({ initial, onLaunched });
      await screen.findByRole("radio", { name: /Padaria Sol:/ });
      await click(copy.nav.next);
      await click(copy.nav.next);
      await click(copy.nav.review);
      await click(copy.nav.next);
      return onLaunched;
    }

    function lastDraftSaved() {
      const calls = carrier.updateCarrierCampaignAction.mock.calls;
      return calls[calls.length - 1][1];
    }

    it("offers the three choices and sends now without a schedule", async () => {
      const onLaunched = await openSend(smsCampaign({ scheduled_at: "2030-01-01T12:00:00Z" }));
      for (const title of [send.now.title, send.schedule.title, send.ready.title]) {
        expect(screen.getByRole("radio", { name: new RegExp(title) })).toBeInTheDocument();
      }
      await click(send.now.action);
      expect(screen.getByText(copy.send.nowTitle)).toBeInTheDocument();
      await click(send.confirm.nowAction);
      expect(lastDraftSaved()).toMatchObject({ scheduled_at: null, recurrence: null });
      expect(carrier.transitionCarrierCampaignAction).toHaveBeenCalledWith("cmp-1", "launch");
      expect(carrier.updateCarrierCampaignAction.mock.invocationCallOrder[0]).toBeLessThan(carrier.transitionCarrierCampaignAction.mock.invocationCallOrder[0]);
      expect(onLaunched).toHaveBeenCalled();
    });

    it("keeps recurrence as a carrier extra under Agendar and schedules through the launch", async () => {
      await openSend(smsCampaign());
      expect(screen.queryByRole("button", { name: copy.schedule.modes.recurring })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("radio", { name: new RegExp(send.schedule.title) }));
      expect(screen.getByLabelText(copy.schedule.at)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: send.schedule.action })).toBeDisabled();
      await click(copy.schedule.modes.recurring);
      expect(screen.getByRole("group", { name: copy.schedule.weekdays })).toBeInTheDocument();
      await click(send.schedule.action);
      await click(send.confirm.scheduleAction);
      expect(lastDraftSaved()).toMatchObject({ scheduled_at: null, recurrence: { frequency: "weekly", time: "09:00", weekdays: [1] } });
      expect(carrier.transitionCarrierCampaignAction).toHaveBeenCalledWith("cmp-1", "launch");
    });

    it("leaves the campaign ready: clears the schedule, saves, then calls ready without a confirm dialog", async () => {
      const onLaunched = await openSend(smsCampaign({ recurrence: { frequency: "daily", time: "08:00", timezone: "America/Sao_Paulo" } }));
      fireEvent.click(screen.getByRole("radio", { name: new RegExp(send.ready.title) }));
      await click(send.ready.action);
      expect(lastDraftSaved()).toMatchObject({ scheduled_at: null, recurrence: null });
      expect(carrier.transitionCarrierCampaignAction).toHaveBeenCalledWith("cmp-1", "ready");
      expect(carrier.updateCarrierCampaignAction.mock.invocationCallOrder[0]).toBeLessThan(carrier.transitionCarrierCampaignAction.mock.invocationCallOrder[0]);
      expect(onLaunched).toHaveBeenCalledWith(expect.objectContaining({ status: "ready" }));
    });

    it("shows a refused ready with the carrier copy and stays on the step", async () => {
      await openSend(smsCampaign());
      carrier.transitionCarrierCampaignAction.mockResolvedValueOnce({ data: null, error: { code: "carrier_campaign_not_draft", message: "x" } });
      fireEvent.click(screen.getByRole("radio", { name: new RegExp(send.ready.title) }));
      await click(send.ready.action);
      expect(await screen.findByText(pt.carrierMessaging.errors.carrier_campaign_not_draft)).toBeInTheDocument();
      expect(screen.getByText(send.refused)).toBeInTheDocument();
    });
  });
});
