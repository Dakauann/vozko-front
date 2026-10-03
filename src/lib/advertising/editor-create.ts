import { emptyWizardForm, withObjective, withParents, type ParentSummary, type WizardForm } from "@/lib/advertising/draft";
import type { AdObjective, AdObjectiveRoute } from "@/lib/advertising/draft-types";
import { isObjective } from "@/lib/advertising/wizard-routes";

export type CreateChoice =
  | { kind: "new"; objective: AdObjective }
  | { kind: "existing"; campaign: ParentSummary; adSet: ParentSummary | null };

export type CreatedLevel = "campaign" | "adSet" | "ad";

export interface CreateNames {
  campaign: string;
  adSet: string;
  ad: string;
}

export function choiceObjective(choice: CreateChoice): AdObjective | null {
  if (choice.kind === "new") return choice.objective;
  return isObjective(choice.campaign.objective) ? choice.campaign.objective : null;
}

export function createdLevels(choice: CreateChoice): CreatedLevel[] {
  if (choice.kind === "new") return ["campaign", "adSet", "ad"];
  return choice.adSet ? ["ad"] : ["adSet", "ad"];
}

function named(form: WizardForm, names: CreateNames): WizardForm {
  return { ...form, campaignName: names.campaign, adSetName: names.adSet, ads: form.ads.map((ad) => ({ ...ad, name: names.ad })) };
}

export function initialForm(accountId: string, choice: CreateChoice, routes: AdObjectiveRoute[], names: CreateNames): WizardForm {
  const empty = emptyWizardForm(accountId);
  if (choice.kind === "new") return named(withObjective(empty, choice.objective, routes), names);
  const objective = choiceObjective(choice);
  if (choice.adSet) {
    const form = withParents(empty, choice.campaign, choice.adSet);
    return { ...form, ads: form.ads.map((ad) => ({ ...ad, name: names.ad })) };
  }
  const form = withParents(empty, choice.campaign, null);
  const routed = objective ? withObjective(form, objective, routes) : form;
  return { ...routed, adSetName: names.adSet, ads: routed.ads.map((ad) => ({ ...ad, name: names.ad })) };
}
