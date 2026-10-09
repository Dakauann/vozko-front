import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { AdsOptions } from "@/lib/advertising/draft-types";
import type { AdAccount, AdEditableObject, AdRow } from "@/lib/advertising/types";

import { MultiObjectEditor } from "./multi-object-editor";

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

const options: AdsOptions = {
  objectives: [],
  callsToAction: [],
  destinationCallsToAction: {},
  placements: { facebook: ["feed"] },
  breakdownGroups: null,
  attributionWindows: null,
  pixelEvents: [],
  formats: ["IMAGE"],
  videoOnlyPositions: {},
  automaticPlatforms: [],
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

function campaign(metaId: string, name: string, isOn = true): AdEditableObject {
  return {
    row: row({ metaId, name, isOn, objective: "OUTCOME_ENGAGEMENT" }),
    budget: null,
    bid: { strategy: "LOWEST_COST_WITHOUT_CAP" },
    targeting: null,
    placements: null,
    schedule: null,
    creative: null,
    identity: null,
  };
}

function ad(metaId: string, primaryText: string): AdEditableObject {
  return {
    row: row({ metaId, level: "ad", name: `Anúncio ${metaId}`, campaignId: "c-1", adSetId: "s-1" }),
    budget: null,
    bid: null,
    targeting: null,
    placements: null,
    schedule: null,
    creative: { format: "IMAGE", primaryText, headline: "Mesmo título" },
    identity: { pageId: "p1" },
  };
}

let details: Record<string, AdEditableObject> = {};
const applyMock = vi.fn();
const editMock = vi.fn();
const switchMock = vi.fn();
const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ can: () => true, permissionsLoading: false, currentWorkspace: { id: "ws-1" } }),
}));

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

vi.mock("@/app/actions/advertising", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/actions/advertising")>();
  return {
    ...actual,
    listAdAccountsAction: async () => ({ data: [account] }),
    getAdEditableObjectAction: async (metaId: string) => (details[metaId] ? { data: details[metaId] } : { error: "não encontrado" }),
  };
});

vi.mock("@/app/actions/advertising-bulk", () => ({
  bulkApplyAdObjectsAction: (...args: unknown[]) => applyMock(...args),
  bulkEditAdObjectsAction: (...args: unknown[]) => editMock(...args),
  bulkSetAdObjectsOnAction: (...args: unknown[]) => switchMock(...args),
}));

vi.mock("@/app/actions/advertising-create", () => ({
  getAdsOptionsAction: async () => ({ data: options }),
  getAdBudgetMinimumAction: async () => ({ data: { daily: 519, currency: "BRL" } }),
}));

function renderEditor(metaIds: string[]): void {
  const strict = (error: { code: string; message: string }) => {
    throw new Error(`${error.code}: ${error.message}`);
  };
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} onError={strict}>
      <MultiObjectEditor metaIds={metaIds} accountId="acc-1" />
    </NextIntlClientProvider>,
  );
}

describe("MultiObjectEditor", () => {
  beforeEach(() => {
    details = {};
    applyMock.mockReset();
    editMock.mockReset();
    switchMock.mockReset();
    pushMock.mockReset();
  });

  it("shows mixed names, applies one value to every campaign and returns to the manager", async () => {
    details = { "c-1": campaign("c-1", "Primeira"), "c-2": campaign("c-2", "Segunda") };
    applyMock.mockResolvedValue({ data: { results: [{ metaId: "c-1", ok: true }, { metaId: "c-2", ok: true }] } });
    renderEditor(["c-1", "c-2"]);
    expect(await screen.findByText("Suas edições serão aplicadas a 2 campanhas")).toBeTruthy();
    expect(screen.getByText("2 Campanhas")).toBeTruthy();
    const save = screen.getByRole("button", { name: "Salvar alterações" });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Definir um valor para todos" }));
    fireEvent.change(screen.getByDisplayValue("Primeira"), { target: { value: "Nova campanha" } });
    fireEvent.click(save);
    await waitFor(() => expect(applyMock).toHaveBeenCalledWith(["c-1", "c-2"], { name: "Nova campanha" }));
    expect(editMock).not.toHaveBeenCalled();
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard/advertising?account=acc-1"));
  });

  it("sends ad text through bulk edit and lists the objects that failed", async () => {
    details = { "a-1": ad("a-1", "Oi"), "a-2": ad("a-2", "Olá") };
    editMock.mockResolvedValue({
      data: { results: [{ metaId: "a-1", ok: true }, { metaId: "a-2", ok: false, error: { code: "meta", message: "Texto recusado" } }] },
    });
    renderEditor(["a-1", "a-2"]);
    expect(await screen.findByDisplayValue("Mesmo título")).toBeTruthy();
    expect(screen.getByText("1 Campanha")).toBeTruthy();
    expect(screen.getByText("1 Conjunto de anúncios")).toBeTruthy();
    expect(screen.getByText("2 Anúncios")).toBeTruthy();
    const textBlock = screen.getByText("Texto principal", { selector: "p" }).parentElement as HTMLElement;
    fireEvent.click(within(textBlock).getByRole("button", { name: "Definir um valor para todos" }));
    fireEvent.change(screen.getByDisplayValue("Oi"), { target: { value: "Texto novo" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(editMock).toHaveBeenCalledWith(["a-1", "a-2"], { field: "primaryText", mode: "set", value: "Texto novo" }));
    expect(applyMock).not.toHaveBeenCalled();
    expect(await screen.findByText("Texto recusado")).toBeTruthy();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows mixed statuses and turns every object off at once", async () => {
    details = { "c-1": campaign("c-1", "Primeira"), "c-2": campaign("c-2", "Segunda", false) };
    switchMock.mockResolvedValue({
      data: { results: [{ metaId: "c-1", ok: true, object: { ...details["c-1"].row, isOn: false } }, { metaId: "c-2", ok: true }] },
    });
    renderEditor(["c-1", "c-2"]);
    expect(await screen.findByText("Status mistos")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Desativar todos" }));
    await waitFor(() => expect(switchMock).toHaveBeenCalledWith(["c-1", "c-2"], false));
    expect(await screen.findByText("Desativados")).toBeTruthy();
  });

  it("shows mixed values in Analisar, expandable to each object", async () => {
    details = { "c-1": campaign("c-1", "Primeira"), "c-2": campaign("c-2", "Segunda") };
    renderEditor(["c-1", "c-2"]);
    fireEvent.mouseDown(await screen.findByRole("tab", { name: "Analisar" }), { button: 0 });
    const mixed = await screen.findByText("Valores mistos", { selector: "summary" });
    const list = mixed.parentElement as HTMLElement;
    expect(within(list).getAllByText("Primeira").length).toBeGreaterThan(0);
    expect(within(list).getAllByText("Segunda").length).toBeGreaterThan(0);
  });

  it("fails closed when an object does not load, linking to each one", async () => {
    details = { "c-1": campaign("c-1", "Primeira") };
    renderEditor(["c-1", "c-2"]);
    expect(await screen.findByText("Não foi possível abrir todos os itens selecionados. Abra cada um pelo link abaixo.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Primeira" }).getAttribute("href")).toContain("object=c-1");
    expect(screen.getByText("não encontrado")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Salvar alterações" })).toBeNull();
  });
});
