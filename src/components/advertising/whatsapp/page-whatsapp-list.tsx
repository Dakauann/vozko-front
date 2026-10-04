"use client";

import { useTranslations } from "next-intl";

import { CheckCircle, WhatsappLogo } from "@/components/icons";
import type { AdPage } from "@/lib/advertising/types";

import { AdImage } from "../ad-image";
import { LinkWhatsAppNumber } from "../link-whatsapp-number";

export function PageWhatsAppList({
  accountId,
  pages,
  canLink,
  onChanged,
}: {
  accountId: string;
  pages: AdPage[];
  canLink: boolean;
  onChanged: () => void;
}) {
  const t = useTranslations("adsWhatsApp");
  if (pages.length === 0) {
    return <p className="rounded-[--radius] border border-border bg-card px-5 py-4 text-sm text-muted-foreground">{t("noPages")}</p>;
  }
  return (
    <ul className="space-y-3">
      {pages.map((page) => (
        <li key={page.pageId} className="space-y-3 rounded-[--radius] border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            {page.pictureUrl ? (
              <span className="relative block h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted">
                <AdImage src={page.pictureUrl} />
              </span>
            ) : null}
            <p className="min-w-0 flex-1 truncate font-semibold text-foreground">{page.name}</p>
          </div>
          <PageNumber accountId={accountId} page={page} canLink={canLink} onChanged={onChanged} />
        </li>
      ))}
    </ul>
  );
}

function PageNumber({ accountId, page, canLink, onChanged }: { accountId: string; page: AdPage; canLink: boolean; onChanged: () => void }) {
  const t = useTranslations("adsWhatsApp");
  const linked = page.numbers ?? [];
  if (linked.length > 0) {
    return (
      <div className="space-y-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-healthy-ink">
          <CheckCircle className="h-4 w-4" weight="fill" aria-hidden />
          {t("linked")}
        </p>
        {linked.map((number) => (
          <p key={number.number} className="flex items-center gap-1.5 text-sm text-foreground">
            <WhatsappLogo className="h-4 w-4 text-muted-foreground" aria-hidden />
            {`${number.label} · ${number.number}`}
          </p>
        ))}
      </div>
    );
  }
  if (page.whatsAppNumber) {
    return <p className="text-sm text-muted-foreground">{t("metaOnly", { number: page.whatsAppNumber })}</p>;
  }
  if (!canLink) {
    return <p className="text-sm text-muted-foreground">{t("cannotLink")}</p>;
  }
  return <LinkWhatsAppNumber accountId={accountId} page={page} onLinked={onChanged} />;
}
