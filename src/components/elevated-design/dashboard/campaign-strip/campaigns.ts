export type AwarenessCampaign = {
  id: string;
  month: number;
  messagesKey: string;
};

export const CAMPAIGNS: readonly AwarenessCampaign[] = [
  { id: "outubro-rosa", month: 9, messagesKey: "pinkOctober" },
];

export function activeCampaign(now: Date): AwarenessCampaign | null {
  return CAMPAIGNS.find((campaign) => campaign.month === now.getMonth()) ?? null;
}

export function dismissalKey(campaign: AwarenessCampaign, now: Date): string {
  return `campaign-strip:${campaign.id}:${now.getFullYear()}`;
}
