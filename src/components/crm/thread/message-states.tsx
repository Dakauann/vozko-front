"use client";

import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { CaretDown, Prohibit } from "@/components/icons";
import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import { fullDateTime } from "@/lib/conversations/thread-labels";
import { cn } from "@/lib/utils";

export function RetractedNotice({ outgoing }: { outgoing: boolean }) {
  const t = useTranslations("crmMessage.states");
  return (
    <p className="flex items-center gap-1.5 text-sm italic text-muted-foreground">
      <Prohibit weight="bold" aria-hidden className="h-3.5 w-3.5 flex-shrink-0" />
      {outgoing ? t("retracted") : t("retractedByContact")}
    </p>
  );
}

export function EditedMark({ editedAt }: { editedAt: string }) {
  const t = useTranslations("crmMessage.states");
  const locale = useLocale();
  const when = fullDateTime(editedAt, locale);
  return (
    <TooltipWrapper content={when ? t("editedAt", { when }) : t("edited")}>
      <span className="cursor-default text-2xs italic text-muted-foreground">{t("edited")}</span>
    </TooltipWrapper>
  );
}

export function AudioTranscript({ transcript }: { transcript: string }) {
  const t = useTranslations("crmMessage.transcript");
  const [open, setOpen] = useState(false);
  const regionId = useId();
  return (
    <div className="mt-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-1 rounded-sm text-2xs font-semibold text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CaretDown
          weight="bold"
          aria-hidden
          className={cn("h-3 w-3 transition-transform duration-150 motion-reduce:transition-none", open && "rotate-180")}
        />
        {open ? t("hide") : t("show")}
      </button>
      {open ? (
        <p id={regionId} className="mt-1 select-text whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground">
          {transcript}
        </p>
      ) : null}
    </div>
  );
}
