import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import { emptyAdForm, emptyWizardForm, type WizardForm } from "@/lib/advertising/draft";
import type { AdsOptions, MetaAdDraft } from "@/lib/advertising/draft-types";
import type { AdAccount, AdPage } from "@/lib/advertising/types";
import { writeWizard } from "@/lib/advertising/wizard-storage";

import { AdWizard } from "./ad-wizard";

const account: AdAccount = {
  id: "acc-1",
  metaAccountId: "act_1",
  name: "Loja",
  currency: "BRL",
  timezone: "America/Sao_Paulo",
  metaStatus: "active",
  connection: "CONNECTED",
  hasFunding: true,
  canSpend: true,
  canManage: true,
  canSetSpendCap: true,
  role: "admin",
};

const page: AdPage = {
  pageId: "p1",
  name: "Loja da Ana",
  canAdvertise: true,
  leadTermsAccepted: true,
  numbers: [{ kind: "official", label: "Vendas", number: "5511999990000" }],
};

const options: AdsOptions = {
  objectives: [
    { objective: "OUTCOME_LEADS", routes: [{ destination: "WHATSAPP", goals: ["CONVERSATIONS"] }] },
    { objective: "OUTCOME_SALES", routes: [{ destination: "WHATSAPP", goals: ["CONVERSATIONS"] }] },
  ],
  callsToAction: ["LEARN_MORE"],
  destinationCallsToAction: { WEBSITE: ["LEARN_MORE"] },
  placements: { facebook: ["feed", "story"] },
  breakdownGroups: null,
  attributionWindows: null,
  pixelEvents: ["PURCHASE"],
  formats: ["IMAGE"],
};

const validateMock = vi.fn();
const publishMock = vi.fn();
const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ can: () => true, permissionsLoading: false, currentWorkspace: { id: "ws-1" } }),
}));

vi.mock("@/components/dashboard/DashboardPageHeader", () => ({
  DashboardPageHeader: ({ badge }: { badge: string }) => <h1>{badge}</h1>,
}));

vi.mock("@/app/actions/advertising", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/actions/advertising")>();
  return {
    ...actual,
    listAdAccountsAction: async () => ({ data: [account] }),
    listAdPagesAction: async () => ({ data: [page] }),
    searchAdLocationsAction: async () => ({ data: [] }),
    getAdsReportAction: async () => ({ error: "unused" }),
    getAdEditableObjectAction: async () => ({ error: "unused" }),
    getAdPublishJobAction: async () => ({ error: "unused" }),
  };
});

vi.mock("@/app/actions/pricing", () => ({
  getExchangeRateAction: vi.fn(async () => ({ item: { priceMicros: 5_000_000 } })),
}));

vi.mock("@/app/actions/advertising-create", () => ({
  getAdsOptionsAction: async () => ({ data: options }),
  estimateAdReachAction: async () => ({ data: { lower: 1000, upper: 2000, ready: true } }),
  searchAdTargetingAction: async () => ({ data: [] }),
  validateMetaAdDraftAction: (draft: MetaAdDraft) => validateMock(draft),
  publishMetaAdDraftAction: (draft: MetaAdDraft) => publishMock(draft),
  getAdBudgetMinimumAction: async () => ({ data: { daily: 519, currency: "BRL" } }),
}));

vi.mock("@/app/actions/advertising-audiences", () => ({
  listAudiencesAction: async () => ({ data: { termsAccepted: true, audiences: [] } }),
  listSavedAudiencesAction: async () => ({ data: [] }),
  createSavedAudienceAction: async () => ({ error: "unused" }),
}));

function renderWizard(): void {
  const strict = (error: { code: string; message: string }) => {
    throw new Error(`${error.code}: ${error.message}`);
  };
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} onError={strict}>
      <AdWizard />
    </NextIntlClientProvider>,
  );
}

async function continueDraft(): Promise<void> {
  fireEvent.click(await screen.findByRole("button", { name: "Continuar rascunho" }));
}

function readyForm(): WizardForm {
  return {
    ...emptyWizardForm("acc-1"),
    objective: "OUTCOME_LEADS",
    campaignName: "Promo de inverno",
    pageId: "p1",
    destination: "WHATSAPP",
    goal: "CONVERSATIONS",
    whatsAppNumber: "5511999990000",
    adSetBudget: { kind: "DAILY", input: "50" },
    targeting: { ...emptyWizardForm().targeting, locations: [{ kind: "country", key: "BR", name: "Brasil" }] },
    ads: [{ ...emptyAdForm("a1"), primaryText: "Fale com a gente", media: { kind: "image", mediaId: "m1", url: "https://cdn/x.jpg" } }],
  };
}

