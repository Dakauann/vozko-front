"use client";

import { useTranslations } from "next-intl";

import type { DraggableComponent } from "@/components/whatsapp/DragDropBuilder";
import type { TemplateDraftPurpose } from "@/lib/whatsapp-templates/draft";
import { templateExitMissing } from "@/lib/whatsapp-templates/exit";
import { draftVerdictRequest } from "@/lib/whatsapp-templates/exit-draft";

import { ExitVerdictNotice } from "./ExitVerdictNotice";
import { useDraftExitVerdict } from "./use-template-exit";

export function DraftExitStrip({
  components,
  category,
  purpose,
}: {
  components: DraggableComponent[];
  category: string;
  purpose: TemplateDraftPurpose;
}) {
  const t = useTranslations("templateExit.verdict");
  const judged = components.length > 0;
  const { draftVerdict } = useDraftExitVerdict(judged ? draftVerdictRequest(components, category) : null);
  const verdict = draftVerdict?.verdict;
  if (!judged || !verdict || verdict.state !== "none") return null;
  const savingGated = templateExitMissing(verdict);
  const sendsGated = verdict.campaignAcknowledgementRequired !== false;
  if (!savingGated && !sendsGated) return null;
  return (
    <div className="mt-4">
      <ExitVerdictNotice verdict={verdict} quiet={!savingGated} title={t("marketingNone")}>
        {savingGated ? <p className="text-muted-foreground">{t(purpose === "create" ? "creationNeedsExit" : "editNeedsExit")}</p> : null}
        {sendsGated ? <p className="text-muted-foreground">{t("sendsNeedAck")}</p> : null}
      </ExitVerdictNotice>
    </div>
  );
}
