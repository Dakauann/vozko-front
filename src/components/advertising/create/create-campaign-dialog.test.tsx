import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { AdsOptions, MetaAdDraft } from "@/lib/advertising/draft-types";
import type { AdAccount, AdRow } from "@/lib/advertising/types";

import { CreateCampaignDialog } from "./create-campaign-dialog";

const account: AdAccount = {
  id: "acc-1",
  metaAccountId: "act_1",
  name: "Loja",
  currency: "BRL",
  timezone: "America/Sao_Paulo",
  metaStatus: "active",
  connection: "CONNECTED",
  hasFunding: false,
  canSpend: false,
  canManage: true,
  canSetSpendCap: true,
  role: "admin",
};

const options: AdsOptions = {
  objectives: [
    { objective: "OUTCOME_LEADS", routes: [{ destination: "ON_AD", goals: ["LEAD_GENERATION"] }] },
    { objective: "OUTCOME_ENGAGEMENT", routes: [{ destination: "WHATSAPP", goals: ["CONVERSATIONS"] }] },
  ],
  callsToAction: [],
  destinationCallsToAction: {},
  placements: {},
  breakdownGroups: null,
  attributionWindows: null,
  pixelEvents: [],
  formats: ["IMAGE"],
};

const campaignRow = { metaId: "c-1", level: "campaign", name: "Campanha viva", objective: "OUTCOME_ENGAGEMENT", dailyBudget: 0, lifetimeBudget: 0 } as AdRow;
const adSetRow = {
  metaId: "s-1",
  level: "adset",
  name: "Conjunto vivo",
  campaignId: "c-1",
  destinationType: "WHATSAPP",
  optimizationGoal: "CONVERSATIONS",
  dailyBudget: 2000,
  lifetimeBudget: 0,
} as AdRow;

const createMock = vi.fn();
const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/app/actions/advertising", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/actions/advertising")>();
  return {
    ...actual,
    getAdReadinessAction: async () => ({
      data: {
        account,
        ready: false,
        blocking: ["payment_method"],
        items: [{ key: "payment_method", state: "missing", required: true }],
      },
    }),
    syncAdAccountAction: async () => ({ data: account }),
    getAdsReportAction: async (_accountId: string, filters: { level: string }) => ({
      data: { rows: filters.level === "campaign" ? [campaignRow] : [adSetRow] },
    }),
  };
});

vi.mock("@/app/actions/advertising-create", () => ({
  getAdsOptionsAction: async () => ({ data: options }),
}));

vi.mock("@/app/actions/advertising-drafts", () => ({
  createAdDraftAction: (draft: MetaAdDraft) => createMock(draft),
}));

function renderDialog(initialParent?: { campaignId?: string; adSetId?: string }): void {
  const strict = (error: { code: string; message: string }) => {
    throw new Error(`${error.code}: ${error.message}`);
  };
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} onError={strict}>
      <CreateCampaignDialog open onOpenChange={() => undefined} accounts={[account]} accountId="acc-1" initialParent={initialParent} />
    </NextIntlClientProvider>,
  );
}

describe("CreateCampaignDialog", () => {
  beforeEach(() => {
    createMock.mockReset();
    createMock.mockResolvedValue({ data: { id: "d-9" } });
    pushMock.mockReset();
  });

  it("shows Meta's create modal with the readiness banner, the buying type and the objectives", async () => {
    renderDialog();
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("tab", { name: "Criar nova campanha" })).toBeTruthy();
    expect(within(dialog).getByRole("tab", { name: "Novo conjunto de anúncios ou anúncio" })).toBeTruthy();
    expect(await within(dialog).findByText("Há informações em falta sobre a conta que são necessárias")).toBeTruthy();
    expect(within(dialog).getByText("Escolha um tipo de compra")).toBeTruthy();
    for (const name of ["Reconhecimento", "Tráfego", "Engajamento", "Leads", "Promoção do app", "Vendas"]) {
      expect(within(dialog).getByText(name)).toBeTruthy();
    }
    expect(within(dialog).getByRole("button", { name: "Continuar" })).toHaveProperty("disabled", true);
  });

  it("describes the hovered objective with what it is good for", async () => {
    renderDialog();
    const dialog = await screen.findByRole("dialog");
    fireEvent.mouseEnter(within(dialog).getByText("Leads"));
    expect(await within(dialog).findByText("Colete leads para sua empresa ou marca.")).toBeTruthy();
    expect(within(dialog).getByText("Formulários instantâneos")).toBeTruthy();
  });

  it("creates the whole draft tree named after the campaign and opens the editor", async () => {
    renderDialog();
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("radio", { name: "Leads" }));
    const next = within(dialog).getByRole("button", { name: "Continuar" });
    await waitFor(() => expect(next).toHaveProperty("disabled", false));
    fireEvent.click(next);
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    const draft = createMock.mock.calls[0][0] as MetaAdDraft;
    expect(draft.campaign).toMatchObject({ name: "Nova campanha de Leads", objective: "OUTCOME_LEADS" });
    expect(draft.adSet).toMatchObject({ destination: "ON_AD" });
    expect(draft.adSet.name).toBeUndefined();
    expect(draft.ads[0].name).toBeUndefined();
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard/advertising/editor?draft=d-9"));
  });

  it("adds a new ad to an existing ad set from the second tab", async () => {
    renderDialog({ adSetId: "s-1" });
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Cria um novo anúncio neste conjunto de anúncios.")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Continuar" }));
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    const draft = createMock.mock.calls[0][0] as MetaAdDraft;
    expect(draft.campaign.existingId).toBe("c-1");
    expect(draft.adSet).toMatchObject({ existingId: "s-1", destination: "WHATSAPP" });
    expect(draft.ads[0].name).toBeUndefined();
  });

  it("explains a failed creation and stays open", async () => {
    createMock.mockResolvedValue({ error: "Falhou", code: "x" });
    renderDialog({ campaignId: "c-1" });
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Cria um novo conjunto de anúncios com um anúncio nesta campanha.")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Continuar" }));
    expect(await within(dialog).findByText("Falhou")).toBeTruthy();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
