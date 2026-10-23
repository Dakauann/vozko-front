"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { ElevatedSegmentedControl } from "@/components/elevated-design/elevated-segmented-control";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { ChatCircle, ChatText, CircleNotch, Hash } from "@/components/icons";
import { RcsTextField } from "@/components/rcs/composer/RcsTextField";
import { accentStyle } from "@/components/rcs/preview/palette";
import { AgentAvatar } from "@/components/rcs/preview/AgentAvatar";
import { SenderStatusChip } from "@/components/rcs/senders/SenderStatusTrack";
import { Notice } from "@/components/ui/notice";
import { ComingSoonChip, ComingSoonPanel } from "../../shared/ComingSoon";
import { CAMPAIGN_CHANNELS, CAMPAIGN_KINDS, CAMPAIGN_LIMITS, type CampaignChannel, type CampaignDraft, type CampaignKind } from "@/lib/carrier-messaging/campaigns";
import { useCarrierRefusalText } from "@/components/carrier-messaging/shared/use-carrier-error-text";
import type { RcsSender } from "@/lib/rcs/types";
import type { SmsRoute } from "@/lib/sms/types";
import { cn } from "@/lib/utils";

import type { Loaded } from "@/lib/carrier-messaging/use-loaded";

function Option({ selected, disabled, onSelect, leading, title, subtitle, trailing }: { selected: boolean; disabled: boolean; onSelect: () => void; leading: ReactNode; title: string; subtitle: ReactNode; trailing: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-[--radius] border bg-card px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "border-primary-edge ring-2 ring-primary/15" : "border-border hover:border-border-strong",
        disabled && "cursor-not-allowed opacity-60 hover:border-border",
      )}
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
      {trailing}
    </button>
  );
}

function PickerState<T>({ loaded, empty, children }: { loaded: Loaded<T[]> & { reload: () => void }; empty: ReactNode; children: (items: T[]) => ReactNode }) {
  const t = useTranslations("carrierMessaging.pages.campaignEditor.sender");
  const refusalText = useCarrierRefusalText();
  if (loaded.status === "loading") {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <CircleNotch aria-hidden className="h-4 w-4 animate-spin" />
        {t("loading")}
      </p>
    );
  }
  if (loaded.status === "failed") {
    return (
      <Notice tone="fault" title={t("failed")}>
        <p>{refusalText(loaded.error)}</p>
        <Button variant="secondary" size="sm" title={t("retry")} onClick={loaded.reload} />
      </Notice>
    );
  }
  return loaded.data.length === 0 ? <>{empty}</> : <>{children(loaded.data)}</>;
}

function RcsSenderOptions({ senders, value, onChange }: { senders: Loaded<RcsSender[]> & { reload: () => void }; value: string; onChange: (id: string) => void }) {
  const t = useTranslations("carrierMessaging.pages.campaignEditor.sender");
  return (
    <PickerState loaded={senders} empty={<Notice tone="info" title={t("noRcsSenders")}><p>{t("noRcsSendersHint")}</p></Notice>}>
      {(items) => (
        <div role="radiogroup" aria-label={t("rcsLabel")} className="grid gap-2 sm:grid-cols-2">
          {items.map((sender) => (
            <Option
              key={sender.id}
              selected={value === sender.id}
              disabled={!sender.can_send}
              onSelect={() => onChange(sender.id)}
              leading={
                <span style={accentStyle(sender.color)}>
                  <AgentAvatar name={sender.brand_name} logoUrl={sender.logo_url || undefined} alt="" className="h-9 w-9 text-sm" />
                </span>
              }
              title={sender.brand_name}
              subtitle={sender.can_send ? t("readyToSend") : t("notLaunched")}
              trailing={<SenderStatusChip status={sender.status} />}
            />
          ))}
        </div>
      )}
    </PickerState>
  );
}