describe("AdWizard", () => {
  beforeEach(() => {
    validateMock.mockReset();
    publishMock.mockReset();
    pushMock.mockReset();
  });

  afterEach(() => window.localStorage.clear());

  it("walks from the objective to the campaign step", async () => {
    renderWizard();
    await screen.findByText("Objetivo da campanha");
    const next = screen.getByRole("button", { name: "Continuar" });
    expect(next).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByText("Cadastros"));
    await waitFor(() => expect(next).toHaveProperty("disabled", false));
    fireEvent.click(next);
    expect(await screen.findByText("Orçamento de campanha Advantage+")).toBeTruthy();
  });

  it("renders the ad set step with the audience estimate and the WhatsApp number", async () => {
    writeWizard("ws-1", readyForm(), "adSet");
    renderWizard();
    await continueDraft();
    expect(await screen.findByText("Onde acontece o resultado")).toBeTruthy();
    expect(await screen.findByText("Público estimado: 1.000 a 2.000 pessoas", {}, { timeout: 3000 })).toBeTruthy();
    expect(await screen.findByText(/Mínimo da Meta nesta conta: R\$\s?5,19 por dia/)).toBeTruthy();
    expect(screen.getByText("Rascunho recuperado", { exact: false })).toBeTruthy();
  });

  it("renders the ads step and duplicates an ad", async () => {
    writeWizard("ws-1", readyForm(), "ads");
    renderWizard();
    await continueDraft();
    fireEvent.click(await screen.findByRole("button", { name: "Duplicar anúncio" }));
    expect(await screen.findByRole("tab", { name: "Anúncio 2" })).toBeTruthy();
    expect(screen.getByText("Prévia do anúncio 2 de 2")).toBeTruthy();
  });

  it("only publishes after a clean validation with a fee for the exact draft", async () => {
    writeWizard("ws-1", readyForm(), "review");
    validateMock.mockResolvedValueOnce({ data: { issues: [{ field: "ads[0].creative.link", code: "invalid_url" }], fee: null } });
    validateMock.mockResolvedValueOnce({ data: { issues: [], fee: { price: 1_000_000, total: 1_000_000, currency: "USD" } } });
    publishMock.mockResolvedValue({
      data: { id: "job-1", adAccountId: "acc-1", campaignName: "Promo", status: "QUEUED", progress: {}, fee: "", createdAt: "", updatedAt: "" },
    });
    renderWizard();
    await continueDraft();

    const publish = await screen.findByRole("button", { name: "Publicar" });
    expect(publish).toHaveProperty("disabled", true);
    expect(await screen.findByText("O link precisa começar com https://.")).toBeTruthy();
    expect(screen.getByText("Por que ainda não dá para publicar")).toBeTruthy();
    expect(publish).toHaveProperty("disabled", true);

    fireEvent.click(screen.getByRole("button", { name: "Conferir de novo" }));
    await screen.findByText("Tudo certo para publicar.");
    expect(screen.getAllByText(/R\$\s?5,00/)).toHaveLength(2);
    expect(publish).toHaveProperty("disabled", false);

    fireEvent.click(screen.getByRole("switch", { name: "Publicar desligado" }));
    const paused = await screen.findByRole("button", { name: "Publicar desligado" });
    expect(paused).toHaveProperty("disabled", true);
    expect(screen.getByText("Você mudou algo depois da conferência. Confira de novo para publicar.")).toBeTruthy();

    validateMock.mockResolvedValueOnce({ data: { issues: [], fee: { price: 1_000_000, total: 1_000_000, currency: "USD" } } });
    fireEvent.click(screen.getByRole("button", { name: "Conferir de novo" }));
    await waitFor(() => expect(paused).toHaveProperty("disabled", false));
    fireEvent.click(paused);

    await waitFor(() => expect(publishMock).toHaveBeenCalledTimes(1));
    const draft = publishMock.mock.calls[0][0] as MetaAdDraft;
    expect(draft).toMatchObject({
      adAccountId: "acc-1",
      identity: { pageId: "p1" },
      campaign: { name: "Promo de inverno", objective: "OUTCOME_LEADS", specialCategory: "NONE" },
      adSet: { destination: "WHATSAPP", goal: "CONVERSATIONS", whatsAppNumber: "5511999990000", budget: { kind: "DAILY", amount: 5000 } },
      keepPaused: true,
    });
    expect(draft.ads[0].creative).toMatchObject({ format: "IMAGE", primaryText: "Fale com a gente", media: { kind: "image", mediaId: "m1" } });
    expect(await screen.findByText("Publicação")).toBeTruthy();
    expect(screen.getByText("Campanha criada")).toBeTruthy();
    expect(window.localStorage.getItem("advertising:wizard:ws-1")).not.toBeNull();
  });

  it("explains a budget below the Meta minimum with the amount", async () => {
    writeWizard("ws-1", readyForm(), "review");
    validateMock.mockResolvedValueOnce({
      data: {
        issues: [{ field: "adSet.budget.amount", code: "below_minimum" }],
        budgetMinimum: { field: "adSet.budget.amount", daily: 519, currency: "BRL" },
      },
    });
    renderWizard();
    await continueDraft();
    expect(await screen.findByText(/precisa ser de pelo menos R\$\s?5,19/)).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Publicar" })).toHaveProperty("disabled", true);
  });

  it("offers to start over instead of trapping the user in an old draft", async () => {
    writeWizard("ws-1", readyForm(), "review");
    renderWizard();
    expect(await screen.findByText("Você tem um rascunho salvo")).toBeTruthy();
    expect(screen.getByText("Promo de inverno")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Começar do zero" }));
    expect(await screen.findByText("Objetivo da campanha")).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem("advertising:wizard:ws-1") ?? "{}").form.campaignName).toBe("");
    expect(validateMock).not.toHaveBeenCalled();
  });

  it("clears the draft and opens the manager on the new campaign once published", async () => {
    writeWizard("ws-1", readyForm(), "review");
    validateMock.mockResolvedValue({ data: { issues: [], fee: { price: 1_000_000, total: 1_000_000, currency: "USD" } } });
    publishMock.mockResolvedValue({
      data: {
        id: "job-1",
        adAccountId: "acc-1",
        campaignName: "Promo",
        status: "PUBLISHED",
        progress: { campaignId: "c-9", adSetId: "s-9", ads: { "0": "ad-9" } },
        fee: "charged",
        createdAt: "",
        updatedAt: "",
      },
    });
    renderWizard();
    await continueDraft();
    const publish = await screen.findByRole("button", { name: "Publicar" });
    await waitFor(() => expect(publish).toHaveProperty("disabled", false));
    fireEvent.click(publish);
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard/advertising?account=acc-1&campaign=c-9&published=1&job=job-1"));
    expect(window.localStorage.getItem("advertising:wizard:ws-1")).toBeNull();
  });

  it("keeps the draft and explains a failed publish", async () => {
    writeWizard("ws-1", readyForm(), "review");
    validateMock.mockResolvedValue({ data: { issues: [], fee: { price: 1_000_000, total: 1_000_000, currency: "USD" } } });
    publishMock.mockResolvedValue({
      data: {
        id: "job-2",
        adAccountId: "acc-1",
        campaignName: "Promo",
        status: "FAILED",
        progress: {},
        fee: "refunded",
        errorCode: "meta_rejected",
        errorMessage: "Imagem recusada",
        createdAt: "",
        updatedAt: "",
      },
    });
    renderWizard();
    await continueDraft();
    const publish = await screen.findByRole("button", { name: "Publicar" });
    await waitFor(() => expect(publish).toHaveProperty("disabled", false));
    fireEvent.click(publish);
    expect(await screen.findByText("A publicação falhou")).toBeTruthy();
    expect(screen.getByText("Imagem recusada")).toBeTruthy();
    expect(window.localStorage.getItem("advertising:wizard:ws-1")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Voltar ao rascunho" }));
    expect(await screen.findByRole("button", { name: "Publicar" })).toBeTruthy();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("names the fee problem when validation cannot quote it", async () => {
    writeWizard("ws-1", readyForm(), "review");
    validateMock.mockResolvedValue({ error: "O preço do anúncio não está configurado", code: "price_unavailable", status: 503 });
    renderWizard();
    await continueDraft();
    expect(
      await screen.findByText("A conferência não terminou: A taxa do anúncio ainda não está configurada. Fale com o suporte para publicar."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Publicar" })).toHaveProperty("disabled", true);
  });
});
