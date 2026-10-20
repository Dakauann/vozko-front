"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { CaretDown, Check } from "@/components/icons";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import {
  closeProvenanceText,
  conversationStatusText,
  getConversationStatusDisplay,
} from "@/lib/conversations/close-provenance";
import {
  nextConversationStatuses,
  type NextConversationStatus,
} from "@/lib/conversations/status-actions";
import { cn } from "@/lib/utils";

interface ConversationStatusControlProps {
  status: string;
  closeSource?: string | null;
  closeReason?: string | null;
  canChange: boolean;
  onChange: (next: NextConversationStatus) => void;
}

const ACTION_LABEL_KEYS: Record<NextConversationStatus, "markOngoing" | "markFinished"> = {
  ongoing: "markOngoing",
  finished: "markFinished",
};

const TRIGGER_CLASS =
  "flex items-center gap-2 rounded-[--radius] border border-border bg-card px-3 py-1.5 text-2xs font-semibold text-foreground transition-colors";

export default function ConversationStatusControl({
  status,
  closeSource,
  closeReason,
  canChange,
  onChange,
}: ConversationStatusControlProps) {
  const t = useTranslations("crmConversationHeader.status");
  const tWindow = useTranslations("liveChat.conversationWindow");
  const [open, setOpen] = useState(false);
  const tStatus = useTranslations("conversationStatus");
  const meta = getConversationStatusDisplay(status, closeSource, closeReason);
  const text = conversationStatusText(meta, tStatus);
  const provenance = meta.provenance ? closeProvenanceText(meta.provenance, tStatus) : null;
  const actions = nextConversationStatuses(status);

  const face = (
    <>
      <span className={cn("h-2 w-2 shrink-0 rounded-full", meta.dotClassName)} />
      <span className="max-w-[11rem] truncate">{text.label}</span>
    </>
  );

  if (!canChange) {
    return (
      <TooltipWrapper content={t("current")}>
        <span className={cn(TRIGGER_CLASS, "cursor-default opacity-90")}>{face}</span>
      </TooltipWrapper>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipWrapper content={t("manage")}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={t("manage")}
            className={cn(TRIGGER_CLASS, "hover:bg-muted")}
          >
            {face}
            <CaretDown weight="bold" className="h-3.5 w-3.5 shrink-0" />
          </button>
        </PopoverTrigger>
      </TooltipWrapper>
      <PopoverContent align="end" className="w-64 p-0 py-1">
        <div className="border-b border-border px-3 py-2">
          <div className="text-2xs font-semibold text-muted-foreground">{t("currentHeading")}</div>
          <div className={cn("mt-1 text-xs font-semibold", meta.menuAccentClassName)}>
            {text.baseLabel}
          </div>
          {meta.provenance && provenance ? (
            <div className="mt-1.5 space-y-0.5 rounded-lg bg-muted px-2.5 py-2">
              <div className="text-2xs text-muted-foreground">
                {t("closedBy")}{" "}
                <span className="font-medium text-foreground">
                  {provenance.by || <EmptyValue />}
                </span>
              </div>
              <div className="text-2xs text-muted-foreground">
                {t("reason")}{" "}
                <span className="font-medium text-foreground">
                  {provenance.reason || <EmptyValue />}
                </span>
              </div>
              {meta.provenance.isSilence ? (
                <div className="text-2xs font-medium text-warning-ink">{t("closedBySilence")}</div>
              ) : null}
            </div>
          ) : null}
        </div>

        {actions.length > 0 ? (
          <div className="py-1">
            {actions.map((next) => (
              <button
                key={next}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onChange(next);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Check weight="bold" className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{tWindow(ACTION_LABEL_KEYS[next])}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="px-3 py-2 text-xs text-muted-foreground">{t("reopensOnMessage")}</div>
        )}
      </PopoverContent>
    </Popover>
  );
}
