"use client";

import { useTranslations } from "next-intl";

import { Meter } from "@/components/charts/vozko";
import { ChatsCircle, ClockCounterClockwise, DeviceMobile, Pulse, User, UsersFour, UsersThree, Warning } from "@/components/icons";
import { GLYPH_PLATE } from "@/components/icons/glyph-plates";
import { KpiBand, type KpiCell } from "@/components/unofficial-whatsapp-groups/kit/kpi-band";
import { groupsRoutes } from "@/components/unofficial-whatsapp-groups/kit/routes";
import { useGroupsFormat } from "@/components/unofficial-whatsapp-groups/kit/use-groups-format";
import type { GroupsDashboard } from "@/lib/unofficial-whatsapp-groups/types";

export const INSIGHTS_ANCHOR = "insights";

export function OverviewKpis({ dashboard }: { dashboard: GroupsDashboard | null }) {
  const t = useTranslations("unofficialGroups.dashboard.band");
  const tk = useTranslations("unofficialGroups.dashboard.kpi");
  const fmt = useGroupsFormat(dashboard?.timezone || undefined);

  if (!dashboard) return <KpiBand label={t("label")} cells={[]} columns={8} loading />;

  const { connections, groups, people, analyses, runs, crossGroupTotal } = dashboard;
  const cells: KpiCell[] = [
    {
      key: "numbers",
      icon: DeviceMobile,
      plate: GLYPH_PLATE.ChatsCircle,
      label: tk("numbers"),
      value: fmt.num(connections.connected),
      total: tk("ofTotal", { total: fmt.num(connections.total) }),
      sub: t("numbersSub"),
      mark: connections.total > 0 && connections.connected < connections.total ? "warning" : undefined,
      visual:
        connections.total > 0 ? (
          <Meter value={(connections.connected / connections.total) * 100} size="sm" className="w-10" label={tk("numbers")} />
        ) : undefined,
      href: groupsRoutes.numbers,
    },
    {
      key: "followed",
      icon: UsersThree,
      plate: GLYPH_PLATE.UsersThree,
      label: tk("followed"),
      value: fmt.num(groups.followed),
      total: tk("ofTotal", { total: fmt.num(groups.groups) }),
      sub: tk("openClosed", { open: fmt.num(groups.open), closed: fmt.num(groups.closed) }),
      href: groupsRoutes.all({ followed: true }),
    },
    {
      key: "people",
      icon: User,
      plate: "tile-4",
      label: tk("people"),
      value: fmt.num(people.unique),
      sub: tk("memberships", { count: people.memberships, value: fmt.num(people.memberships) }),
      href: groupsRoutes.people(),
    },
    {
      key: "crossGroup",
      icon: UsersFour,
      plate: "tile-5",
      label: t("crossGroup"),
      value: fmt.num(crossGroupTotal),
      sub: people.unique > 0 ? t("crossGroupSub", { share: fmt.share(crossGroupTotal, people.unique) }) : undefined,
      href: groupsRoutes.people({ minGroups: 2 }),
    },
    {
      key: "analyzed",
      icon: ChatsCircle,
      plate: GLYPH_PLATE.ChatsCircle,
      label: t("analyzed"),
      value: fmt.compact(runs.messages),
      sub: t("sinceStart"),
      title: fmt.num(runs.messages),
    },
    {
      key: "analyses",
      icon: Pulse,
      plate: GLYPH_PLATE.Pulse,
      label: tk("analyses"),
      value: fmt.num(analyses.active),
      total: tk("ofTotal", { total: fmt.num(analyses.total) }),
      sub: t("analysesSub"),
      href: groupsRoutes.analyses({ status: "active" }),
    },
    {
      key: "cycles",
      icon: ClockCounterClockwise,
      plate: GLYPH_PLATE.ClockCounterClockwise,
      label: t("cycles"),
      value: fmt.num(runs.runs),
      sub: t("sinceStart"),
      href: groupsRoutes.analyses(),
    },
    {
      key: "highAlerts",
      icon: Warning,
      plate: runs.highAlerts > 0 ? "tile-fault" : GLYPH_PLATE.Warning,
      label: tk("highAlerts"),
      value: fmt.num(runs.highAlerts),
      sub: runs.runs > 0 ? t("highAlertsSub", { share: fmt.share(runs.highAlerts, runs.runs) }) : t("sinceStart"),
      mark: runs.highAlerts > 0 ? "fault" : undefined,
      href: `${groupsRoutes.root}#${INSIGHTS_ANCHOR}`,
    },
  ];

  return <KpiBand label={t("label")} cells={cells} columns={8} />;
}
