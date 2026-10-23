import { adsExplainers } from "./ads";
import { agentExplainers } from "./agents";
import { campaignExplainers } from "./campaigns";
import { crmExplainers } from "./crm";
import { emailExplainers } from "./email";
import { emailCampaignExplainers } from "./email-campaigns";
import { formExplainers } from "./forms";
import { settingsExplainers } from "./settings";
import { sheetExplainers } from "./sheets";
import { socialExplainers } from "./social";
import { workflowExplainers } from "./workflows";
import type { ExplainerSpec } from "./types";

const AREAS = {
  campaigns: campaignExplainers,
  settings: settingsExplainers,
  social: socialExplainers,
  ads: adsExplainers,
  crm: crmExplainers,
  agents: agentExplainers,
  forms: formExplainers,
  emailCampaigns: emailCampaignExplainers,
  email: emailExplainers,
  workflows: workflowExplainers,
  sheets: sheetExplainers,
} as const;

type Areas = typeof AREAS;

export type ExplainerId = { [Area in keyof Areas]: `${Area}.${Extract<keyof Areas[Area], string>}` }[keyof Areas];

export function explainerSpec(id: ExplainerId): ExplainerSpec {
  const [area, key] = id.split(".") as [keyof Areas, string];
  return (AREAS[area] as Record<string, ExplainerSpec>)[key];
}

export function explainerIds(): ExplainerId[] {
  return (Object.keys(AREAS) as (keyof Areas)[]).flatMap((area) => Object.keys(AREAS[area]).map((key) => `${area}.${key}` as ExplainerId));
}
