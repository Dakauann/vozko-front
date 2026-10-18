import { emptyWizardForm, withDestination, withObjective, withParents, type ParentSummary, type WizardForm } from "@/lib/advertising/draft";
import type { AdCreativeFormat, AdMediaRef, AdObjective, AdObjectiveRoute } from "@/lib/advertising/draft-types";
import { formatsFor, isObjective } from "@/lib/advertising/wizard-routes";

export type CreateChoice =
  | { kind: "new"; objective: AdObjective }
  | { kind: "existing"; campaign: ParentSummary; adSet: ParentSummary | null };

type CreatedLevel = "campaign" | "adSet" | "ad";

export interface CreateNames {
  campaign: string;
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
  return { ...form, campaignName: names.campaign };
}

function choiceForm(accountId: string, choice: CreateChoice, routes: AdObjectiveRoute[], names: CreateNames): WizardForm {
  const empty = emptyWizardForm(accountId);
  if (choice.kind === "new") return named(withObjective(empty, choice.objective, routes), names);
  const objective = choiceObjective(choice);
  if (choice.adSet) return withParents(empty, choice.campaign, choice.adSet);
  const form = withParents(empty, choice.campaign, null);
  return objective ? withObjective(form, objective, routes) : form;
}

function singleFormat(media: AdMediaRef): AdCreativeFormat {
  return media.kind === "video" ? "VIDEO" : "IMAGE";
}

function destinationShowing(form: WizardForm, format: AdCreativeFormat, routes: AdObjectiveRoute[]): WizardForm {
  const shows = (destination: WizardForm["destination"]) => formatsFor(destination).includes(format);
  if (shows(form.destination) || form.adSetParent) return form;
  const route = routes.find((candidate) => shows(candidate.destination));
  return route ? withDestination(form, route.destination, routes) : form;
}

function withMedia(form: WizardForm, media: AdMediaRef, routes: AdObjectiveRoute[]): WizardForm {
  const format = singleFormat(media);
  const fitted = destinationShowing(form, format, routes);
  if (!formatsFor(fitted.destination).includes(format)) return form;
  const [first, ...rest] = fitted.ads;
  return { ...fitted, ads: [{ ...first, format, media: { kind: media.kind, mediaId: media.mediaId, url: "" } }, ...rest] };
}

export function initialForm(accountId: string, choice: CreateChoice, routes: AdObjectiveRoute[], names: CreateNames, media?: AdMediaRef | null): WizardForm {
  const form = choiceForm(accountId, choice, routes, names);
  return media ? withMedia(form, media, routes) : form;
}
