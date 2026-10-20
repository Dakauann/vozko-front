"use client";

import { useTranslations } from "next-intl";

import { publicationDot } from "@/lib/whatsapp-forms/status";
import type { PublicationBrief, PublicationStatus } from "@/lib/whatsapp-forms/types";
import { cn } from "@/lib/utils";

export function PublicationMarks({ publications }: { publications: readonly Pick<PublicationBrief, "metaWabaId" | "status">[] }) {
  const t = useTranslations("whatsappForms");
  if (publications.length === 0) return <span className="text-sm text-muted-foreground">{t("list.notPublished")}</span>;
  const counts = new Map<PublicationStatus, number>();
  for (const publication of publications) counts.set(publication.status, (counts.get(publication.status) ?? 0) + 1);
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {[...counts.entries()].map(([status, count]) => (
        <li key={status} className="inline-flex items-center gap-1.5 text-sm text-foreground">
          <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", publicationDot(status))} />
          {publications.length > 1 ? t("list.statusCount", { status: t(`status.${status}`), count }) : t(`status.${status}`)}
        </li>
      ))}
    </ul>
  );
}
