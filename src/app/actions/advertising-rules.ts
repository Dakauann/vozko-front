import { accountPath } from "@/lib/advertising/report-query";
import { apiClient } from "@/lib/api/browser-client";
import type { AutomatedRule, RuleRun } from "@/lib/advertising/rules";

import type { AdsResult } from "./advertising";
import { settleAds, withAccount } from "./advertising-result";

const rulePath = (ruleId: string) => `/ads/rules/${encodeURIComponent(ruleId)}`;

export async function listRulesAction(accountId: string): Promise<AdsResult<AutomatedRule[]>> {
  return settleAds(await apiClient<AutomatedRule[]>(`${accountPath(accountId)}/rules`, { method: "GET" }), []);
}

export async function createRuleAction(rule: AutomatedRule): Promise<AdsResult<{ metaId: string }>> {
  return settleAds(await apiClient<{ metaId: string }>("/ads/rules", { method: "POST", body: JSON.stringify(rule) }));
}

export async function setRuleEnabledAction(ruleId: string, accountId: string, enabled: boolean): Promise<AdsResult<null>> {
  return settleAds(
    await apiClient<null>(withAccount(`${rulePath(ruleId)}/status`, accountId), { method: "POST", body: JSON.stringify({ enabled }) }),
    null,
  );
}

export async function deleteRuleAction(ruleId: string, accountId: string): Promise<AdsResult<null>> {
  return settleAds(await apiClient<null>(withAccount(rulePath(ruleId), accountId), { method: "DELETE" }), null);
}

export async function ruleHistoryAction(ruleId: string, accountId: string): Promise<AdsResult<RuleRun[]>> {
  return settleAds(await apiClient<RuleRun[]>(withAccount(`${rulePath(ruleId)}/history`, accountId), { method: "GET" }), []);
}
