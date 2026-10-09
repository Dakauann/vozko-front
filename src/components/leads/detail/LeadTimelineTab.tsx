"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";

import {
  ArrowCounterClockwise,
  Brain,
  ChatText,
  CheckCircle,
  ClockCounterClockwise,
  Handshake,
  MapPin,
  Megaphone,
  PencilSimple,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Plus,
  WarningCircle,
  WhatsappLogo,
  XCircle,
} from "@/components/icons";
import { ScreenLoader } from "@/components/brand/screen-loader";
import { PanelSection } from "@/components/dashboard/PanelSection";
import { SectionState } from "@/components/dashboard/attendance/section-state";
import Button from "@/components/elevated-design/button";
import { formatCallDuration } from "@/hooks/use-call-clock";
import { useCallOutcomeLabel } from "@/hooks/use-call-outcome-label";
import { NO_DEAL_MEMBERS, useDealActorLabels } from "@/hooks/use-deal-actor-labels";
import { useLeadFieldDefinitions } from "@/hooks/use-lead-field-definitions";
import { useLeadTimeline } from "@/hooks/use-lead-records";
import { conversationHref } from "@/lib/conversations/deep-link";
import { dealActorName } from "@/lib/crm/opportunities";
import { leadFieldLabel } from "@/lib/leads/field-label";
import { CALLBACK_DISPOSITION } from "@/lib/call-lists/types";
import { isLocationEvent, timelineEntryLink, timelineItemsOf, type LeadTimelineItem, type LeadTimelineSummary } from "@/lib/leads/timeline";

import { PagedListFooter, pagedSectionState } from "./PagedListFooter";
import { useInstantText, useRelativeInstantText } from "./use-instant-text";

const CAMPAIGN_MILESTONES = {
  campaign_sent: "sent",
  campaign_delivered: "delivered",
  campaign_read: "read",
  campaign_failed: "failed",
} as const;

const DEAL_EVENTS: ReadonlySet<string> = new Set(["stage_moved", "won", "lost", "reopened"]);

const DEAL_EVENT_ICONS: Record<string, ReactNode> = {
  won: <CheckCircle />,
  lost: <XCircle />,
  reopened: <ArrowCounterClockwise />,
};

const WHATSAPP_CHANNELS: ReadonlySet<string> = new Set(["whatsapp", "unofficial_whatsapp"]);

interface TimelineView {
  icon: ReactNode;
  title: string;
  detail?: string;
}

function useTimelineView() {
  const t = useTranslations("leadDetail.timeline");
  const tChannel = useTranslations("leadsPage.filters.options.channel");
  const tMemory = useTranslations("leadMemories.categories");
  const tSheet = useTranslations("leadSheet");
  const tHistory = useTranslations("opportunityHistory");
  const format = useFormatter();
  const outcomeLabel = useCallOutcomeLabel();
  const { definitions } = useLeadFieldDefinitions();

  const actors = useDealActorLabels();
  const actorOf = (item: LeadTimelineItem) => dealActorName(item.actor, NO_DEAL_MEMBERS, actors, item.actorName) ?? actors.system;
  const byActor = (item: LeadTimelineItem) => (item.actor ? t("by", { actor: actorOf(item) }) : undefined);
  const channelOf = (channel: string) => (channel && tChannel.has(channel) ? tChannel(channel) : t("otherChannel"));
  const callOutcomeOf = (summary: LeadTimelineSummary) => {
    const disposition = summary.disposition ?? "";
    if (!disposition) return undefined;
    const callbackAt = disposition === CALLBACK_DISPOSITION && summary.callbackAt ? new Date(summary.callbackAt) : null;
    if (callbackAt && !Number.isNaN(callbackAt.getTime())) {
      return t("call.callbackAt", { when: format.dateTime(callbackAt, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) });
    }
    return outcomeLabel(disposition) ?? undefined;
  };
  const dealValueOf = (summary: LeadTimelineSummary) =>
    summary.valueCents && summary.valueCents > 0 ? format.number(summary.valueCents / 100, { style: "currency", currency: summary.currency || "BRL" }) : undefined;

  return (item: LeadTimelineItem): TimelineView => {
    const { summary } = item;
    switch (item.kind) {
      case "conversation": {
        const channel = summary.channel || item.ref.entryType || "";
        const icon = WHATSAPP_CHANNELS.has(channel) ? <WhatsappLogo weight="fill" /> : <ChatText />;
        return { icon, title: t("conversation", { channel: channelOf(channel) }) };
      }
      case "campaign_sent":
      case "campaign_delivered":
      case "campaign_read":
      case "campaign_failed":
        return {
          icon: item.kind === "campaign_failed" ? <WarningCircle /> : <Megaphone />,
          title: t(`campaign.${CAMPAIGN_MILESTONES[item.kind]}`, { title: summary.title || t("untitledCampaign") }),
        };
      case "call": {
        const outcome = summary.answeredAt ? t("call.answered", { duration: formatCallDuration(summary.durationSec ?? 0) }) : t("call.missed");
        const direction = summary.direction === "outbound" || summary.direction === "inbound" ? summary.direction : "other";
        const icon = direction === "outbound" ? <PhoneOutgoing /> : direction === "inbound" ? <PhoneIncoming /> : <PhoneCall />;
        return { icon, title: t(`call.${direction}`), detail: [outcome, callOutcomeOf(summary), byActor(item)].filter(Boolean).join(" · ") };
      }
      case "deal":
        return {
          icon: <Handshake />,
          title: summary.title ? t("deal", { title: summary.title }) : t("dealUntitled"),
          detail: byActor(item),
        };
      case "deal_event": {
        const event = summary.event && DEAL_EVENTS.has(summary.event) ? summary.event : "other";
        const title = t(`dealEvent.${event}`, { title: summary.title || t("untitledDeal"), to: summary.stageName || tHistory("removedStage") });
        const context = event === "stage_moved" && summary.fromStageName ? t("dealEvent.from", { from: summary.fromStageName }) : event === "won" ? dealValueOf(summary) : undefined;
        return {
          icon: DEAL_EVENT_ICONS[event] ?? <Handshake />,
          title,
          detail: [context, byActor(item)].filter(Boolean).join(" · ") || undefined,
        };
      }
      case "memory": {
        const text = summary.text ?? "";
        const category = summary.category ?? "";
        return {
          icon: <Brain />,
          title: category && tMemory.has(category) ? t("memory", { category: tMemory(category), text }) : t("memoryUncategorized", { text }),
          detail: byActor(item),
        };
      }
      case "record": {
        const event = summary.event && t.has(`record.${summary.event}`) ? summary.event : "other";
        const fields = (summary.fields ?? []).map((field) => leadFieldLabel(tSheet, field, definitions)).join(", ") || t("wholeRecord");
        return { icon: isLocationEvent(item) ? <MapPin /> : <PencilSimple />, title: t(`record.${event}`, { actor: actorOf(item), fields }) };
      }
    }
  };
}

