"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/audience/shared";
import { SealCheck } from "@/components/icons";
import { PanelFault } from "@/components/unofficial-whatsapp-groups/kit/chart-panel";
import { QuietEmpty } from "@/components/unofficial-whatsapp-groups/kit/empty";
import { GroupLinks } from "@/components/unofficial-whatsapp-groups/kit/identity";
import { MarkDot } from "@/components/unofficial-whatsapp-groups/kit/kpi-band";
import { GroupsPanel } from "@/components/unofficial-whatsapp-groups/kit/panel";
import { groupsRoutes } from "@/components/unofficial-whatsapp-groups/kit/routes";
import { useGroupsFormat } from "@/components/unofficial-whatsapp-groups/kit/use-groups-format";
import { Link } from "@/i18n/routing";
import type { GroupRow, JoinTask, PageMeta } from "@/lib/unofficial-whatsapp-groups/types";

import { attentionLines, type AttentionKey, type AttentionLine } from "./dashboard-data";

const LINE_GROUPS = 3;

const LINE_LINK: Partial<Record<AttentionKey, string>> = {
  disconnected: groupsRoutes.numbers,
  failedJoins: groupsRoutes.all(),
};

function LineMark({ line }: { line: AttentionLine }) {
  if (line.mark === "muted") return <span aria-hidden className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/45" />;
  return <MarkDot mark={line.mark} />;
}

export function AttentionPanel({
  rows,
  meta,
  joins,
  connections,
  loading,
  error,
  onRetry,
  className,
}: {
  rows: GroupRow[];
  meta: PageMeta | null;
  joins: JoinTask[];
  connections: { connected: number; total: number } | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  className?: string;
}) {
  const t = useTranslations("unofficialGroups.dashboard.attention");
  const fmt = useGroupsFormat();
  const lines = useMemo(
    () => (connections ? attentionLines({ rows, connections, joins }) : []),
    [rows, connections, joins],
  );
  const total = meta?.totalItems ?? rows.length;
  const scope = loading || error ? null : total > rows.length ? t("scopeCapped", { shown: rows.length, total }) : t("scope", { count: rows.length });

  return (
    <GroupsPanel title={t("title")} subtitle={t("subtitle")} meta={scope} className={className}>
      {loading || !connections ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </div>
      ) : error ? (
        <PanelFault error={{ message: t("error"), onRetry }} />
      ) : lines.length === 0 ? (
        <QuietEmpty icon={<SealCheck />} message={t("empty")} />
      ) : (
        <ul className="divide-y divide-border/60">
          {lines.map((line) => {
            const label = t(`lines.${line.key}`);
            const href = LINE_LINK[line.key];
            return (
              <li key={line.key} className="py-2 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-foreground">
                    <LineMark line={line} />
                    {href ? (
                      <Link href={href} className="truncate rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        {label}
                      </Link>
                    ) : (
                      <span className="truncate">{label}</span>
                    )}
                  </span>
                  <span className="readout shrink-0 text-sm font-semibold tabular-nums text-foreground">{fmt.num(line.count)}</span>
                </div>
                {line.groups.length > 0 ? (
                  <div className="mt-1 pl-3.5">
                    <GroupLinks groups={line.groups} limit={LINE_GROUPS} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </GroupsPanel>
  );
}
