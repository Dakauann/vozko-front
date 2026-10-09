"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { leadNameLines } from "@/lib/leads/display";
import { cn } from "@/lib/utils";

const SEPARATOR = " · ";

export function RelativeLines({
  name,
  number,
  href,
  leading,
  trailing,
}: {
  name?: string;
  number?: string;
  href?: string;
  leading?: string;
  trailing?: string;
}) {
  const t = useTranslations("leadSheet.family");
  const lines = leadNameLines({ realName: name, number: number ?? "" });
  const title = lines.title || t("unnamed");
  const titleClass = cn("block truncate text-sm text-foreground", lines.titleMono ? "font-mono" : "font-medium", href && "hover:underline");
  const detail = lines.detail.kind === "identity" ? lines.detail.text : lines.detail.kind === "noName" ? t("unnamed") : t("noWhatsApp");
  return (
    <>
      {href ? (
        <Link href={href} className={titleClass}>
          {title}
        </Link>
      ) : (
        <span className={titleClass}>{title}</span>
      )}
      <span className="block truncate text-xs text-muted-foreground">
        {leading ? `${leading}${SEPARATOR}` : null}
        <span className={cn(lines.detail.kind === "identity" && "font-mono")}>{detail}</span>
        {trailing ? `${SEPARATOR}${trailing}` : null}
      </span>
    </>
  );
}
