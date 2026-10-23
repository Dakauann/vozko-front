"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { deleteCampaignDraftAction, isDraftActionError } from "@/app/actions/campaign-drafts";
import { PanelSection } from "@/components/dashboard/PanelSection";
import Button from "@/components/elevated-design/button";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { ArrowRight, Trash } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Notice } from "@/components/ui/notice";
import { codedErrorMessage } from "@/lib/api/coded-error";
import type { CampaignDraft, DraftChannel } from "@/lib/campaign-drafts/types";

import { campaignDraftsKey, useCampaignDrafts, useCampaignDraftsWorkspace } from "./use-campaign-drafts";

export interface CampaignDraftsPanelProps {
  channel: DraftChannel;
  continueHref: (id: string) => string;
}

export function CampaignDraftsPanel({ channel, continueHref }: CampaignDraftsPanelProps) {
  const t = useTranslations("campaignWizard");
  const format = useFormatter();
  const client = useQueryClient();
  const workspaceId = useCampaignDraftsWorkspace();
  const drafts = useCampaignDrafts(channel);
  const [removing, setRemoving] = useState<CampaignDraft | null>(null);

  if (drafts.isError) {
    return (
      <Notice tone="fault" title={t("drafts.loadFailed")}>
        <p>{codedErrorMessage(t, { code: drafts.error.message }, t("errors.generic"))}</p>
      </Notice>
    );
  }
  const items = drafts.data ?? [];
  if (items.length === 0) return null;

  const remove = async (draft: CampaignDraft) => {
    const result = await deleteCampaignDraftAction(channel, draft.id);
    if (isDraftActionError(result)) {
      toast.error(t("drafts.deleteFailed"), { description: codedErrorMessage(t, result, t("errors.generic")) });
      return false;
    }
    toast.success(t("drafts.deleted"));
    await client.invalidateQueries({ queryKey: campaignDraftsKey(workspaceId, channel) });
    return true;
  };

  return (
    <PanelSection boxed title={t("drafts.title")} description={t("drafts.description")} contentClassName="p-0">
      <ul className="divide-y divide-border" aria-label={t("drafts.listLabel")}>
        {items.map((draft) => {
          const name = draft.name.trim();
          return (
            <li key={draft.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className={name ? "truncate text-sm font-semibold text-foreground" : "truncate text-sm font-semibold text-muted-foreground"}>{name || t("drafts.unnamed")}</p>
                <p className="text-2xs text-muted-foreground">
                  {t("drafts.updated", { time: format.dateTime(new Date(draft.updatedAt), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) })}
                </p>
              </div>
              <StatusChip tone="muted" label={t("drafts.chip")} />
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" title={t("drafts.delete")} icon={<Trash className="h-4 w-4" />} iconVisible iconSide="left" onClick={() => setRemoving(draft)} />
                <Button variant="secondary" size="sm" title={t("drafts.continue")} icon={<ArrowRight className="h-4 w-4" />} iconVisible iconSide="right" link={continueHref(draft.id)} newTab={false} />
              </div>
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        tone="danger"
        icon={<Trash size={28} />}
        title={t("drafts.deleteTitle")}
        description={t("drafts.deleteBody", { name: removing?.name.trim() || t("drafts.unnamed") })}
        confirmLabel={t("drafts.deleteAction")}
        onConfirm={async () => (removing ? remove(removing) : false)}
      />
    </PanelSection>
  );
}
