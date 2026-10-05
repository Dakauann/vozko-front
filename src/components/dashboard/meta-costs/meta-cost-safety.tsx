"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { useEmptyValue } from "@/components/elevated-design/empty-value";
import type { MetaCostTone } from "@/lib/analytics/meta-costs";
import { cn } from "@/lib/utils";

import { SectionTitle, StatusDot } from "./meta-cost-parts";

const COUNT_TONE: Record<MetaCostTone, string> = {
    default: "text-foreground",
    healthy: "text-healthy-ink",
    warning: "text-warning-ink",
    fault: "text-destructive-ink",
    info: "text-foreground",
    brand: "text-primary-ink",
};

function SafetyCard({
    tone,
    title,
    status,
    children,
}: {
    tone: MetaCostTone;
    title: string;
    status: string;
    children: ReactNode;
}) {
    return (
        <div className="grid min-w-0 content-start gap-1.5 rounded-[--radius] bg-muted px-4 py-3.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <StatusDot tone={tone} />
                {title}
            </div>
            <span className={cn("readout font-display text-xl font-semibold", COUNT_TONE[tone])}>
                {status}
            </span>
            <p className="text-xs leading-relaxed text-muted-foreground">{children}</p>
        </div>
    );
}

export function MetaCostSafety({
    unlinkedMessages,
    numbersAnchorId,
}: {
    unlinkedMessages: number | null;
    numbersAnchorId: string;
}) {
    const t = useTranslations("metaCosts");
    const empty = useEmptyValue();

    const unlinkedTone: MetaCostTone =
        unlinkedMessages === null ? "default" : unlinkedMessages > 0 ? "warning" : "healthy";

    return (
        <section aria-labelledby="meta-cost-safety" className="grid gap-3">
            <SectionTitle id="meta-cost-safety" title={t("safetyTitle")} subtitle={t("safetySubtitle")} />
            <div className="grid gap-3 md:grid-cols-2">
                <SafetyCard tone="healthy" title={t("webhookTitle")} status={t("webhookStatus")}>
                    {t("webhookBody")}
                </SafetyCard>

                <SafetyCard
                    tone={unlinkedTone}
                    title={t("unlinkedTitle")}
                    status={unlinkedMessages === null ? empty : t("unlinkedCount", { count: unlinkedMessages })}
                >
                    {unlinkedMessages !== null && unlinkedMessages > 0 ? (
                        <>
                            {t("unlinkedBody")}{" "}
                            <a
                                href={`#${numbersAnchorId}`}
                                className="font-semibold text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {t("unlinkedLink")}
                            </a>
                        </>
                    ) : unlinkedMessages === 0 ? (
                        t("unlinkedNone")
                    ) : null}
                </SafetyCard>
            </div>
        </section>
    );
}
