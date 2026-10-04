"use client";

import { useTranslations } from "next-intl";

import { usePortalPopup } from "@/hooks/use-portal-popup";
import { Link } from "@/i18n/routing";
import type { AdPage, AdPageCapability } from "@/lib/advertising/types";
import { screenPaths } from "@/lib/navigation/routes";

import { AdImage } from "../ad-image";
import { LinkWhatsAppNumber } from "../link-whatsapp-number";
import { ReadinessStateIcon } from "../readiness";
import { RecheckButton } from "../requirement-steps";
import { ExternalLink } from "../wizard/choice-row";

interface PageActions {
  accountId: string;
  canLink: boolean;
  checking: boolean;
  onChanged: () => void;
}

export function PageAssetsList({ pages, ...actions }: PageActions & { pages: AdPage[] }) {
  const t = useTranslations("adsPages");
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
          <ul className="divide-y divide-border">
            {(page.capabilities ?? []).map((capability) => (
              <CapabilityRow key={capability.channel} capability={capability} page={page} {...actions} />
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function CapabilityRow({ capability, page, ...actions }: PageActions & { capability: AdPageCapability; page: AdPage }) {
  const t = useTranslations("adsPages.channels");
  if (!t.has(`${capability.channel}.title`)) return null;
  const ready = capability.state === "ready";
  return (
    <li className="flex items-start gap-3 py-3">
      <span className="mt-0.5 shrink-0">
        <ReadinessStateIcon state={capability.state} />
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-sm font-medium text-foreground">{t(`${capability.channel}.title`)}</p>
        {ready ? (
          <CapabilityDetail channel={capability.channel} page={page} />
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{t(`${capability.channel}.missing`)}</p>
            <CapabilityAction capability={capability} page={page} {...actions} />
          </>
        )}
      </div>
    </li>
  );
}

function CapabilityDetail({ channel, page }: { channel: AdPageCapability["channel"]; page: AdPage }) {
  if (channel === "whatsapp") {
    return (
      <>
        {(page.numbers ?? []).map((number) => (
          <p key={number.number} className="text-xs text-muted-foreground">
            {`${number.label} · ${number.number}`}
          </p>
        ))}
      </>
    );
  }
  if (channel === "instagram" && page.instagramUsername) {
    return <p className="text-xs text-muted-foreground">{`@${page.instagramUsername}`}</p>;
  }
  return null;
}

function CapabilityAction({ capability, page, accountId, canLink, checking, onChanged }: PageActions & { capability: AdPageCapability; page: AdPage }) {
  const t = useTranslations("adsPages");
  const action = capability.action;
  if (!action) return null;
  if (action.kind === "portal" && action.url) {
    return <PortalAction href={action.url} checking={checking} onRecheck={onChanged} />;
  }
  if (action.key === "connect_whatsapp") {
    return (
      <Link href={screenPaths.business_phone_connect} className="text-xs font-semibold text-primary-ink hover:underline">
        {t("connectWhatsApp")}
      </Link>
    );
  }
  if (action.key === "link_whatsapp") {
    if (!canLink) return <p className="text-xs text-muted-foreground">{t("cannotLink")}</p>;
    return <LinkWhatsAppNumber accountId={accountId} page={page} onLinked={onChanged} />;
  }
  return null;
}

function PortalAction({ href, checking, onRecheck }: { href: string; checking: boolean; onRecheck: () => void }) {
  const t = useTranslations("adsPages");
  const { openPortal } = usePortalPopup(onRecheck);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <ExternalLink href={href} onOpen={openPortal}>
        {t("openAtMeta")}
      </ExternalLink>
      <RecheckButton checking={checking} onRecheck={onRecheck} />
    </div>
  );
}
