import type { MetaAdDraft } from "./draft-types";
import type { ManagerRow } from "./live";
import type { AdAccount, AdDraftRow, AdMetrics, AdOutcome, AdSavedDraft } from "./types";

export function fixtureMetrics(overrides: Partial<AdMetrics> = {}): AdMetrics {
  return {
    currency: "BRL",
    spend: 0,
    impressions: 0,
    clicks: 0,
    linkClicks: 0,
    results: 0,
    resultAction: "",
    mixedResults: false,
    costPerResult: null,
    conversations: 0,
    costPerConversation: null,
    cpc: null,
    cpm: null,
    ctr: null,
    ...overrides,
  };
}

export function fixtureOutcome(overrides: Partial<AdOutcome> = {}): AdOutcome {
  return {
    conversations: 0,
    leads: 0,
    wonDeals: 0,
    revenue: 0,
    costPerConversation: null,
    costPerLead: null,
    roas: null,
    ...overrides,
  };
}

export function fixtureRow(overrides: Partial<ManagerRow> = {}): ManagerRow {
  return {
    metaId: "100",
    level: "campaign",
    name: "Campanha",
    status: "ACTIVE",
    effectiveStatus: "ACTIVE",
    delivery: "active",
    isOn: true,
    canToggle: true,
    dailyBudget: 0,
    lifetimeBudget: 0,
    issues: [],
    metrics: fixtureMetrics(),
    outcome: fixtureOutcome(),
    live: null,
    ...overrides,
  };
}

export function fixtureAccount(overrides: Partial<AdAccount> = {}): AdAccount {
  return {
    id: "a1",
    metaAccountId: "act_1",
    name: "Conta",
    currency: "BRL",
    timezone: "America/Sao_Paulo",
    metaStatus: "active",
    connection: "CONNECTED",
    hasFunding: true,
    canSpend: true,
    canManage: true,
    canSetSpendCap: true,
    role: "admin",
    ...overrides,
  };
}

export function fixtureContent(overrides: Partial<MetaAdDraft> = {}): MetaAdDraft {
  return {
    adAccountId: "a1",
    identity: { pageId: "p1" },
    campaign: { name: "Nova campanha de Leads", objective: "OUTCOME_LEADS" },
    adSet: {
      name: "Novo conjunto de anúncios de Leads",
      targeting: { locations: [], ageMin: 18, ageMax: 65, advantageAudience: true },
      placements: { automatic: true },
    },
    ads: [
      { name: "Novo anúncio de Leads", creative: { format: "IMAGE" } },
      { name: "Segundo anúncio", creative: { format: "IMAGE" } },
    ],
    ...overrides,
  };
}

export function fixtureDraftRows(id: string): AdDraftRow[] {
  return [
    { key: `${id}:campaign`, level: "campaign", name: "Nova campanha de Leads", budget: { kind: "DAILY", amount: 2000 } },
    { key: `${id}:adset`, level: "adset", name: "Novo conjunto de anúncios de Leads", parentKey: `${id}:campaign` },
    { key: `${id}:ad:0`, level: "ad", name: "Novo anúncio de Leads", parentKey: `${id}:adset` },
    { key: `${id}:ad:1`, level: "ad", name: "Segundo anúncio", parentKey: `${id}:adset` },
  ];
}

export function fixtureDraft(overrides: Partial<AdSavedDraft> = {}): AdSavedDraft {
  const id = overrides.id ?? "d1";
  return {
    id,
    adAccountId: "a1",
    draft: fixtureContent(),
    version: 1,
    state: "editing",
    rows: fixtureDraftRows(id),
    createdAt: "2026-10-03T10:00:00Z",
    updatedAt: "2026-10-03T10:00:00Z",
    ...overrides,
  };
}
