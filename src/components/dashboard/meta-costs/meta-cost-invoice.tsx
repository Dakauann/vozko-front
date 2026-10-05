"use client";

import { useMemo } from "react";

import { useLocale, useTranslations } from "next-intl";

import { ChatCircle, Pause, Receipt, WarningCircle } from "@/components/icons";
import {
    DashboardTable,
    type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    intlLocale,
    invoiceCounts,
    invoiceStatusLabelKey,
    invoiceStatusTone,
} from "@/lib/analytics/meta-costs";
import type { MetaInvoiceAccount, MetaInvoiceCheckReport } from "@/lib/analytics/types";

import { SectionTitle, StatusChip } from "./meta-cost-parts";

function Count({ value }: { value: string | null }) {
    return value === null ? <EmptyValue /> : <span className="tabular-nums text-foreground">{value}</span>;
}

export function MetaCostInvoice({
    report,
    error,
    loading,
}: {
    report: MetaInvoiceCheckReport | null;
    error: string | null;
    loading: boolean;
}) {
    const t = useTranslations("metaCosts");
    const locale = useLocale();
    const integer = useMemo(
        () => new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0 }),
        [locale],
    );

    const columns: DashboardTableColumn<MetaInvoiceAccount>[] = useMemo(
        () => [
            {
                header: t("colAccount"),
                key: "account",
                render: (row) => (
                    <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{row.name || row.wabaId}</p>
                        <p className="mt-0.5 truncate text-xs tabular-nums text-muted-foreground">
                            {t("wabaId", { id: row.wabaId })}
                        </p>
                    </div>
                ),
            },
            {
                header: t("colOurTemplates"),
                key: "ours",
                className: "text-right",
                render: (row) => <Count value={invoiceCounts(row, locale).ours} />,
            },
            {
                header: t("colMetaTemplates"),
                key: "meta",
                className: "text-right",
                render: (row) => {
                    const counts = invoiceCounts(row, locale);
                    return (
                        <div>
                            <Count value={counts.meta} />
                            {counts.metaCharged !== null ? (
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    {t("metaChargedTemplates", { count: counts.metaCharged })}
                                </p>
                            ) : null}
                        </div>
                    );
                },
            },
            {
                header: t("colDifference"),
                key: "difference",
                className: "text-right",
                render: (row) => {
                    const counts = invoiceCounts(row, locale);
                    return (
                        <span className="whitespace-nowrap">
                            <Count value={counts.difference} />
                            {counts.difference && counts.differencePct ? (
                                <span className="tabular-nums text-muted-foreground"> · {counts.differencePct}</span>
                            ) : null}
                        </span>
                    );
                },
            },
            {
                header: t("colMetaService"),
                key: "service",
                className: "text-right",
                render: (row) => {
                    const counts = invoiceCounts(row, locale);
                    if (counts.chargedService === null || counts.freeService === null) return <EmptyValue />;
                    return (
                        <span className="tabular-nums text-muted-foreground">
                            {t("metaServiceSplit", { charged: counts.chargedService, free: counts.freeService })}
                        </span>
                    );
                },
            },
            {
                header: t("colStatus"),
                key: "status",
                render: (row) => (
                    <StatusChip tone={invoiceStatusTone(row.state)}>{t(invoiceStatusLabelKey(row))}</StatusChip>
                ),
            },
        ],
        [t, locale],
    );

    const totals = report?.totals;

    return (
        <section aria-labelledby="meta-cost-invoice" className="grid gap-3">
            <SectionTitle id="meta-cost-invoice" title={t("invoiceTitle")} subtitle={t("invoiceSubtitle")} />
            {error ? (
                <Alert variant="destructive">
                    <AlertDescription>{t("invoiceError")} {error}</AlertDescription>
                </Alert>
            ) : (
                <DashboardTable
                    data={report?.accounts ?? []}
                    columns={columns}
                    rowKey={(row) => row.wabaId}
                    loading={loading}
                    caption={loading ? t("invoiceLoading") : t("invoiceCaption")}
                    stats={
                        totals
                            ? [
                                  {
                                      label: t("invoiceChargedService"),
                                      value: integer.format(totals.metaChargedService),
                                      icon: <Receipt className="h-4 w-4" weight="fill" />,
                                  },
                                  {
                                      label: t("invoiceFreeService"),
                                      value: integer.format(totals.metaFreeService),
                                      icon: <ChatCircle className="h-4 w-4" weight="fill" />,
                                  },
                                  {
                                      label: t("invoiceUnavailable"),
                                      value: integer.format(totals.unavailableAccounts),
                                      icon: <WarningCircle className="h-4 w-4" weight="fill" />,
                                  },
                                  {
                                      label: t("invoiceIdle"),
                                      value: integer.format(totals.idleAccounts),
                                      icon: <Pause className="h-4 w-4" weight="fill" />,
                                  },
                              ]
                            : undefined
                    }
                    emptyState={{
                        icon: <Receipt className="h-8 w-8 text-muted-foreground" weight="fill" />,
                        title: t("invoiceEmptyTitle"),
                        description: t("invoiceEmptyDescription"),
                    }}
                />
            )}
        </section>
    );
}
