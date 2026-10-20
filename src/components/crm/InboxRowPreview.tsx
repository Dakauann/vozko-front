"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { useDraftPreview } from "@/hooks/use-conversation-drafts";
import { cn } from "@/lib/utils";

interface InboxRowPreviewProps {
  entryKey: string;
  typing: boolean;
  emphasized: boolean;
  children: ReactNode;
}

export function InboxRowPreview({ entryKey, typing, emphasized, children }: InboxRowPreviewProps) {
  const t = useTranslations("crmComposer.inboxRow");
  const draft = useDraftPreview(entryKey);
  const base = "min-w-0 flex-1 truncate text-xs";

  if (typing) {
    return <p className={cn(base, "italic text-muted-foreground")}>{t("typing")}</p>;
  }
  if (draft) {
    return (
      <p className={cn(base, "text-muted-foreground")}>
        <span className="font-semibold">{t("draft")}</span> {draft}
      </p>
    );
  }
  return <p className={cn(base, emphasized ? "font-medium text-foreground" : "text-muted-foreground")}>{children}</p>;
}
