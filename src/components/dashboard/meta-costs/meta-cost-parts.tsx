"use client";

import type { ReactNode } from "react";

import { Warning } from "@/components/icons";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import type { MetaCostTone } from "@/lib/analytics/meta-costs";
import { cn } from "@/lib/utils";

const TONE_INK: Record<MetaCostTone, string> = {
    default: "text-muted-foreground",
    healthy: "text-healthy-ink",
    warning: "text-warning-ink",
    fault: "text-destructive-ink",
    info: "text-info-ink",
    brand: "text-primary-ink",
};

const TONE_DOT: Record<MetaCostTone, string> = {
    default: "bg-border-strong",
    healthy: "bg-healthy",
    warning: "bg-warning",
    fault: "bg-destructive",
    info: "bg-info",
    brand: "bg-primary",
};

const AMOUNT_TONE: Record<MetaCostTone, string> = {
    default: "",
    healthy: "font-semibold text-healthy-ink",
    warning: "font-semibold text-warning-ink",
    fault: "font-semibold text-destructive-ink",
    info: "text-info-ink",
    brand: "text-primary-ink",
};

export function StatusDot({ tone, className }: { tone: MetaCostTone; className?: string }) {
    return (
        <span
            aria-hidden="true"
            className={cn("inline-block h-2 w-2 shrink-0 rounded-full", TONE_DOT[tone], className)}
        />
    );
}

export function StatusChip({ tone, children }: { tone: MetaCostTone; children: ReactNode }) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold",
                TONE_INK[tone],
            )}
        >
            <StatusDot tone={tone} />
            {children}
        </span>
    );
}

export function Amount({
    value,
    tone = "default",
    className,
}: {
    value: string | null;
    tone?: MetaCostTone;
    className?: string;
}) {
    if (value === null) return <EmptyValue className={className} />;
    return <span className={cn("tabular-nums", AMOUNT_TONE[tone], className)}>{value}</span>;
}

export function SectionTitle({
    id,
    title,
    subtitle,
}: {
    id: string;
    title: string;
    subtitle: string;
}) {
    return (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 id={id} className="font-display text-[17px] font-semibold text-foreground">
                {title}
            </h2>
            <span className="text-sm text-muted-foreground">{subtitle}</span>
        </div>
    );
}

export function RatioBar({
    ratio,
    format,
    noSendsLabel,
}: {
    ratio: number | null | undefined;
    format: (value: number) => string;
    noSendsLabel: string;
}) {
    if (ratio === null || ratio === undefined) {
        return (
            <div className="flex items-center justify-end gap-1.5">
                <Warning className="h-3.5 w-3.5 text-warning-ink" weight="fill" />
                <span className="text-xs font-semibold text-warning-ink">{noSendsLabel}</span>
            </div>
        );
    }

    const overParity = ratio >= 1;
    const width = Math.min(ratio / 2, 1) * 100;

    return (
        <div className="flex items-center justify-end gap-2.5">
            <div className="relative hidden h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:block">
                <div
                    className={cn(
                        "absolute inset-y-0 left-0 rounded-full",
                        overParity ? "bg-warning" : "bg-primary-ink/60",
                    )}
                    style={{ width: `${width}%` }}
                />
                <div className="absolute inset-y-0 left-1/2 w-px bg-border-strong" />
            </div>
            <span
                className={cn(
                    "w-12 text-right text-sm font-semibold tabular-nums",
                    overParity ? "text-warning-ink" : "text-foreground",
                )}
            >
                {format(ratio)}
            </span>
        </div>
    );
}
