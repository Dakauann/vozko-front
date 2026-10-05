"use client";

import { useMemo } from "react";

import { useLocale, useTranslations } from "next-intl";

import { Phone } from "@/components/icons";
import {
    DashboardTable,
    type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import {
    formatDayMonth,
    intlLocale,
    numberStateLabelKey,
    numberStateTone,
    type NumberTableRow,
} from "@/lib/analytics/meta-costs";

import { SectionTitle, StatusChip } from "./meta-cost-parts";

export function MetaCostNumbers({
    anchorId,
    rows,
    loading,
    providerLabel,
}: {
    anchorId: string;
    rows: NumberTableRow[];
    loading: boolean;
    providerLabel: (provider: string) => string;
}) {
    const t = useTranslations("metaCosts");
    const locale = useLocale();
    const integer = useMemo(
        () => new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0 }),
        [locale],
    );

    const columns: DashboardTableColumn<NumberTableRow>[] = useMemo(
        () => [
            {
                header: t("colNumber"),
                key: "number",
                render: (row) => (
                    <div className="min-w-0">
                        <p className="truncate font-semibold tabular-nums text-foreground">
                            {row.kind === "number" ? row.displayPhoneNumber || row.phoneId : row.phoneLabel}
                        </p>
                        {row.kind === "number" && row.provider ? (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {providerLabel(row.provider)}
                            </p>
                        ) : null}
                    </div>
                ),
            },
            {
                header: t("colWorkspace"),
                key: "workspace",
                render: (row) =>
                    row.kind === "number" && row.workspaceName ? (
                        <span className="text-foreground">{row.workspaceName}</span>
                    ) : row.kind === "number" ? (
                        <EmptyValue />
                    ) : (
                        <span className="text-muted-foreground">{t("numberState.unlinked")}</span>
                    ),
            },
            {
                header: t("colMetaCharge"),
                key: "state",
                render: (row) => {
                    if (row.kind === "unlinked") {
                        return <StatusChip tone="warning">{t("numberState.unlinked")}</StatusChip>;
                    }
                    const date = formatDayMonth(row.firstChargedAt, locale);
                    if (row.state === "charging" && !date) {
                        return <EmptyValue />;
                    }
                    return (
                        <StatusChip tone={numberStateTone(row.state)}>
                            {t(numberStateLabelKey(row.state), { date: date ?? "" })}
                        </StatusChip>
                    );
                },
            },
            {
                header: t("colServiceMessages"),
                key: "serviceMessages",
                className: "text-right",
                render: (row) => (
                    <span className="tabular-nums text-foreground">
                        {integer.format(row.kind === "number" ? row.serviceMessages : row.messages)}
                    </span>
                ),
            },
            {
                header: t("colCharged"),
                key: "charged",
                className: "text-right",
                render: (row) =>
                    row.kind === "number" ? (
                        <span className="tabular-nums text-foreground">{integer.format(row.charged)}</span>
                    ) : (
                        <EmptyValue />
                    ),
            },
        ],
        [t, locale, integer, providerLabel],
    );

    return (
        <section id={anchorId} aria-labelledby={`${anchorId}-title`} className="grid scroll-mt-6 gap-3">
            <SectionTitle id={`${anchorId}-title`} title={t("numbersTitle")} subtitle={t("numbersSubtitle")} />
            <DashboardTable
                data={rows}
                columns={columns}
                rowKey={(row) => row.rowKey}
                loading={loading}
                caption={t("numbersCaption")}
                emptyState={{
                    icon: <Phone className="h-8 w-8 text-muted-foreground" weight="fill" />,
                    title: t("numbersEmptyTitle"),
                    description: t("numbersEmptyDescription"),
                }}
            />
        </section>
    );
}
