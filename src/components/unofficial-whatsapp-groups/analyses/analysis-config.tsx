"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Chip } from "@/components/audience/shared";
import { ReadoutBar } from "@/components/console/page-shapes";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { Gear } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import type { GroupAnalysis } from "@/lib/unofficial-whatsapp-groups/types";
import { cn } from "@/lib/utils";

import { MarkDot } from "../kit/kpi-band";
import { GroupsChapter } from "../kit/panel";
import { RelativeTime } from "../kit/relative-time";
import { useGroupsFormat } from "../kit/use-groups-format";
import { scheduleTimeOf } from "./analysis-form";
import { Fact, NextCycle } from "./analysis-parts";

export function AnalysisContextStrip({ analysis, timezone }: { analysis: GroupAnalysis; timezone: string }) {
  const t = useTranslations("unofficialGroups.analyses.context");
  const fmt = useGroupsFormat(timezone);
  return (
    <ReadoutBar
      className="rounded-[--radius]"
      readouts={[
        { label: t("nextCycle"), value: <NextCycle analysis={analysis} timeZone={timezone} /> },
        { label: t("pending"), value: fmt.num(analysis.pendingMessages) },
        { label: t("readUntil"), value: analysis.analyzedUntil ? fmt.dateTime(analysis.analyzedUntil) : <EmptyValue /> },
        { label: t("lastCycle"), value: <RelativeTime at={analysis.lastRunAt} timeZone={timezone} /> },
        {
          label: t("failures"),
          value: (
            <span className="inline-flex items-center gap-1.5">
              {analysis.failures > 0 ? <MarkDot mark="fault" /> : null}
              {fmt.num(analysis.failures)}
            </span>
          ),
        },
      ]}
    />
  );
}

export function AnalysisConfigChapter({ analysis, timezone }: { analysis: GroupAnalysis; timezone: string }) {
  const t = useTranslations("unofficialGroups.analyses.config");
  const tf = useTranslations("unofficialGroups.analyses.form");
  const fmt = useGroupsFormat(timezone);
  const [promptOpen, setPromptOpen] = useState(false);
  const time = scheduleTimeOf(analysis.scheduleHour, analysis.scheduleMinute);
  const at = (value?: string) => (value ? <span className="readout tabular-nums">{fmt.dateTime(value)}</span> : <EmptyValue />);

  return (
    <GroupsChapter id="analysis-config" icon={<Gear />} title={t("title")}>
      <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-[--radius] border border-border bg-border sm:grid-cols-2 md:grid-cols-4">
        <Fact label={t("trigger")}>{analysis.trigger === "scheduled" ? t("triggerScheduled", { time, timezone }) : t("triggerCount")}</Fact>
        <Fact label={t("perCycle")} sub={analysis.trigger === "scheduled" ? t("perCycleBatch") : undefined}>
          <span className="readout tabular-nums">{fmt.num(analysis.messagesPerCycle)}</span>
        </Fact>
        <Fact label={t("pending")}>
          <span className="readout tabular-nums">{fmt.num(analysis.pendingMessages)}</span>
        </Fact>
        <Fact label={t("readUntil")}>{at(analysis.analyzedUntil)}</Fact>
        <Fact label={t("nextCycle")}>{analysis.status === "active" ? at(analysis.nextRunAt) : <span className="text-muted-foreground">{t("stopped")}</span>}</Fact>
        <Fact label={t("lastCycle")}>{at(analysis.lastRunAt)}</Fact>
        <Fact label={t("createdAt")}>{at(analysis.createdAt)}</Fact>
        <Fact label={t("updatedAt")}>{at(analysis.updatedAt)}</Fact>
      </dl>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="space-y-2">
          <p className="text-2xs font-semibold text-muted-foreground">{t("fields", { count: analysis.trackedFields.length })}</p>
          {analysis.trackedFields.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {analysis.trackedFields.map((field) => (
                <Chip key={field.key}>
                  <span className="font-mono">{field.key}</span>
                  <span className="text-muted-foreground">{tf(`fieldTypes.${field.type}`)}</span>
                </Chip>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t("noFields")}</p>
          )}
          <Notice tone="info">
            <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
              <li>{tf("noticeOnlyNew")}</li>
              <li>{tf("noticeBalance")}</li>
            </ul>
          </Notice>
        </div>
        <div className="min-w-0 space-y-2">
          <p className="text-2xs font-semibold text-muted-foreground">{t("prompt")}</p>
          <p className={cn("whitespace-pre-wrap rounded-[--radius] border border-border bg-card px-3 py-2.5 text-xs leading-relaxed text-foreground", !promptOpen && "line-clamp-6")}>
            {analysis.prompt}
          </p>
          <button
            type="button"
            aria-expanded={promptOpen}
            onClick={() => setPromptOpen((value) => !value)}
            className="rounded-sm text-xs font-semibold text-foreground underline underline-offset-2 hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {promptOpen ? t("hidePrompt") : t("showPrompt")}
          </button>
        </div>
      </div>
    </GroupsChapter>
  );
}
