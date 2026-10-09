"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import { Info } from "@/components/icons";
import { selectionSendRefusal } from "@/lib/campaigns/selection-send";
import { cn } from "@/lib/utils";

export function useSelectionSendRefusalText() {
  const t = useTranslations("leadSends.errors");
  return useCallback(
    (code: string | undefined, fallback: string): string => {
      const refusal = selectionSendRefusal(code);
      return refusal ? t(refusal) : fallback;
    },
    [t],
  );
}

export type SelectionSendNoteReason = "fromLeads" | "contentLocked" | "templateLocked" | "contactsLocked";

export function SelectionSendNote({
  reason = "fromLeads",
  className,
}: {
  reason?: SelectionSendNoteReason;
  className?: string;
}) {
  const t = useTranslations("leadSends.campaign");
  return (
    <p role="note" className={cn("notice notice-info flex items-start gap-2 px-3 py-2.5 text-xs", className)}>
      <Info className="notice-ink mt-0.5 size-4 shrink-0" aria-hidden />
      {t(reason)}
    </p>
  );
}
