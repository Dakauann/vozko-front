"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { isActionError, type ActionError } from "@/app/actions/action-result";
import { getCampaignButtonRoutesAction, saveCampaignButtonRoutesAction } from "@/app/actions/template-exit";
import { codedErrorMessage } from "@/lib/api/coded-error";
import { actionInputs, choicesOf, seenTexts, type ButtonActionChoice, type ButtonChoices, type ButtonRoute } from "@/lib/whatsapp-templates/exit";

import { useExitAcknowledgement } from "./use-exit-acknowledgement";
import { useTemplateButtonActions, useTemplateExitVerdict } from "./use-template-exit";

const ROUTES_CONFLICT_RETRIES = 2;
const NO_KINDS: readonly string[] = [];

function shownOnForm(buttons: readonly ButtonRoute[], choices: ButtonChoices): Record<number, string> {
  return Object.fromEntries(buttons.filter((button) => button.index in choices).map((button) => [button.index, button.text]));
}

function campaignRoutesOf(buttons: readonly ButtonRoute[]) {
  return buttons.flatMap((button) => (button.source === "campaign" && button.action ? [button.action] : []));
}

async function saveRoutes(campaignId: string, choices: ButtonChoices, shown: Record<number, string>): Promise<ActionError | null> {
  for (let attempt = 0; attempt <= ROUTES_CONFLICT_RETRIES; attempt++) {
    const current = await getCampaignButtonRoutesAction(campaignId);
    if (isActionError(current)) return current;
    const texts = { ...seenTexts(current.data.buttons, current.data.routes, new Set()), ...shown };
    const routes = actionInputs({ ...choicesOf(current.data.routes), ...choices }, texts);
    const saved = await saveCampaignButtonRoutesAction(campaignId, current.data.version, routes);
    if (saved.status === "saved") return null;
    if (saved.status === "failed") return saved.error;
  }
  return { error: "button routes changed while saving", code: "version_conflict", status: 409 };
}

export function useCampaignExit({
  templateId,
  campaignId,
  mode,
  initialTemplateId,
  initial,
}: {
  templateId: string;
  campaignId?: string;
  mode: "create" | "edit";
  initialTemplateId?: string;
  initial?: { templateId: string; choices: ButtonChoices; acknowledged: boolean };
}) {
  const gate = useExitAcknowledgement(templateId, {
    required: mode === "create" || templateId !== initialTemplateId,
    initial: initial ? { templateId: initial.templateId, checked: initial.acknowledged } : undefined,
  });
  const routed = useTemplateExitVerdict(campaignId ? templateId : "", campaignId ?? "");
  const allowedKinds = useTemplateButtonActions(templateId).actions?.allowedKinds ?? NO_KINDS;
  const [edited, setEdited] = useState<{ templateId: string; choices: ButtonChoices }>(() => (initial ? { templateId: initial.templateId, choices: initial.choices } : { templateId: "", choices: {} }));
  const changes = useMemo(() => (edited.templateId === templateId ? edited.choices : {}), [edited, templateId]);

  const overrides: ButtonChoices = useMemo(() => ({ ...choicesOf(campaignRoutesOf(routed.verdict?.buttons ?? [])), ...changes }), [routed.verdict, changes]);

  const setOverride = useCallback(
    (index: number, choice: ButtonActionChoice | null) => setEdited({ templateId, choices: { ...changes, [index]: choice } }),
    [changes, templateId],
  );

  const t = useTranslations("templateExit");
  const refusal = useCallback((code: string | undefined): string | null => (code && t.has(`errors.${code}`) ? t(`errors.${code}`) : null), [t]);

  const saveOverrides = useCallback(
    async (savedCampaignId: string): Promise<string | null> => {
      if (Object.keys(changes).length === 0) return null;
      const error = await saveRoutes(savedCampaignId, changes, shownOnForm(gate.verdict?.buttons ?? [], changes));
      return error ? `${t("campaign.overrideFailed")} ${codedErrorMessage(t, { code: error.code }, error.error)}` : null;
    },
    [changes, gate.verdict, t],
  );

  const { reload: reloadVerdict } = gate;
  const { reload: reloadRoutes } = routed;
  const reload = useCallback(() => {
    reloadVerdict();
    reloadRoutes();
  }, [reloadVerdict, reloadRoutes]);

  const routeInputs = useMemo(() => actionInputs(changes, shownOnForm(gate.verdict?.buttons ?? [], changes)), [changes, gate.verdict]);

  return { ...gate, error: gate.error ?? routed.error, reload, overrides, changes, routeInputs, setOverride, saveOverrides, refusal, allowedKinds };
}

export type CampaignExit = ReturnType<typeof useCampaignExit>;
