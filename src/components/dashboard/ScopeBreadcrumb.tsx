"use client";

import * as React from "react";

import { Link, usePathname } from "@/i18n/routing";

import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

/**
 * The breadcrumb trail, relocated from the app bar to the page it describes.
 *
 * The Azure shell keeps its trail with the content: the bar names the product
 * and the scope, and the path to the current screen sits directly above the
 * title it leads to. This renders that trail from the pathname alone, so the
 * page header can show it on every page without any call site passing props.
 *
 * The label map and segment logic are moved verbatim from the previous
 * navbar implementation — same translation namespace, same keys.
 */
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
    // Without a mapping the segment is titleised into "Unofficial Whatsapp",
    // which is wrong in every locale including English.
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

  // A one-crumb trail points nowhere; the title below already names the page.
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
          {/* The separator hides with the crumb it separates: below sm the
              intermediate crumbs are hidden, and a bare leading separator
              pointing at nothing would render on every mobile screen. */}
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
