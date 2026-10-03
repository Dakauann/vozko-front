import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import { buildDraft, emptyAdForm, emptyWizardForm, type WizardForm } from "@/lib/advertising/draft";
import type { AdsOptions, MetaAdDraft } from "@/lib/advertising/draft-types";
import type { AdAccount, AdPage, AdPublishJob, AdSavedDraft } from "@/lib/advertising/types";

import { DraftEditor } from "./draft-editor";

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

const context = { timezone: account.timezone, currency: account.currency };

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
    ads: [
      {
        ...emptyAdForm("a1"),
        primaryText: "Fale com a gente",
        media: { kind: "image", mediaId: "m1", url: "" },
        greeting: "Olá! Como posso ajudar?",
        iceBreakers: ["Qual o preço?"],
      },
    ],
  };
}

function savedDraft(changes: Partial<AdSavedDraft> = {}, draft: MetaAdDraft = buildDraft(readyForm(), context)): AdSavedDraft {
  return { id: "d-1", adAccountId: "acc-1", draft, version: 3, state: "editing", rows: [], createdAt: "", updatedAt: "", ...changes };
}

function job(changes: Partial<AdPublishJob>): AdPublishJob {
  return { id: "job-1", adAccountId: "acc-1", campaignName: "Promo", status: "QUEUED", progress: {}, fee: "", createdAt: "", updatedAt: "", ...changes };
}

const cleanValidation = { data: { issues: [], fee: { price: 1_000_000, total: 1_000_000, currency: "USD" } } };

const getDraftMock = vi.fn();
const updateMock = vi.fn();
const publishMock = vi.fn();
const deleteMock = vi.fn();
const validateMock = vi.fn();
const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ can: () => true, permissionsLoading: false, currentWorkspace: { id: "ws-1" } }),
}));

const readyChecklist = { account, ready: true, blocking: [] as string[], items: [{ key: "payment_method", state: "ready", required: true }] };
const unfundedChecklist = {
  account: { ...account, canSpend: false, hasFunding: false },
  ready: false,
  blocking: ["payment_method"],
  items: [
    { key: "payment_method", state: "missing", required: true, action: { kind: "portal", url: "https://business.facebook.com/latest/billing_hub" } },
  ],
};
const readinessMock = vi.fn(async () => ({ data: readyChecklist }));

vi.mock("@/app/actions/advertising", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/actions/advertising")>();
  return {
    ...actual,
    listAdAccountsAction: async () => ({ data: [account] }),
    listAdPagesAction: async () => ({ data: [page] }),
    searchAdLocationsAction: async () => ({ data: [] }),
    getAdsReportAction: async () => ({ error: "unused" }),
    getAdEditableObjectAction: async () => ({ error: "unused" }),
    getAdPublishJobAction: async () => ({ error: "unused", status: 404 }),
    getAdReadinessAction: () => readinessMock(),
    syncAdAccountAction: async () => ({ data: account }),
  };
});

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: async (id: string) => ({ id, url: `https://cdn/${id}.jpg`, previewUrl: "", description: "", createdAt: "", type: "image" }),
}));

vi.mock("@/app/actions/pricing", () => ({
  getExchangeRateAction: vi.fn(async () => ({ item: { priceMicros: 5_000_000 } })),
}));

vi.mock("@/app/actions/advertising-create", () => ({
  getAdsOptionsAction: async () => ({ data: options }),
  estimateAdReachAction: async () => ({ data: { lower: 1000, upper: 2000, ready: true } }),
  searchAdTargetingAction: async () => ({ data: [] }),
  validateMetaAdDraftAction: (draft: MetaAdDraft) => validateMock(draft),
  getAdBudgetMinimumAction: async () => ({ data: { daily: 519, currency: "BRL" } }),
}));

vi.mock("@/app/actions/advertising-drafts", () => ({
  getAdDraftAction: (id: string) => getDraftMock(id),
  updateAdDraftAction: (id: string, draft: MetaAdDraft, version: number) => updateMock(id, draft, version),
  publishAdDraftAction: (id: string, version: number) => publishMock(id, version),
  deleteAdDraftAction: (id: string) => deleteMock(id),
}));