function TimelineRow({ item, view }: { item: LeadTimelineItem; view: TimelineView }) {
  const t = useTranslations("leadDetail.timeline");
  const instantText = useRelativeInstantText();
  const fullInstantText = useInstantText();
  const link = timelineEntryLink(item);
  const titleClass = "line-clamp-2 text-sm text-foreground";
  return (
    <li className="flex items-start gap-3 border-b border-border py-2.5 last:border-0">
      <span aria-hidden className="mt-0.5 flex shrink-0 text-muted-foreground [&_svg]:h-4 [&_svg]:w-4">
        {view.icon}
      </span>
      <span className="min-w-0 flex-1">
        {link ? (
          <Link
            href={conversationHref(link.entryId, link.entryType)}
            title={t("openConversation")}
            className={`${titleClass} underline-offset-2 hover:underline focus-visible:rounded-[--radius] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
          >
            {view.title}
          </Link>
        ) : (
          <span className={titleClass}>{view.title}</span>
        )}
        {view.detail ? <span className="block text-xs text-muted-foreground">{view.detail}</span> : null}
      </span>
      <time dateTime={item.at} title={fullInstantText(item.at) ?? undefined} className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {instantText(item.at)}
      </time>
    </li>
  );
}

export function LeadTimelineTab({ leadId, leadName, onAddMemory }: { leadId: string; leadName: string; onAddMemory?: () => void }) {
  const t = useTranslations("leadDetail.timeline");
  const query = useLeadTimeline(leadId, true);
  const viewOf = useTimelineView();
  const pages = query.data?.pages;
  const items = timelineItemsOf(pages);
  const empty = query.isSuccess && items.length === 0 && !query.hasNextPage;

  const addMemory = onAddMemory ? (
    <Button variant="secondary" size="sm" icon={<Plus className="h-3.5 w-3.5" weight="bold" />} iconVisible iconSide="left" title={t("addMemory")} onClick={onAddMemory} />
  ) : null;

  return (
    <PanelSection title={t("title")} legend={leadName ? t("legend", { name: leadName }) : t("legendUnnamed")}>
      <SectionState query={pagedSectionState(query)}>
        {query.isPending ? (
          <ScreenLoader fit="inline" />
        ) : empty ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <ClockCounterClockwise className="h-4 w-4" aria-hidden />
              {t("empty")}
            </p>
            {addMemory}
          </div>
        ) : (
          <>
            {items.length > 0 ? (
              <ol aria-label={t("title")}>
                {items.map((item) => (
                  <TimelineRow key={item.id} item={item} view={viewOf(item)} />
                ))}
              </ol>
            ) : null}
            <PagedListFooter
              query={query}
              pageSizes={pages?.map((page) => page.items.length) ?? []}
              loadMore={t("loadMore")}
              loadingMore={t("loadingMore")}
            />
          </>
        )}
      </SectionState>
    </PanelSection>
  );
}
