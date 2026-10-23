"use client";

import { useTranslations } from "next-intl";

import { EnvelopeSimple } from "@/components/icons";
import { useAccess } from "@/hooks/use-access";
import { Link, usePathname } from "@/i18n/routing";
import { openDock } from "@/lib/aichat/dock-state";
import type { EmailDesignCard } from "@/lib/aichat/types";
import { pathForScreen } from "@/lib/navigation/routes";

const ACTION =
  "inline-flex items-center gap-1.5 self-start rounded-[--radius] bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors duration-DEFAULT hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:self-auto";

export function EmailDesignCardView({ card }: { card: EmailDesignCard }) {
  const t = useTranslations("aiChatPage.emailDesign");
  const { decideScreen } = useAccess();
  const here = usePathname();
  const path = pathForScreen("email_design", { designId: card.emailDesign.designId });
  const allowed = decideScreen("email_design").status === "allowed";
  return (
    <section className="rounded-lg border border-border bg-card p-3.5 shadow-sm" aria-label={t("title")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[--radius] border border-border bg-muted">
            <EnvelopeSimple className="h-5 w-5 text-primary-ink" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-snug text-foreground">{card.emailDesign.name}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t("detail")}</p>
          </div>
        </div>
        {!allowed || !path ? (
          <span className="text-xs font-medium text-muted-foreground">{t("noAccess")}</span>
        ) : here === path ? (
          <button type="button" disabled className={ACTION}>
            {t("opened")}
          </button>
        ) : (
          <Link href={path} onClick={openDock} className={ACTION}>
            {t("open")}
          </Link>
        )}
      </div>
    </section>
  );
}
