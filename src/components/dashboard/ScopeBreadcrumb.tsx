"use client";

import * as React from "react";

import { Link, usePathname } from "@/i18n/routing";

import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export function ScopeBreadcrumb({ className }: { className?: string }) {
  const t = useTranslations("dashboardNavbar");
  const pathname = usePathname();

  const labelMap: Record<string, string> = {
    dashboard: t("breadcrumbs.dashboard"),
    agents: t("breadcrumbs.agents"),
    new: t("breadcrumbs.new"),
    campaigns: t("breadcrumbs.campaigns"),
    configuracoes: t("breadcrumbs.settings"),
    profile: t("breadcrumbs.profile"),
    "unofficial-whatsapp": t("breadcrumbs.unofficial-whatsapp"),
    broadcasts: t("breadcrumbs.broadcasts"),
    connect: t("breadcrumbs.connect"),
  };

  const segments = pathname.split("/").filter(Boolean);
  const locales = ["pt", "en", "de", "es"];
  const filteredSegments = segments.filter((seg) => !locales.includes(seg));

  const breadcrumbs: { label: string; href: string }[] = [];
  let currentPath = "";
  filteredSegments.forEach((segment) => {
    currentPath += `/${segment}`;

    let label = segment
      .replace(/-/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());

    if (labelMap[segment]) {
      label = labelMap[segment];
    }

    if (!segment.startsWith("[") && !segment.match(/^[a-f0-9-]{36}$/i)) {
      breadcrumbs.push({ label, href: currentPath });
    } else {
      breadcrumbs.push({ label: t("breadcrumbs.details"), href: currentPath });
    }
  });

  if (breadcrumbs.length < 2) return null;

  return (
    <nav
      aria-label={t("breadcrumbs.dashboard")}
      className={cn(
        "flex min-w-0 items-center gap-1 overflow-hidden text-xs text-muted-foreground",
        className,
      )}
    >
      {breadcrumbs.map((crumb, index) => (
        <React.Fragment key={crumb.href}>
          {
}
          {index > 0 && (
            <span
              aria-hidden="true"
              className="hidden shrink-0 opacity-60 sm:inline"
            >
              ›
            </span>
          )}
          {index === breadcrumbs.length - 1 ? (
            <span aria-current="page" className="truncate font-medium">
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.href}
              className="hidden shrink-0 rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:block"
            >
              {crumb.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
