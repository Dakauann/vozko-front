"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";

import { leadDetailHref } from "@/lib/leads/detail";
import type { NumberHolder, SharedNumber } from "@/lib/leads/detail-summary";
import { formatPhoneForDisplay } from "@/lib/phone/display";
import { cn } from "@/lib/utils";

export function SharedNumberHolders({
  shared,
  variant,
  linked = false,
  className,
}: {
  shared: SharedNumber | undefined;
  variant: "row" | "sheet";
  linked?: boolean;
  className?: string;
}) {
  const t = useTranslations("leadDetail");
  const format = useFormatter();
  if (!shared || shared.holders.length === 0) return null;

  const labelOf = (holder: NumberHolder) => holder.name ?? (holder.number ? formatPhoneForDisplay(holder.number) : t("unnamed"));
  const names = shared.holders.map((holder) =>
    linked ? (
      <Link key={holder.leadId} href={leadDetailHref(holder.leadId)} className="font-medium text-primary-ink hover:underline">
        {labelOf(holder)}
      </Link>
    ) : (
      <span key={holder.leadId} className="font-medium text-foreground">
        {labelOf(holder)}
      </span>
    ),
  );
  const items = shared.more ? [...names, <span key="others">{t("sharedNumber.others")}</span>] : names;

  return (
    <span className={cn("text-xs text-muted-foreground", className)}>
      {t.rich(`sharedNumber.${variant}`, { names: () => <>{Array.from(format.list(items))}</> })}
    </span>
  );
}
