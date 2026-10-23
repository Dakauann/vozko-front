import { apiClient } from "@/lib/api/browser-client";
import { choiceStatsAnswer, type ChoiceStatsAnswer } from "@/lib/choice-stats/answer";
import { readPromptChoiceStats, readTemplateChoiceStats, type PromptChoiceStats } from "@/lib/choice-stats/stats";

async function promptStats(path: string, read: (raw: unknown) => PromptChoiceStats | null): Promise<ChoiceStatsAnswer<PromptChoiceStats>> {
  return choiceStatsAnswer(await apiClient<unknown>(path, { method: "GET" }), read);
}

export function getWhatsAppCampaignChoiceStatsAction(campaignId: string) {
  return promptStats(`/whatsapp-campaigns/${encodeURIComponent(campaignId)}/choice-stats`, readPromptChoiceStats);
}

export function getUnofficialCampaignChoiceStatsAction(campaignId: string) {
  return promptStats(`/unofficial-whatsapp-campaigns/${encodeURIComponent(campaignId)}/choice-stats`, readPromptChoiceStats);
}

export function getTemplateChoiceStatsAction(templateId: string) {
  return promptStats(`/whatsapp-templates/${encodeURIComponent(templateId)}/choice-stats`, readTemplateChoiceStats);
}
