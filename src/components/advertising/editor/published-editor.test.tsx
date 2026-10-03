import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { AdsOptions } from "@/lib/advertising/draft-types";
import type { AdAccount, AdEditableObject, AdObjectEdit, AdPage, AdRow } from "@/lib/advertising/types";

import { PublishedEditor } from "./published-editor";

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

const page: AdPage = { pageId: "p1", name: "Loja da Ana", canAdvertise: true, leadTermsAccepted: true, numbers: null };

const options: AdsOptions = {
  objectives: [{ objective: "OUTCOME_ENGAGEMENT", routes: [{ destination: "WHATSAPP", goals: ["CONVERSATIONS"] }] }],
  callsToAction: [],
  destinationCallsToAction: {},
  placements: { facebook: ["feed"] },
  breakdownGroups: null,
  attributionWindows: null,
  pixelEvents: [],
  formats: ["IMAGE"],
};

function row(changes: Partial<AdRow>): AdRow {
  return {
    metaId: "",
    level: "campaign",
    name: "",
    status: "ACTIVE",
    effectiveStatus: "ACTIVE",
    delivery: "active",
    isOn: true,
    canToggle: true,
    dailyBudget: 0,
    lifetimeBudget: 0,
    issues: null,
    ...changes,
  } as AdRow;
}

const campaign = row({ metaId: "c-1", level: "campaign", name: "Campanha viva", objective: "OUTCOME_ENGAGEMENT" });
const adSet = row({ metaId: "s-1", level: "adset", name: "Conjunto vivo", campaignId: "c-1", destinationType: "WHATSAPP", optimizationGoal: "CONVERSATIONS" });
const ad = row({ metaId: "a-1", level: "ad", name: "Anúncio vivo", campaignId: "c-1", adSetId: "s-1", creative: { imageUrl: "https://cdn/a.jpg" } });

const details: Record<string, AdEditableObject> = {
  "c-1": { row: campaign, budget: null, bid: { strategy: "LOWEST_COST_WITHOUT_CAP" }, targeting: null, placements: null, schedule: null, creative: null, identity: null },
  "a-1": {
    row: ad,
    budget: null,
    bid: null,
    targeting: null,
    placements: null,
    schedule: null,
    creative: { format: "IMAGE", primaryText: "Fale com a gente", media: { kind: "image", mediaId: "m1" }, greeting: "Oi! Quer saber o preço?" },
    identity: { pageId: "p1" },
  },
};

const updateMock = vi.fn();
const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ can: () => true, permissionsLoading: false, currentWorkspace: { id: "ws-1" } }),
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: () => undefined }) }));

vi.mock("@/app/actions/advertising", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/actions/advertising")>();
  return {
    ...actual,
    listAdAccountsAction: async () => ({ data: [account] }),
    listAdPagesAction: async () => ({ data: [page] }),
    getAdEditableObjectAction: async (metaId: string) => (details[metaId] ? { data: details[metaId] } : { error: "missing" }),
    getAdsReportAction: async (_id: string, filters: { level: string }) => ({
      data: { rows: filters.level === "campaign" ? [campaign] : filters.level === "adset" ? [adSet] : [ad] },
    }),
    updateAdObjectAction: (metaId: string, edit: AdObjectEdit) => updateMock(metaId, edit),
  };
});

vi.mock("@/app/actions/advertising-create", () => ({
  getAdsOptionsAction: async () => ({ data: options }),
  getAdBudgetMinimumAction: async () => ({ data: { daily: 519, currency: "BRL" } }),
}));

function renderEditor(metaId: string): void {
  const strict = (error: { code: string; message: string }) => {
    throw new Error(`${error.code}: ${error.message}`);
  };
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} onError={strict}>
      <PublishedEditor metaId={metaId} accountId="acc-1" />
    </NextIntlClientProvider>,
  );
}

describe("PublishedEditor", () => {
  beforeEach(() => {
    updateMock.mockReset();
    pushMock.mockReset();
  });

  it("shows the campaign tree and saves an edit through the live object path", async () => {
    updateMock.mockResolvedValue({ data: { ...campaign, name: "Campanha nova" } });
    renderEditor("c-1");
    const tree = await screen.findByRole("navigation", { name: "Itens da campanha" });
    expect(within(tree).getByText("Conjunto vivo")).toBeTruthy();
    expect(within(tree).getByText("Anúncio vivo")).toBeTruthy();
    fireEvent.change(await screen.findByDisplayValue("Campanha viva"), { target: { value: "Campanha nova" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith("c-1", { name: "Campanha nova" }));
  });

  it("previews a live ad with its destination and swaps its creative", async () => {
    updateMock.mockResolvedValue({ data: ad });
    renderEditor("a-1");
    expect(await screen.findByRole("figure", { name: "Prévia do anúncio" })).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "Trocar criativo" }));
    fireEvent.change(await screen.findByDisplayValue("Fale com a gente"), { target: { value: "Novo texto" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar criativo" }));
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    const [metaId, edit] = updateMock.mock.calls[0];
    expect(metaId).toBe("a-1");
    expect((edit as AdObjectEdit).creative).toMatchObject({ format: "IMAGE", primaryText: "Novo texto", media: { kind: "image", mediaId: "m1" } });
  });

  it("moves through the tree with Avançar and closes back to the campaign", async () => {
    renderEditor("c-1");
    fireEvent.click(await screen.findByRole("button", { name: "Avançar" }));
    expect(await screen.findByRole("button", { name: "Conjunto vivo", current: true })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(pushMock).toHaveBeenCalledWith("/dashboard/advertising?account=acc-1&campaign=c-1");
  });
});
