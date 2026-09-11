"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";

import { ProgressRing, VOZ_SERIES } from "@/components/charts/vozko";
import { BlockChart } from "@/components/charts/composition-charts";
import { ChartLegend, WaffleChart, type ChartDatum } from "@/components/charts/dense-charts";
import { InstrumentStrip, type Instrument } from "@/components/console/page-shapes";
import { EmptyState, Panel, Skeleton } from "@/components/audience/shared";
import { ChatsCircle } from "@/components/icons";
import type { CommentAnalysisStats } from "@/lib/comment-analysis/types";

/*
 * The conversation half of the audience view.
 *
 * A comment and a conversation are different subjects and deserve different
 * charts, which is why this is a sibling of the comment overview rather than
 * more series inside it. A comment has a stance and a severity; a conversation
 * has an objective it either advanced toward or did not, an agent whose conduct
 * is rated, and a length.
 *
 * Every chart primitive here is the one the comment overview already uses, so
 * the two halves of the page read as one instrument rather than two dashboards
 * that happen to share a route.
 */

/*
 * Disposition is ORDERED, not categorical: it runs from a closed objective to a
 * refusal, and the colours follow that order rather than being assigned per
 * label. A reader scanning the block sees the shape of the pipeline, not seven
 * unrelated hues.
 *
 * no_answer and voicemail sit apart in muted tones because they are not
 * outcomes of a conversation at all, they are the absence of one, and colouring
 * them like a refusal would overstate how often people say no.
 */
const DISPOSITION_KEYS = [
  "sale",
  "fillingInfo",
  "callback",
  "pending",
  "declined",
  "noAnswer",
  "voicemail",
] as const;

const DISPOSITION_COLOR: Record<(typeof DISPOSITION_KEYS)[number], string> = {
  sale: "hsl(var(--healthy))",
  fillingInfo: VOZ_SERIES[0],
  callback: VOZ_SERIES[3],
  pending: VOZ_SERIES[1],
  declined: "hsl(var(--destructive))",
  noAnswer: "hsl(var(--muted-foreground))",
  voicemail: "hsl(var(--muted-foreground))",
};

/** The enum value each counter key maps to, for the translation lookup. */
const DISPOSITION_ENUM: Record<(typeof DISPOSITION_KEYS)[number], string> = {
  sale: "sale",
  fillingInfo: "filling_info",
  callback: "callback",
  pending: "pending",
  declined: "declined",
  noAnswer: "no_answer",
  voicemail: "voicemail",
};