export function routeSubtitle(route: SmsRoute, t: (key: string, values?: Record<string, string>) => string): string {
  return route.kind === "dedicated" ? t("dedicated", { number: route.number }) : t("shared");
}

function SmsRouteOptions({ routes, value, onChange }: { routes: Loaded<SmsRoute[]> & { reload: () => void }; value: string; onChange: (id: string) => void }) {
  const t = useTranslations("carrierMessaging.pages.campaignEditor.sender");
  return (
    <PickerState loaded={routes} empty={<Notice tone="info" title={t("noRoutes")}><p>{t("noRoutesHint")}</p></Notice>}>
      {(items) => (
        <div role="radiogroup" aria-label={t("smsLabel")} className="grid gap-2 sm:grid-cols-2">
          {items.map((route) => (
            <Option
              key={route.id}
              selected={value === route.id}
              disabled={!route.can_send}
              onSelect={() => onChange(route.id)}
              leading={
                <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Hash className="h-4 w-4" />
                </span>
              }
              title={t("prefix", { prefix: route.brand_prefix })}
              subtitle={routeSubtitle(route, t)}
              trailing={<StatusChip tone={route.status === "active" ? "healthy" : "warning"} label={t(`routeStatus.${route.status}`)} />}
            />
          ))}
        </div>
      )}
    </PickerState>
  );
}

export function ChannelStep({
  draft,
  onChannel,
  onChange,
  senders,
  routes,
  launched,
}: {
  draft: CampaignDraft;
  onChannel: (channel: CampaignChannel) => void;
  onChange: (draft: CampaignDraft) => void;
  senders: Loaded<RcsSender[]> & { reload: () => void };
  routes: Loaded<SmsRoute[]> & { reload: () => void };
  launched: (channel: CampaignChannel) => boolean;
}) {
  const t = useTranslations("carrierMessaging.pages.campaignEditor.channel");
  const tShared = useTranslations("carrierMessaging");
  return (
    <div className="space-y-6">
      <RcsTextField label={t("name")} value={draft.name} onChange={(name) => onChange({ ...draft, name })} max={CAMPAIGN_LIMITS.maxNameRunes} placeholder={t("namePlaceholder")} />
      <div className="space-y-2">
        <p className="legend">{t("channel")}</p>
        <ElevatedSegmentedControl
          value={draft.channel}
          onChange={(next) => onChannel(next as CampaignChannel)}
          className="max-sm:!grid-cols-1"
          options={CAMPAIGN_CHANNELS.map((channel) => ({
            value: channel,
            label: tShared(`channels.${channel}`),
            description: t(`channelHints.${channel}`),
            icon: channel === "rcs" ? <ChatText className="h-4 w-4" /> : <ChatCircle className="h-4 w-4" />,
            disabled: !launched(channel),
            badge: launched(channel) ? undefined : <ComingSoonChip />,
          }))}
        />
      </div>
      <div className="space-y-2">
        <p className="legend">{t("kind")}</p>
        <ElevatedSegmentedControl
          value={draft.kind}
          size="sm"
          onChange={(next) => onChange({ ...draft, kind: next as CampaignKind })}
          className="max-sm:!grid-cols-1"
          options={CAMPAIGN_KINDS.map((kind) => ({ value: kind, label: tShared(`campaignKinds.${kind}`), description: t(`kindHints.${kind}`) }))}
        />
      </div>
      <div className="space-y-2">
        <p className="legend">{draft.channel === "rcs" ? t("rcsSender") : t("smsSender")}</p>
        {!launched(draft.channel) ? (
          <ComingSoonPanel variant={draft.channel} compact />
        ) : draft.channel === "rcs" ? (
          <RcsSenderOptions senders={senders} value={draft.sender_id} onChange={(sender_id) => onChange({ ...draft, sender_id })} />
        ) : (
          <SmsRouteOptions routes={routes} value={draft.sender_id} onChange={(sender_id) => onChange({ ...draft, sender_id })} />
        )}
      </div>
    </div>
  );
}
