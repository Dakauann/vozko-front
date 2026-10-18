"use client";

import { useTranslations } from "next-intl";

import { Meter, SegmentBar } from "@/components/charts/vozko";
import { useEmptyValue } from "@/components/elevated-design/empty-value";
import type { GroupDetail } from "@/lib/unofficial-whatsapp-groups/types";

import { GROUPS_CHART_COLOR } from "../kit/charts";
import { shareOf } from "../kit/format";
import { KpiBand, type KpiCell } from "../kit/kpi-band";
import { RelativeTime } from "../kit/relative-time";
import { groupsRoutes } from "../kit/routes";
import { useGroupsFormat } from "../kit/use-groups-format";
import { campaignTotalLabel, knownCampaignTally, seatTally, seatsMark, seriesMemberTotal } from "./detail-model";
import type { GroupCampaignsState } from "./use-group-campaigns";

export function DetailKpiBand({ detail, campaigns }: { detail: GroupDetail; campaigns: GroupCampaignsState }) {
  const t = useTranslations("unofficialGroups.detail.kpi");
  const tCampaigns = useTranslations("unofficialGroups.detail.campaigns");
  const fmt = useGroupsFormat();
  const empty = useEmptyValue();
  const { group, members, activity, numbers, series, runningCampaigns } = detail;
  const net = activity.joins - activity.leaves;
  const seats = seatTally(numbers);
  const campaignTally = knownCampaignTally(campaigns);
  const campaignValue = campaigns.error ? empty : campaignTally ? campaignTotalLabel(campaignTally, fmt.num) : "…";
  const inSeries = series.length > 0;

  const cells: KpiCell[] = [
    {
      key: "active",
      label: t("active"),
      value: fmt.num(members.active),
      sub: t("activeSub", { hidden: members.hidden }),
      href: groupsRoutes.group(group.id, { tab: "members" }),
    },
    {
      key: "left",
      label: t("left"),
      value: fmt.num(members.left30d),
      sub: t("shareOfActive", { share: fmt.share(members.left30d, members.active) }),
      href: groupsRoutes.group(group.id, { members: { status: "left" } }),
    },
    {
      key: "net",
      label: t("net"),
      value: fmt.signed(net),
      sub: t("netSub", { joins: fmt.num(activity.joins), leaves: fmt.num(activity.leaves) }),
      visual:
        activity.joins + activity.leaves > 0 ? (
          <SegmentBar
            size="sm"
            legend={false}
            className="w-14"
            segments={[
              { key: "joins", label: t("joins"), value: activity.joins, color: GROUPS_CHART_COLOR.joins },
              { key: "leaves", label: t("leaves"), value: activity.leaves, color: GROUPS_CHART_COLOR.leaves },
            ]}
          />
        ) : undefined,
      href: groupsRoutes.group(group.id),
    },
    {
      key: "withLead",
      label: t("withLead"),
      value: fmt.num(members.withLead),
      sub: t("shareOfActive", { share: fmt.share(members.withLead, members.active) }),
      visual: <Meter value={shareOf(members.withLead, members.active) ?? 0} size="sm" className="w-12" label={t("withLead")} />,
      href: groupsRoutes.group(group.id, { members: { lead: true } }),
    },
    {
      key: "messages",
      label: t("messages"),
      value: fmt.num(activity.messages),
      sub: activity.lastActivity ? (
        <span className="inline-flex items-baseline gap-1">
          {t("lastMessageLabel")}
          <RelativeTime at={activity.lastActivity} className="readout tabular-nums" />
        </span>
      ) : (
        t("noMessages")
      ),
      href: groupsRoutes.group(group.id, { tab: "messages" }),
    },
    {
      key: "numbers",
      label: t("numbers"),
      value: fmt.num(numbers.length),
      sub: t("numbersSub", { connected: seats.connected, admin: seats.admin, posting: seats.posting }),
      mark: seatsMark(numbers),
      href: groupsRoutes.group(group.id, { tab: "settings" }),
    },
    {
      key: "campaigns",
      label: t("campaigns"),
      value: campaignValue,
      sub: t("campaignsSub", { count: runningCampaigns }),
      ...(campaigns.error ? { mark: "fault" as const, title: tCampaigns("error") } : {}),
      href: groupsRoutes.group(group.id, { tab: "campaigns" }),
    },
    {
      key: "series",
      label: t("series"),
      value: inSeries ? fmt.num(series.length) : empty,
      sub: inSeries ? t("seriesSub", { members: fmt.num(seriesMemberTotal(series)) }) : t("noSeries"),
    },
  ];

  return <KpiBand label={t("label")} cells={cells} columns={8} />;
}
