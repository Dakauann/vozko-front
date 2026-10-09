"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CircleNotch, TrendUp } from "@/components/icons";

import OpportunityDrawer from "@/components/crm/OpportunityDrawer";
import { useOpportunityCreation } from "@/hooks/use-opportunity-creation";
import { cn } from "@/lib/utils";

interface CreateOpportunityButtonProps {
  entryId: string;
  entryType: string;
  leadName?: string;
  workspaceId?: string;
  className?: string;
}

export default function CreateOpportunityButton({
  entryId,
  entryType,
  leadName,
  workspaceId,
  className,
}: CreateOpportunityButtonProps) {
  const t = useTranslations("opportunityDrawer");
  const { loading, open, setOpen, setup, start } = useOpportunityCreation();

  const handleClick = useCallback(async () => {
    if (loading) return;
    if (!(await start())) toast.error(t("openFailed"));
  }, [loading, start, t]);

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        title={t("fromConversation.hint")}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-[--radius] border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:border-border hover:bg-muted disabled:opacity-60",
          className,
        )}
      >
        {loading ? (
          <CircleNotch weight="bold" className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <TrendUp weight="bold" className="h-3.5 w-3.5" />
        )}
        <span className="hidden sm:inline">{t("fromConversation.label")}</span>
      </button>

      <OpportunityDrawer
        open={open}
        onOpenChange={setOpen}
        opportunity={null}
        pipelineId={setup?.pipelineId ?? ""}
        columns={setup?.columns ?? []}
        customFields={setup?.customFields ?? []}
        workspaceId={workspaceId}
        defaultTitle={leadName}
        linkEntryId={entryId}
        linkEntryType={entryType}
        createdNotice={{
          message: t("fromConversation.created"),
          action: {
            label: t("fromConversation.viewBoard"),
            onClick: () => {
              window.location.href = "/dashboard/sales";
            },
          },
        }}
      />
    </>
  );
}