vi.mock("@/app/actions/advertising-audiences", () => ({
  listAudiencesAction: async () => ({ data: { termsAccepted: true, audiences: [] } }),
  listSavedAudiencesAction: async () => ({ data: [] }),
  createSavedAudienceAction: async () => ({ error: "unused" }),
}));

function renderEditor(): void {
  const strict = (error: { code: string; message: string }) => {
    throw new Error(`${error.code}: ${error.message}`);
  };
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} onError={strict}>
      <DraftEditor draftId="d-1" />
    </NextIntlClientProvider>,
  );
}

async function goToLastStep(): Promise<void> {
  await screen.findByRole("navigation", { name: "Itens do rascunho" });
  while (screen.queryByRole("button", { name: "Avançar" })) {
    fireEvent.click(screen.getByRole("button", { name: "Avançar" }));
  }
}

async function openPublish(): Promise<HTMLElement> {
  await goToLastStep();
  fireEvent.click(await screen.findByRole("button", { name: "Publicar" }));
  return screen.findByRole("dialog");
}

describe("DraftEditor", () => {
  beforeEach(() => {
    getDraftMock.mockReset();
    getDraftMock.mockResolvedValue({ data: savedDraft() });
    updateMock.mockReset();
    updateMock.mockImplementation(async (_id: string, draft: MetaAdDraft, version: number) => ({ data: savedDraft({ version: version + 1 }, draft) }));
    publishMock.mockReset();
    deleteMock.mockReset();
    validateMock.mockReset();
    pushMock.mockReset();
    readinessMock.mockReset();
    readinessMock.mockResolvedValue({ data: readyChecklist });
  });

  it("opens the draft tree on the campaign with the breadcrumb and the draft status", async () => {
    renderEditor();
    const tree = await screen.findByRole("navigation", { name: "Itens do rascunho" });
    expect(within(tree).getByText("Promo de inverno")).toBeTruthy();
    expect(within(tree).getByText("Conjunto de anúncios")).toBeTruthy();
    expect(within(tree).getByText("Anúncio 1")).toBeTruthy();
    expect(screen.getByText("Em rascunho")).toBeTruthy();
    expect(screen.getByDisplayValue("Promo de inverno")).toBeTruthy();
    expect(screen.getByText("Tipo de compra")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Avançar" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Publicar" })).toBeNull();
    expect(screen.queryByText(/Ao clicar em Publicar, você aceita os/)).toBeNull();
  });

  it("offers Publicar and Meta's terms only on the last step", async () => {
    renderEditor();
    await goToLastStep();
    expect(screen.getByRole("button", { name: "Publicar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeTruthy();
    expect(screen.getByText(/Ao clicar em Publicar, você aceita os/)).toBeTruthy();
  });

  it("moves to the ad set with Avançar and keeps the audience estimate and the budget minimum", async () => {
    renderEditor();
    fireEvent.click(await screen.findByRole("button", { name: "Avançar" }));
    expect(await screen.findByText("Onde acontece o resultado")).toBeTruthy();
    expect(await screen.findByText("Público estimado: 1.000 a 2.000 pessoas", {}, { timeout: 3000 })).toBeTruthy();
    expect(await screen.findByText(/Mínimo da Meta nesta conta: R\$\s?5,19 por dia/)).toBeTruthy();
  });

  it("autosaves an edit with the saved version", async () => {
    renderEditor();
    fireEvent.change(await screen.findByDisplayValue("Promo de inverno"), { target: { value: "Promo de verão" } });
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1), { timeout: 3000 });
    const [id, draft, version] = updateMock.mock.calls[0];
    expect(id).toBe("d-1");
    expect(version).toBe(3);
    expect((draft as MetaAdDraft).campaign.name).toBe("Promo de verão");
    expect(await screen.findByText("Salvo como rascunho")).toBeTruthy();
  });

  it("reloads the draft and tells the person when it changed somewhere else", async () => {
    updateMock.mockResolvedValueOnce({ error: "changed", code: "draft_changed", status: 409 });
    renderEditor();
    const other = buildDraft({ ...readyForm(), campaignName: "Versão da outra aba" }, context);
    getDraftMock.mockResolvedValue({ data: savedDraft({ version: 4 }, other) });
    fireEvent.change(await screen.findByDisplayValue("Promo de inverno"), { target: { value: "Minha versão" } });
    expect(await screen.findByText(/Este rascunho foi alterado em outra aba/, {}, { timeout: 3000 })).toBeTruthy();
    expect(await screen.findByDisplayValue("Versão da outra aba")).toBeTruthy();
  });

  it("validates before publishing, shows the issues and publishes the saved draft", async () => {
    validateMock.mockResolvedValueOnce({ data: { issues: [{ field: "ads[0].creative.link", code: "invalid_url" }], fee: null } });
    validateMock.mockResolvedValueOnce(cleanValidation);
    publishMock.mockResolvedValue({ data: job({ status: "PUBLISHED", progress: { campaignId: "c-9" } }) });
    renderEditor();

    const dialog = await openPublish();
    expect(await within(dialog).findByText("O link precisa começar com https://.")).toBeTruthy();
    const confirm = within(dialog).getByRole("button", { name: "Publicar" });
    expect(confirm).toHaveProperty("disabled", true);

    fireEvent.click(within(dialog).getByRole("button", { name: "Conferir de novo" }));
    expect(await within(dialog).findByText("Tudo certo para publicar.")).toBeTruthy();
    expect(await within(dialog).findAllByText(/R\$\s?5,00/)).toHaveLength(2);

    fireEvent.click(within(dialog).getByRole("switch", { name: "Publicar desligado" }));
    const paused = await within(dialog).findByRole("button", { name: "Publicar desligado" });
    expect(paused).toHaveProperty("disabled", false);
    fireEvent.click(paused);

    await waitFor(() => expect(publishMock).toHaveBeenCalled());
    const lastSave = updateMock.mock.calls.at(-1);
    expect((lastSave?.[1] as MetaAdDraft).keepPaused).toBe(true);
    expect(publishMock).toHaveBeenCalledWith("d-1", (lastSave?.[2] as number) + 1);
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard/advertising?account=acc-1&published=1&job=job-1"));
  });

  it("lets the person build on an account that is not ready and blocks only the publish", async () => {
    readinessMock.mockResolvedValue({ data: unfundedChecklist } as never);
    validateMock.mockResolvedValue(cleanValidation);
    renderEditor();
    expect(await screen.findByText("Há informações em falta sobre a conta que são necessárias")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ir para a Visão geral da conta" }).getAttribute("href")).toContain(
      "/dashboard/advertising/overview?account=acc-1",
    );
    const dialog = await openPublish();
    await waitFor(() => expect(validateMock).toHaveBeenCalled());
    expect(await within(dialog).findByText("Adicione a forma de pagamento")).toBeTruthy();
    expect(within(dialog).getByRole("link", { name: /Abrir na Meta/ }).getAttribute("href")).toBe("https://business.facebook.com/latest/billing_hub");
    expect(within(dialog).getByRole("button", { name: "Publicar" })).toHaveProperty("disabled", true);
    expect(publishMock).not.toHaveBeenCalled();
  });

  it("explains a budget below the Meta minimum with the amount", async () => {
    validateMock.mockResolvedValueOnce({
      data: {
        issues: [{ field: "adSet.budget.amount", code: "below_minimum" }],
        budgetMinimum: { field: "adSet.budget.amount", daily: 519, currency: "BRL" },
      },
    });
    renderEditor();
    const dialog = await openPublish();
    expect(await within(dialog).findByText(/precisa ser de pelo menos R\$\s?5,19/)).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Publicar" })).toHaveProperty("disabled", true);
  });

  it("keeps the draft and explains a failed publish", async () => {
    validateMock.mockResolvedValue(cleanValidation);
    publishMock.mockResolvedValue({
      data: job({ status: "FAILED", fee: "refunded", errorCode: "meta_rejected", errorMessage: "Imagem recusada" }),
    });
    renderEditor();
    const dialog = await openPublish();
    const confirm = await within(dialog).findByRole("button", { name: "Publicar" });
    await waitFor(() => expect(confirm).toHaveProperty("disabled", false));
    fireEvent.click(confirm);
    expect(await within(dialog).findByText("A publicação falhou")).toBeTruthy();
    expect(within(dialog).getByText("Imagem recusada")).toBeTruthy();
    getDraftMock.mockResolvedValue({ data: savedDraft({ version: 4, state: "failed" }) });
    fireEvent.click(within(dialog).getByRole("button", { name: "Voltar ao rascunho" }));
    expect(await screen.findByText("Erro ao publicar")).toBeTruthy();
    expect(pushMock).not.toHaveBeenCalled();

    await waitFor(() => expect(getDraftMock).toHaveBeenCalledTimes(2));
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    const tree = await screen.findByRole("navigation", { name: "Itens do rascunho" });
    fireEvent.click(within(tree).getByText("Promo de inverno"));
    fireEvent.change(await screen.findByDisplayValue("Promo de inverno"), { target: { value: "Promo de verão" } });
    await waitFor(() => expect(updateMock).toHaveBeenCalled(), { timeout: 3000 });
    expect(updateMock.mock.calls.at(-1)?.[2]).toBe(4);
  });

  it("asks to publish when closing and leaves the draft saved", async () => {
    renderEditor();
    fireEvent.click(await screen.findByRole("button", { name: "Fechar" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Publicar itens de rascunho?")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Fechar" }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard/advertising?account=acc-1"));
  });

  it("duplicates an ad from the tree menu and previews it", async () => {
    renderEditor();
    const tree = await screen.findByRole("navigation", { name: "Itens do rascunho" });
    fireEvent.keyDown(within(tree).getByRole("button", { name: "Ações de Anúncio 1" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Duplicar anúncio" }));
    expect(await within(tree).findByText("Anúncio 2")).toBeTruthy();
    expect(screen.getByText("Prévia do anúncio 2 de 2")).toBeTruthy();
  });

  it("shows where the person lands in the Destino tab", async () => {
    renderEditor();
    const tree = await screen.findByRole("navigation", { name: "Itens do rascunho" });
    fireEvent.click(within(tree).getByText("Anúncio 1"));
    fireEvent.mouseDown(await screen.findByRole("tab", { name: "Destino" }));
    fireEvent.click(screen.getByRole("tab", { name: "Destino" }));
    const chat = await screen.findByRole("figure", { name: "Conversa no WhatsApp" });
    expect(within(chat).getByText("Olá! Como posso ajudar?")).toBeTruthy();
    expect(within(chat).getByText("Qual o preço?")).toBeTruthy();
  });

  it("summarises every level in Analisar", async () => {
    renderEditor();
    const analyze = await screen.findByRole("tab", { name: "Analisar" });
    fireEvent.mouseDown(analyze);
    fireEvent.click(analyze);
    expect(await screen.findByText("Nome da campanha")).toBeTruthy();
    expect(screen.getByText("Leilão")).toBeTruthy();
    expect(screen.getAllByText("Promo de inverno").length).toBeGreaterThan(1);
    expect(screen.getByText("Localizações")).toBeTruthy();
  });

  it("goes read only while the draft is publishing", async () => {
    getDraftMock.mockResolvedValue({ data: savedDraft({ state: "publishing", job: job({ status: "RUNNING" }) }) });
    renderEditor();
    expect(await screen.findByText("Publicando")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Descartar rascunho" })).toBeNull();
    fireEvent.change(screen.getByDisplayValue("Promo de inverno"), { target: { value: "x" } });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(updateMock).not.toHaveBeenCalled();
  });
});
