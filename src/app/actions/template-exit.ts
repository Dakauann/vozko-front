import { isActionError, settleResult, type ActionError, type ActionResult } from "@/app/actions/action-result";
import { apiClient } from "@/lib/api/browser-client";
import { ifMatchHeader, isVersionConflict, type VersionedSaveResult } from "@/lib/api/versioned-save";
import type { DraftVerdictRequest } from "@/lib/whatsapp-templates/exit-draft";
import type {
  AudienceExits,
  ButtonActionInput,
  ButtonActionKinds,
  CampaignButtonRoutes,
  DraftExitVerdict,
  ExitVerdict,
  TemplateActionsChange,
  TemplateButtonActions,
} from "@/lib/whatsapp-templates/exit";

function templatePath(templateId: string, rest: string): string {
  return `/whatsapp/templates/${encodeURIComponent(templateId)}/${rest}`;
}

function campaignRoutesPath(campaignId: string): string {
  return `/whatsapp/campaigns/${encodeURIComponent(campaignId)}/button-routes`;
}

async function versioned<Key extends string, T>(
  key: Key,
  saved: ActionResult<T>,
  reload: () => Promise<ActionResult<T>>,
): Promise<VersionedSaveResult<Key, T, ActionError>> {
  if (!isActionError(saved)) return { status: "saved", [key]: saved.data } as VersionedSaveResult<Key, T, ActionError>;
  if (!isVersionConflict(saved)) return { status: "failed", error: saved };
  const current = await reload();
  if (isActionError(current)) return { status: "failed", error: current };
  return { status: "conflict", current: current.data };
}

export async function getTemplateButtonActionsAction(templateId: string): Promise<ActionResult<TemplateButtonActions>> {
  return settleResult(await apiClient<TemplateButtonActions>(templatePath(templateId, "button-actions"), { method: "GET" }));
}

export async function saveTemplateButtonActionsAction(
  templateId: string,
  version: number,
  change: TemplateActionsChange,
): Promise<VersionedSaveResult<"actions", TemplateButtonActions, ActionError>> {
  const saved = settleResult(
    await apiClient<TemplateButtonActions>(templatePath(templateId, "button-actions"), {
      method: "PUT",
      headers: ifMatchHeader(version),
      body: JSON.stringify(change),
    }),
  );
  return versioned("actions", saved, () => getTemplateButtonActionsAction(templateId));
}

export async function getTemplateExitVerdictAction(templateId: string, campaignId?: string): Promise<ActionResult<ExitVerdict>> {
  const query = campaignId ? `?${new URLSearchParams({ campaignId }).toString()}` : "";
  return settleResult(await apiClient<ExitVerdict>(`${templatePath(templateId, "exit-verdict")}${query}`, { method: "GET" }));
}

export async function getCampaignButtonRoutesAction(campaignId: string): Promise<ActionResult<CampaignButtonRoutes>> {
  return settleResult(await apiClient<CampaignButtonRoutes>(campaignRoutesPath(campaignId), { method: "GET" }));
}

export async function saveCampaignButtonRoutesAction(
  campaignId: string,
  version: number,
  routes: ButtonActionInput[],
): Promise<VersionedSaveResult<"routes", CampaignButtonRoutes, ActionError>> {
  const saved = settleResult(
    await apiClient<CampaignButtonRoutes>(campaignRoutesPath(campaignId), {
      method: "PUT",
      headers: ifMatchHeader(version),
      body: JSON.stringify({ routes }),
    }),
  );
  return versioned("routes", saved, () => getCampaignButtonRoutesAction(campaignId));
}

export async function getDraftExitVerdictAction(draft: DraftVerdictRequest): Promise<ActionResult<DraftExitVerdict>> {
  return settleResult(await apiClient<DraftExitVerdict>("/whatsapp/templates/exit-verdict", { method: "POST", body: JSON.stringify(draft) }));
}

export async function getButtonActionKindsAction(): Promise<ActionResult<ButtonActionKinds>> {
  return settleResult(await apiClient<ButtonActionKinds>("/whatsapp/button-action-kinds", { method: "GET" }));
}

export async function getAudienceExitsAction(numbers: string[]): Promise<ActionResult<AudienceExits>> {
  return settleResult(await apiClient<AudienceExits>("/whatsapp/campaigns/exit-audience", { method: "POST", body: JSON.stringify({ numbers }) }));
}
