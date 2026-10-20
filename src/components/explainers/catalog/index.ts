import { adsExplainers } from "./ads";
import { agentExplainers } from "./agents";
import { campaignExplainers } from "./campaigns";
import { crmExplainers } from "./crm";
import { formExplainers } from "./forms";
import { settingsExplainers } from "./settings";
import { socialExplainers } from "./social";
import type { ExplainerSpec } from "./types";

const AREAS = {
  campaigns: campaignExplainers,
  settings: settingsExplainers,
  social: socialExplainers,
  ads: adsExplainers,
  crm: crmExplainers,
  agents: agentExplainers,
  forms: formExplainers,
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