export function CommentAnalysisConversations({
  stats,
  loading,
  layout = "page",
}: {
  stats: CommentAnalysisStats | null;
  loading: boolean;
  layout?: "page" | "narrow";
}) {
  const narrow = layout === "narrow";
  const t = useTranslations("commentAnalysis.conversations");
  const tDisp = useTranslations("commentAnalysis.enums.disposition");
  const tInterest = useTranslations("commentAnalysis.enums.interest");
  const tQual = useTranslations("commentAnalysis.enums.qualification");
  const tAction = useTranslations("commentAnalysis.enums.nextAction");
  const locale = useLocale();
  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const nf1 = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }), [locale]);

  const analysed = stats?.conversationCount ?? 0;

  const dispositions = useMemo<ChartDatum[]>(
    () =>
      DISPOSITION_KEYS.map((key) => ({
        key,
        label: tDisp(DISPOSITION_ENUM[key]),
        value:
          (stats?.[`disposition${key.charAt(0).toUpperCase()}${key.slice(1)}` as keyof CommentAnalysisStats] as number) ?? 0,
        color: DISPOSITION_COLOR[key],
      })),
    [stats, tDisp],
  );

  /*
   * Qualification is a funnel, so it is ordered hot → cold and coloured by
   * temperature. Reading it as a ranked bar is the point: a workspace whose
   * cold bar dwarfs the others is not converting, and that has to be legible
   * without reading a single number.
   */
  const qualification = useMemo<ChartDatum[]>(
    () => [
      { key: "hot", label: tQual("hot_lead"), value: stats?.qualificationHotLead ?? 0, color: "hsl(var(--healthy))" },
      { key: "warm", label: tQual("warm_lead"), value: stats?.qualificationWarmLead ?? 0, color: VOZ_SERIES[3] },
      { key: "cold", label: tQual("cold_lead"), value: stats?.qualificationColdLead ?? 0, color: "hsl(var(--muted-foreground))" },
    ],
    [stats, tQual],
  );

  const interest = useMemo<ChartDatum[]>(
    () => [
      { key: "interested", label: tInterest("interested"), value: stats?.interestInterested ?? 0, color: "hsl(var(--healthy))" },
      { key: "undecided", label: tInterest("undecided"), value: stats?.interestUndecided ?? 0, color: VOZ_SERIES[1] },
      { key: "not_interested", label: tInterest("not_interested"), value: stats?.interestNotInterested ?? 0, color: "hsl(var(--destructive))" },
    ],
    [stats, tInterest],
  );

  /*
   * Next action is what a human does tomorrow morning, so escalate leads: it is
   * the only value that means a person is needed rather than a process
   * continuing.
   */
  const nextActions = useMemo<ChartDatum[]>(
    () => [
      { key: "escalate", label: tAction("escalate"), value: stats?.nextActionEscalate ?? 0, color: "hsl(var(--destructive))" },
      { key: "schedule_callback", label: tAction("schedule_callback"), value: stats?.nextActionScheduleCallback ?? 0, color: VOZ_SERIES[3] },
      { key: "send_whatsapp", label: tAction("send_whatsapp"), value: stats?.nextActionSendWhatsApp ?? 0, color: VOZ_SERIES[0] },
      { key: "continue", label: tAction("continue"), value: stats?.nextActionContinue ?? 0, color: VOZ_SERIES[1] },
      { key: "close", label: tAction("close"), value: stats?.nextActionClose ?? 0, color: "hsl(var(--muted-foreground))" },
    ],
    [stats, tAction],
  );

  const instruments = useMemo<Instrument[]>(
    () => [
      { label: t("analysed"), value: nf.format(analysed) },
      {
        label: t("attendanceQuality"),
        value: analysed > 0 ? nf.format(Math.round(stats?.attendanceQualityAvg ?? 0)) : "—",
        // The range matters as much as the average: a 70 made of 40s and 100s
        // is a different operation from a 70 made of 68s and 72s.
        detail: analysed > 0 ? t("range", { min: stats?.attendanceQualityMin ?? 0, max: stats?.attendanceQualityMax ?? 0 }) : undefined,
      },
      {
        label: t("messagesAvg"),
        value: analysed > 0 ? nf1.format(stats?.messagesAvg ?? 0) : "—",
        detail: t("messagesTotal", { count: nf.format(stats?.messagesTotal ?? 0) }),
      },
      {
        label: t("needsHuman"),
        value: nf.format(stats?.nextActionEscalate ?? 0),
        tone: (stats?.nextActionEscalate ?? 0) > 0 ? "fault" : undefined,
      },
    ],
    [analysed, stats, t, nf, nf1],
  );

  if (loading && !stats) {
    return <Skeleton className={narrow ? "h-48" : "h-72"} />;
  }

  // Nothing to say yet. This is a normal state on a workspace that only
  // analyses comments, so it explains rather than looking broken.
  if (analysed === 0) {
    return (
      <Panel title={t("title")} description={t("description")}>
        <EmptyState icon={<ChatsCircle />} title={t("emptyTitle")} description={t("emptyDescription")} />
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <InstrumentStrip instruments={instruments} />

      <div className={narrow ? "flex flex-col gap-4" : "grid grid-cols-1 gap-4 lg:grid-cols-2"}>
        <Panel title={t("dispositionTitle")} description={t("dispositionDescription")}>
          <BlockChart data={dispositions} label={t("dispositionTitle")} legend={false} />
          <ChartLegend data={dispositions} total={analysed} />
        </Panel>

        <Panel title={t("qualificationTitle")} description={t("qualificationDescription")}>
          <WaffleChart data={qualification} label={t("qualificationTitle")} />
          <ChartLegend data={qualification} total={analysed} />
        </Panel>

        <Panel title={t("interestTitle")} description={t("interestDescription")}>
          <BlockChart data={interest} label={t("interestTitle")} legend={false} />
          <ChartLegend data={interest} total={analysed} />
        </Panel>

        <Panel title={t("qualityTitle")} description={t("qualityDescription")}>
          <div className="flex items-center gap-6">
            <ProgressRing value={Math.round(stats?.attendanceQualityAvg ?? 0)} label={t("attendanceQuality")} />
            <div className="flex-1">
              <BlockChart data={nextActions} label={t("qualityTitle")} height={120} legend={false} />
              <ChartLegend data={nextActions} total={analysed} />
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
