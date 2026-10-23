import { emptyAudienceDraft, leadsSelectionOf, type AudienceDraft, type VariableChoice } from "@/lib/campaign-audience/draft";
import { emptyCrmFilter } from "@/lib/crm/board";
import type { Document } from "@/lib/email-design/types";

import type { ABTest, Campaign, CampaignRequest, MergePolicy, Selection, UTM, WinnerMetric } from "./types";

export const AB_TEST_PERCENT = { min: 10, max: 50, step: 5, initial: 20 } as const;

export const AB_DECIDE_MINUTES = { min: 30, max: 1440, initial: 120 } as const;

export const AB_DECIDE_CHOICES = [30, 60, 120, 240, 480, 720, 1440] as const;

export const MAX_TEST_RECIPIENTS = 5;

export interface ABDraft {
  enabled: boolean;
  variantBSubject: string;
  testPercent: number;
  winnerMetric: WinnerMetric;
  decideAfterMinutes: number;
}

export interface CampaignDraft {
  name: string;
  senderId: string;
  subject: string;
  preheader: string;
  document: Document | null;
  ab: ABDraft;
  audience: AudienceDraft;
  utm?: UTM;
}

export const DEFAULT_AB: ABDraft = {
  enabled: false,
  variantBSubject: "",
  testPercent: AB_TEST_PERCENT.initial,
  winnerMetric: "opens",
  decideAfterMinutes: AB_DECIDE_MINUTES.initial,
};

export function emptyDraft(): CampaignDraft {
  return { name: "", senderId: "", subject: "", preheader: "", document: null, ab: { ...DEFAULT_AB }, audience: emptyAudienceDraft("email") };
}

export function audienceSelection(audience: AudienceDraft): Selection | undefined {
  if (audience.source !== "leads") return undefined;
  const selection = leadsSelectionOf(audience);
  if (!selection) return undefined;
  if (selection.mode === "ids") return { mode: "ids", ids: selection.ids ?? [] };
  const wide: Selection = selection.mode === "everyone" ? { mode: "everyone" } : selection.mode === "first_n" ? { mode: "first_n", filter: selection.filter, limit: selection.limit, sort: selection.sort } : { mode: "all_matching", filter: selection.filter };
  if (selection.includeIds) wide.include_ids = selection.includeIds;
  if (selection.excludeIds) wide.exclude_ids = selection.excludeIds;
  return wide;
}

function mergePolicyOf(key: string, choice: VariableChoice): MergePolicy | null {
  if (choice.missing === "exclude") return { key, missing: "exclude" };
  const text = choice.text?.trim() ?? "";
  return choice.missing === "text" && text !== "" ? { key, missing: "text", text } : null;
}

export function mergePoliciesOf(choices: Record<string, VariableChoice>): MergePolicy[] {
  return Object.entries(choices).flatMap(([key, choice]) => {
    const policy = mergePolicyOf(key, choice);
    return policy ? [policy] : [];
  });
}

function abTestOf(ab: ABDraft): ABTest | undefined {
  if (!ab.enabled) return undefined;
  return {
    variant_b_subject: ab.variantBSubject.trim(),
    test_percent: ab.testPercent,
    winner_metric: ab.winnerMetric,
    decide_after_minutes: ab.decideAfterMinutes,
  };
}

export function campaignRequest(draft: CampaignDraft): CampaignRequest {
  const request: CampaignRequest = { name: draft.name.trim(), subject: draft.subject };
  if (draft.senderId) request.sender_id = draft.senderId;
  if (draft.preheader.trim()) request.preheader = draft.preheader;
  if (draft.document) request.document = draft.document;
  const selection = audienceSelection(draft.audience);
  if (selection) request.selection = selection;
  if (draft.audience.source === "list" && draft.audience.listId) request.list_id = draft.audience.listId;
  const policies = mergePoliciesOf(draft.audience.variables);
  if (policies.length > 0) request.merge_policies = policies;
  const ab = abTestOf(draft.ab);
  if (ab) request.ab_test = ab;
  if (draft.utm) request.utm = draft.utm;
  return request;
}

export function requestFingerprint(request: CampaignRequest): string {
  return JSON.stringify(request);
}

function choicesOf(policies: readonly MergePolicy[] | undefined): Record<string, VariableChoice> {
  return Object.fromEntries((policies ?? []).map((policy) => [policy.key, policy.missing === "text" ? { missing: "text", text: policy.text ?? "" } : { missing: "exclude" }]));
}

export function audienceOfSelection(selection: Selection | undefined): AudienceDraft {
  const empty = emptyAudienceDraft("email");
  if (!selection) return empty;
  const excluded = { ...empty, excludeIds: selection.exclude_ids ?? [], includeIds: selection.include_ids ?? [] };
  switch (selection.mode) {
    case "everyone":
      return { ...excluded, pick: "everyone" };
    case "ids":
      return { ...empty, pick: "ids", ids: selection.ids ?? [] };
    case "first_n":
      return { ...excluded, pick: "first_n", filter: selection.filter ?? emptyCrmFilter, limit: selection.limit, sort: selection.sort };
    default:
      return { ...excluded, pick: "filter", filter: selection.filter ?? emptyCrmFilter };
  }
}

function audienceOf(campaign: Campaign): AudienceDraft {
  const audience = campaign.list_id ? { ...emptyAudienceDraft("email"), source: "list" as const, listId: campaign.list_id } : audienceOfSelection(campaign.selection);
  return { ...audience, variables: choicesOf(campaign.merge_policies) };
}

export function draftOf(campaign: Campaign): CampaignDraft {
  const ab = campaign.ab_test;
  return {
    name: campaign.name,
    senderId: campaign.sender_id ?? "",
    subject: campaign.subject,
    preheader: campaign.preheader ?? "",
    document: campaign.document.blocks.length > 0 ? campaign.document : null,
    ab: ab
      ? { enabled: true, variantBSubject: ab.variant_b_subject, testPercent: ab.test_percent, winnerMetric: ab.winner_metric, decideAfterMinutes: ab.decide_after_minutes }
      : { ...DEFAULT_AB },
    audience: audienceOf(campaign),
    ...(campaign.utm ? { utm: campaign.utm } : {}),
  };
}

export function duplicateRequest(campaign: Campaign, name: string): CampaignRequest {
  const request = campaignRequest({ ...draftOf(campaign), name });
  delete request.list_id;
  return { ...request, ...(campaign.selection ? { selection: campaign.selection } : {}) };
}

export function parseTestAddresses(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[\s,;]+/)) {
    const address = raw.trim();
    if (!address) continue;
    const key = address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(address);
  }
  return out;
}

export function runeLength(value: string): number {
  return Array.from(value).length;
}
