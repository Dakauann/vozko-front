"use client";

import { useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";

import { CheckCircle, CircleNotch, Crown, Wallet } from "@/components/icons";
import {
  InstagramLogoColor,
  TelegramLogoColor,
  WhatsAppLogoColor,
  WhatsAppUnofficialLogo,
} from "@/components/icons/channel-logos";
import { useWorkspace } from "@/contexts/workspace-context";
import { useInstagramConnect } from "@/hooks/use-instagram-connect";
import { useWhatsAppCapacity } from "@/hooks/use-whatsapp-capacity";
import { useWhatsAppEmbeddedSignup } from "@/hooks/use-whatsapp-embedded-signup";
import { Link } from "@/i18n/routing";
import { cardState, type CardView } from "@/lib/aichat/action-card";
import type { ActionCard, ActionKind } from "@/lib/aichat/types";
import { cn } from "@/lib/utils";
import type { ResourceType } from "@/lib/workspace/types";

interface KindConfig {
  logo: ReactNode;
  resource?: ResourceType;
  href?: string;
  moreHref?: string;
}

const KINDS: Record<ActionKind, KindConfig> = {
  connect_whatsapp_business: {
    logo: <WhatsAppLogoColor className="h-6 w-6" />,
    resource: "business_phones",
    href: "/dashboard/whatsapp-business-phones/connect",
    moreHref: "/dashboard/addons",
  },
  connect_unofficial_whatsapp: {
    logo: <WhatsAppUnofficialLogo className="h-6 w-6" />,
    resource: "unofficial_whatsapp_instances",
    href: "/dashboard/unofficial-whatsapp/connect",
    moreHref: "/dashboard/addons",
  },
  connect_instagram: {
    logo: <InstagramLogoColor className="h-6 w-6" />,
    resource: "instagram_accounts",
    href: "/dashboard/instagram-accounts/connect",
  },
  connect_telegram: {
    logo: <TelegramLogoColor className="h-6 w-6" />,
    resource: "telegram_accounts",
    href: "/dashboard/telegram-accounts/connect",
  },
  top_up_balance: {
    logo: <Wallet weight="duotone" className="h-6 w-6 text-primary-ink" />,
    href: "/dashboard/balance",
  },
  manage_subscription: {
    logo: <Crown weight="duotone" className="h-6 w-6 text-primary-ink" />,
    href: "/dashboard/plans",
  },
};

const PRIMARY =
  "inline-flex items-center gap-1.5 rounded-[--radius] bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors duration-DEFAULT hover:bg-primary-hover active:bg-primary-active disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const SECONDARY =
  "inline-flex items-center gap-1.5 rounded-[--radius] border border-control-edge bg-card px-3.5 py-2 text-sm font-medium text-foreground transition-colors duration-DEFAULT hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ActionCardView({ card }: { card: ActionCard }) {
  switch (card.kind) {
    case "connect_whatsapp_business":
      return <OfficialWhatsAppCard card={card} />;
    case "connect_instagram":
      return <InstagramCard card={card} />;
    default:
      return <LinkCard card={card} />;
  }
}

function usePermitted(card: ActionCard): boolean {
  const { can } = useWorkspace();
  const resource = KINDS[card.kind].resource;
  return resource ? can(resource, "create") : true;
}

function OfficialWhatsAppCard({ card }: { card: ActionCard }) {
  const permitted = usePermitted(card);
  const capacity = useWhatsAppCapacity();
  const [connected, setConnected] = useState(false);
  const signup = useWhatsAppEmbeddedSignup((outcome) => setConnected(outcome === "success"));
  const view = cardState(card, {
    permitted,
    live: capacity.ready ? { used: capacity.used, total: capacity.total, canAdd: capacity.canAdd } : undefined,
  });
  return (
    <CardShell card={card} view={view} connected={connected}>
      <button type="button" onClick={signup.start} disabled={signup.connecting} className={PRIMARY}>
        {signup.connecting ? <CircleNotch weight="bold" className="h-3.5 w-3.5 animate-spin" /> : null}
        <CardCta kind={card.kind} />
      </button>
    </CardShell>
  );
}

function InstagramCard({ card }: { card: ActionCard }) {
  const permitted = usePermitted(card);
  const [connected, setConnected] = useState(false);
  const instagram = useInstagramConnect((result) =>
    setConnected(result.status === "connected" || result.status === "reconnected"),
  );
  return (
    <CardShell card={card} view={cardState(card, { permitted })} connected={connected}>
      <button type="button" onClick={() => instagram.connect()} disabled={instagram.isConnecting} className={PRIMARY}>
        {instagram.isConnecting ? <CircleNotch weight="bold" className="h-3.5 w-3.5 animate-spin" /> : null}
        <CardCta kind={card.kind} />
      </button>
    </CardShell>
  );
}

function LinkCard({ card }: { card: ActionCard }) {
  const permitted = usePermitted(card);
  const href = KINDS[card.kind].href ?? "/dashboard";
  return (
    <CardShell card={card} view={cardState(card, { permitted })} connected={false}>
      <Link href={href} className={PRIMARY}>
        <CardCta kind={card.kind} />
      </Link>
    </CardShell>
  );
}

function CardCta({ kind }: { kind: ActionKind }) {
  const t = useTranslations("aiChatPage.actions");
  return <>{t(`kinds.${kind}.cta`)}</>;
}

function CardShell({
  card,
  view,
  connected,
  children,
}: {
  card: ActionCard;
  view: CardView;
  connected: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("aiChatPage.actions");
  const locale = useLocale();
  const config = KINDS[card.kind];
  const balance = new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(card.balanceMicros / 1_000_000);
  return (
    <section className="rounded-lg border border-border bg-card p-3.5 shadow-sm" aria-label={t(`kinds.${card.kind}.title`)}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[--radius] border border-border bg-muted">
          {config.logo}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-foreground">{t(`kinds.${card.kind}.title`)}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t(`kinds.${card.kind}.description`)}</p>
          {card.kind === "top_up_balance" ? (
            <p className="mt-2 text-xs font-medium text-foreground">{t("balance", { amount: balance })}</p>
          ) : null}
          {view.usage && view.usage.total > 0 ? <UsageMeter used={view.usage.used} total={view.usage.total} /> : null}
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2.5 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
        {connected ? (
          <p className="flex items-center gap-1.5 text-xs font-medium text-success-ink">
            <CheckCircle weight="fill" className="h-4 w-4" />
            {t("connected")}
          </p>
        ) : view.state === "ready" ? (
          <>
            <span className="text-xs text-muted-foreground">{t("ready")}</span>
            <div className="flex gap-2">{children}</div>
          </>
        ) : (
          <>
            <span className="text-xs font-medium text-foreground">{t(`blocker.${view.state}`)}</span>
            {view.state === "at_limit" && config.moreHref ? (
              <Link href={config.moreHref} className={SECONDARY}>
                {t("addMore")}
              </Link>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function UsageMeter({ used, total }: { used: number; total: number }) {
  const t = useTranslations("aiChatPage.actions");
  const filled = Math.min(used, total);
  return (
    <div className="mt-2.5">
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: Math.min(total, 10) }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              i < Math.round((filled / total) * Math.min(total, 10)) ? "bg-primary" : "bg-muted-foreground/20",
            )}
          />
        ))}
      </div>
      <p className="mt-1 text-2xs text-muted-foreground">{t("usage", { used, total })}</p>
    </div>
  );
}
