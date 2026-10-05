"use client";

import { useMemo, type ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";

import { useEmptyValue } from "@/components/elevated-design/empty-value";
import {
    answerBreakdown,
    formatShare,
    intlLocale,
    type AnswerSegmentKey,
} from "@/lib/analytics/meta-costs";
import type { MetaServiceMessageAnswers } from "@/lib/analytics/types";
import { cn } from "@/lib/utils";

import { SectionTitle } from "./meta-cost-parts";

const SEGMENT_FILL: Record<AnswerSegmentKey, string> = {
    charged: "bg-primary",
    free: "bg-chart-2",
    noAnswer: "bg-border-strong",
};

const SEGMENT_LABEL: Record<AnswerSegmentKey, string> = {
    charged: "answerCharged",
    free: "answerFree",
    noAnswer: "answerNoAnswer",
};

export function MetaCostAnswers({
    answers,
    loading,
}: {
    answers: MetaServiceMessageAnswers | null;
    loading: boolean;
}) {
    const t = useTranslations("metaCosts");
    const locale = useLocale();
    const empty = useEmptyValue();
    const integer = useMemo(
        () => new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0 }),
        [locale],
    );

    const breakdown = answerBreakdown(answers);
    const share = (value: number | null) => formatShare(value, locale, 1) ?? empty;

    const hints: Record<AnswerSegmentKey, ReactNode> = {
        charged: t("answerChargedHint"),
        free: t("answerFreeHint"),
        noAnswer: t("answerNoAnswerHint"),
    };

    return (
        <section aria-labelledby="meta-cost-answers" className="grid gap-3">
            <SectionTitle id="meta-cost-answers" title={t("answersTitle")} subtitle={t("answersSubtitle")} />
            <div className="grid gap-3.5 rounded-[--radius] border border-border bg-card p-4 shadow-quiet sm:p-5">
                {loading && !breakdown ? (
                    <span className="block h-3.5 w-full animate-pulse rounded-full bg-border" />
                ) : !breakdown || breakdown.total === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        {breakdown ? t("answersEmpty") : empty}
                    </p>
                ) : (
                    <>
                        <div
                            role="img"
                            aria-label={t("answersAria", {
                                charged: share(breakdown.segments[0].share),
                                free: share(breakdown.segments[1].share),
                                noAnswer: share(breakdown.segments[2].share),
                            })}
                            className="flex h-3.5 overflow-hidden rounded-full bg-muted"
                        >
                            {breakdown.segments.map((segment) => (
                                <span
                                    key={segment.key}
                                    className={cn(
                                        "block h-full motion-safe:transition-[width] motion-safe:duration-300",
                                        SEGMENT_FILL[segment.key],
                                    )}
                                    style={{ width: `${(segment.share ?? 0) * 100}%` }}
                                />
                            ))}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                            {breakdown.segments.map((segment) => (
                                <div key={segment.key} className="grid gap-0.5">
                                    <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                        <span
                                            aria-hidden="true"
                                            className={cn("h-2.5 w-2.5 rounded-[3px]", SEGMENT_FILL[segment.key])}
                                        />
                                        {t(SEGMENT_LABEL[segment.key])}
                                    </span>
                                    <span className="text-sm tabular-nums text-muted-foreground">
                                        {integer.format(segment.count)} · {share(segment.share)} · {hints[segment.key]}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </section>
    );
}
