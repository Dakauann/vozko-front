import { EMPTY_SELECTION, type LevelSelection } from "./manager-toolbar";
import type { AdLevel } from "./types";

export type ManagerPanel = "insights";

export interface ManagerView {
  level: AdLevel;
  selection: LevelSelection;
  panel: ManagerPanel | null;
}

const LEVELS: AdLevel[] = ["campaign", "adset", "ad"];

const TAB_OF: Record<AdLevel, string> = { campaign: "campaigns", adset: "adsets", ad: "ads" };

const SELECTED_PARAM: Record<AdLevel, string> = {
  campaign: "selected_campaign_ids",
  adset: "selected_adset_ids",
  ad: "selected_ad_ids",
};

const PANELS: ManagerPanel[] = ["insights"];

const OWNED_PARAMS = ["account", "campaign", "tab", "panel", ...Object.values(SELECTED_PARAM)];

function levelOfTab(tab: string | null): AdLevel {
  return LEVELS.find((level) => TAB_OF[level] === tab) ?? "campaign";
}

function idsOf(value: string | null): ReadonlySet<string> {
  return new Set((value ?? "").split(",").map((id) => id.trim()).filter(Boolean));
}

function panelOf(value: string | null): ManagerPanel | null {
  return PANELS.find((panel) => panel === value) ?? null;
}

function selectionOf(params: URLSearchParams): LevelSelection {
  const campaignIds = params.get(SELECTED_PARAM.campaign) ?? params.get("campaign");
  return {
    campaign: idsOf(campaignIds),
    adset: idsOf(params.get(SELECTED_PARAM.adset)),
    ad: idsOf(params.get(SELECTED_PARAM.ad)),
  };
}

export function viewFromParams(params: URLSearchParams, accountId: string | null): ManagerView {
  const level = levelOfTab(params.get("tab"));
  const linkedAccount = params.get("account");
  if (linkedAccount && accountId && linkedAccount !== accountId) return { level, selection: EMPTY_SELECTION, panel: null };
  return { level, selection: selectionOf(params), panel: panelOf(params.get("panel")) };
}

export function viewToParams(current: URLSearchParams, view: ManagerView, accountId: string | null): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  OWNED_PARAMS.forEach((name) => next.delete(name));
  if (accountId) next.set("account", accountId);
  if (view.level !== "campaign") next.set("tab", TAB_OF[view.level]);
  for (const level of LEVELS) {
    const ids = [...view.selection[level]].sort();
    if (ids.length > 0) next.set(SELECTED_PARAM[level], ids.join(","));
  }
  if (view.panel) next.set("panel", view.panel);
  return next;
}
