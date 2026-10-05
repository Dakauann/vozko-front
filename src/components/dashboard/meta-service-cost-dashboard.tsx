"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useLocale, useTranslations } from "next-intl";

import { ArrowDown, ArrowUp, ChatCircle, PaperPlaneTilt, Scales } from "@/components/icons";
import {
    DashboardTable,
    type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import {
    getMetaInvoiceCheckAction,
    getMetaServiceMessageCostAction,
    type MetaInvoiceCheckReport,
    type MetaServiceMessageCostReport,
    type MetaServiceMessageCostSortField,
    type WorkspaceMetaServiceMessageCost,
} from "@/app/actions/analytics";
import { ElevatedDatePicker } from "@/components/elevated-design/elevated-date-picker";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { EmptyValue, useEmptyValue } from "@/components/elevated-design/empty-value";
import { InstrumentStrip, type Instrument } from "@/components/console/page-shapes";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link } from "@/i18n/routing";
import {
    formatExchangeRate,
    formatMoneyBrl,
    formatShare,
    intlLocale,
    marginTone,
    numberTableRows,
    shareOf,
} from "@/lib/analytics/meta-costs";
import { cn } from "@/lib/utils";

import { MetaCostAnswers } from "./meta-costs/meta-cost-answers";
import { MetaCostInvoice } from "./meta-costs/meta-cost-invoice";
import { MetaCostNumbers } from "./meta-costs/meta-cost-numbers";
import { Amount, RatioBar, SectionTitle, StatusChip } from "./meta-costs/meta-cost-parts";
import { MetaCostSafety } from "./meta-costs/meta-cost-safety";

const SEARCH_DEBOUNCE_MS = 400;
const PAGE_SIZE = 20;
const PRICING_HREF = "/dashboard/pricing";
const NUMBERS_ANCHOR = "meta-cost-numbers";

type PeriodPreset = "current" | "previous" | "custom";
type ProviderFilter = "meta" | "dialog360" | "all" | "unattributed";

const PERIOD_KEYS: Record<PeriodPreset, string> = {
    current: "currentMonth",
    previous: "previousMonth",
    custom: "customPeriod",
};
const PROVIDER_KEYS: Record<ProviderFilter, string> = {
    meta: "providerMeta",
    dialog360: "providerDialog360",
    all: "providerAll",
    unattributed: "providerUnattributed",
};

const PERIOD_PRESETS: PeriodPreset[] = ["current", "previous", "custom"];
const PROVIDER_CHOICES: ProviderFilter[] = ["meta", "dialog360", "all"];

function monthRange(offset: number): { startDate: string; endDate: string } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1, 0, 0, 0, 0);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
}

type InvoiceState = {
    key: string;
    report: MetaInvoiceCheckReport | null;
    error: string | null;
};

export default function MetaServiceCostDashboard() {
    const t = useTranslations("metaCosts");
    const locale = useLocale();
    const empty = useEmptyValue();

    const integer = useMemo(
        () => new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0 }),
        [locale],
    );
    const ratioFormat = useMemo(
        () =>
            new Intl.NumberFormat(intlLocale(locale), {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }),
        [locale],
    );

    const [report, setReport] = useState<MetaServiceMessageCostReport | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [answeredKey, setAnsweredKey] = useState<string | null>(null);
    const [invoice, setInvoice] = useState<InvoiceState | null>(null);

    const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("current");
    const [customStart, setCustomStart] = useState("");
    const [customEnd, setCustomEnd] = useState("");
    const [provider, setProvider] = useState<ProviderFilter>("meta");

    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [page, setPage] = useState(1);
    const [sortBy, setSortBy] = useState<MetaServiceMessageCostSortField>("ratio");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search.trim());
            setPage(1);
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [search]);

    const range = useMemo(() => {
        if (periodPreset === "current") return monthRange(0);
        if (periodPreset === "previous") return monthRange(-1);

        if (!customStart || !customEnd) return {};

        const start = new Date(`${customStart}T00:00:00`);
        const end = new Date(`${customEnd}T00:00:00`);
        end.setDate(end.getDate() + 1);
        return { startDate: start.toISOString(), endDate: end.toISOString() };
    }, [periodPreset, customStart, customEnd]);

    const params = useMemo(
        () => ({
            ...range,
            provider,
            search: debouncedSearch || undefined,
            page,
            pageSize: PAGE_SIZE,
            sortBy,
            sortOrder,
        }),
        [range, provider, debouncedSearch, page, sortBy, sortOrder],
    );
    const requestKey = useMemo(() => JSON.stringify(params), [params]);
    const loading = answeredKey !== requestKey;

    useEffect(() => {
        let cancelled = false;

        getMetaServiceMessageCostAction(params).then((result) => {
            if (cancelled) return;
            setError(result.error ?? null);
            if (result.data) {
                setReport(result.data);
            }
            setAnsweredKey(requestKey);
        });

        return () => {
            cancelled = true;
        };
    }, [params, requestKey]);

    const invoiceKey = useMemo(() => JSON.stringify(range), [range]);
    const reportReady = report !== null;

    useEffect(() => {
        if (!reportReady) return;
        let cancelled = false;

        getMetaInvoiceCheckAction(range).then((result) => {
            if (cancelled) return;
            setInvoice({
                key: invoiceKey,
                report: result.data ?? null,
                error: result.error ?? null,
            });
        });

        return () => {
            cancelled = true;
        };
    }, [reportReady, range, invoiceKey]);

    const invoiceLoading = invoice?.key !== invoiceKey;

    const handleSort = useCallback(
        (key: string) => {
            const field = key as MetaServiceMessageCostSortField;
            setSortOrder(field === sortBy && sortOrder === "desc" ? "asc" : "desc");
            setSortBy(field);
            setPage(1);
        },
        [sortBy, sortOrder],
    );

    const providerLabel = useCallback(
        (value: string) =>
            PROVIDER_KEYS[value as ProviderFilter] ? t(PROVIDER_KEYS[value as ProviderFilter]) : value,
        [t],
    );

    const totals = report?.totals;
    const rates = report?.rates ?? null;
    const meta = report?.workspaces;
    const rows = report?.workspaces.items ?? [];
    const exchangeRate = formatExchangeRate(rates, locale);

    const brl = useCallback(
        (value: Parameters<typeof formatMoneyBrl>[0]) => formatMoneyBrl(value, locale),
        [locale],
    );

    const numberRows = useMemo(() => numberTableRows(report), [report]);

    const instruments: Instrument[] = useMemo(() => {
        const answeredShare = totals ? formatShare(shareOf(totals.metaAnswered, totals.serviceMessages), locale) : null;
        return [
            {
                label: t("serviceMessages"),
                value: totals ? integer.format(totals.serviceMessages) : <EmptyValue />,
                detail: t("answeredShare", { percent: answeredShare ?? empty }),
            },
            {
                label: t("metaChargedService"),
                value: <Amount value={brl(totals?.confirmedServiceCost)} />,
                detail: totals?.answers
                    ? t("metaChargedServiceDetail", { count: totals.answers.charged })
                    : undefined,
                tone: (totals?.serviceCostMissing ?? 0) > 0 ? "warning" : "default",
            },
            {
                label: t("vozkoMetaCost"),
                value: <Amount value={brl(totals?.vozkoMetaCost)} />,
                detail: t("vozkoMetaCostDetail"),
            },
            {
                label: t("realMargin"),
                value: <Amount value={brl(totals?.realMargin)} />,
                detail: t("realMarginDetail"),
                tone: marginTone(totals?.realMargin),
            },
            {
                label: t("paidByClients"),
                value: <Amount value={brl(totals?.paidByClients)} />,
                detail: t("paidByClientsDetail"),
            },
        ];
    }, [t, locale, integer, totals, empty, brl]);

    const columns: DashboardTableColumn<WorkspaceMetaServiceMessageCost>[] = useMemo(
        () => [
            {
                header: t("colWorkspace"),
                key: "workspaceName",
                sortKey: "workspaceName",
                render: (row) => (
                    <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{row.workspaceName}</p>
                        {row.providers.length > 0 && (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {row.providers.map(providerLabel).join(" · ")}
                            </p>
                        )}
                    </div>
                ),
            },
            {
                header: t("colPayer"),
                key: "metaPayer",
                render: (row) =>
                    row.economics?.metaPayer === "vozko" ? (
                        <StatusChip tone="brand">{t("payerVozko")}</StatusChip>
                    ) : row.economics?.metaPayer === "client" ? (
                        <StatusChip tone="default">{t("payerClient")}</StatusChip>
                    ) : (
                        <EmptyValue />
                    ),
            },
            {
                header: t("colServiceMessages"),
                key: "serviceMessages",
                sortKey: "serviceMessages",
                className: "text-right",
                render: (row) => (
                    <div className="tabular-nums text-foreground">
                        {integer.format(row.serviceMessages)}
                        {row.metaConfirmed > 0 && (
                            <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                                {integer.format(row.metaConfirmed)} {t("confirmedSuffix")}
                            </p>
                        )}
                    </div>
                ),
            },
            {
                header: t("colBillableSends"),
                key: "netBillableSends",
                sortKey: "netBillableSends",
                className: "text-right",
                render: (row) => (
                    <span className="tabular-nums text-foreground">{integer.format(row.netBillableSends)}</span>
                ),
            },
            {
                header: t("colPerSend"),
                key: "ratio",
                sortKey: "ratio",
                className: "text-right",
                render: (row) => (
                    <RatioBar ratio={row.ratio} format={(v) => ratioFormat.format(v)} noSendsLabel={t("noSends")} />
                ),
            },
            {
                header: t("colMetaCost"),
                key: "vozkoMetaCost",
                className: "text-right",
                render: (row) => {
                    const economics = row.economics;
                    if (!economics) return <EmptyValue />;
                    if (economics.metaPayer === "client") {
                        return (
                            <div>
                                <span className="text-muted-foreground">{t("paidByClientLabel")}</span>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    {t("costsOnClient", {
                                        templates: brl(economics.templateCost) ?? empty,
                                        service: brl(economics.serviceCost) ?? empty,
                                    })}
                                </p>
                            </div>
                        );
                    }
                    return (
                        <div>
                            <Amount value={brl(economics.vozkoMetaCost)} />
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                {t("serviceCostSub", { cost: brl(economics.serviceCost) ?? empty })}
                            </p>
                        </div>
                    );
                },
            },
            {
                header: t("colPaidByClient"),
                key: "paidByClient",
                className: "text-right",
                render: (row) => <Amount value={brl(row.economics?.paidByClient)} />,
            },
            {
                header: t("colRealMargin"),
                key: "realMargin",
                className: "text-right",
                render: (row) => {
                    const economics = row.economics;
                    if (!economics) return <EmptyValue />;
                    return (
                        <div>
                            <Amount value={brl(economics.realMargin)} tone={marginTone(economics.realMargin)} />
                            {economics.serviceExceedsPrice ? (
                                <div className="mt-1">
                                    <StatusChip tone="fault">{t("serviceExceedsPrice")}</StatusChip>
                                </div>
                            ) : economics.metaPayer === "client" ? (
                                <p className="mt-0.5 text-xs text-muted-foreground">{t("noMetaCostForVozko")}</p>
                            ) : null}
                        </div>
                    );
                },
            },
        ],
        [t, integer, ratioFormat, providerLabel, brl, empty],
    );

    return (
        <div className="space-y-6">
            <header>
                <h1 className="font-display text-2xl font-semibold tracking-[0.01em] text-foreground">
                    {t("title")}
                </h1>
                <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">{t("subtitle")}</p>
            </header>

            <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                    <ElevatedPillToggle
                        size="md"
                        value={periodPreset}
                        onChange={(next) => {
                            setPeriodPreset(next);
                            setPage(1);
                        }}
                        aria-label={t("periodLabel")}
                        options={PERIOD_PRESETS.map((preset) => ({
                            value: preset,
                            label: t(PERIOD_KEYS[preset]),
                        }))}
                    />
                    {periodPreset === "custom" && (
                        <div className="flex flex-wrap items-center gap-2">
                            <ElevatedDatePicker
                                id="meta-cost-start"
                                label={t("start")}
                                value={customStart}
                                onChange={(v) => {
                                    setCustomStart(v);
                                    setPage(1);
                                }}
                                inputClassName="min-w-[150px]"
                            />
                            <ElevatedDatePicker
                                id="meta-cost-end"
                                label={t("end")}
                                value={customEnd}
                                onChange={(v) => {
                                    setCustomEnd(v);
                                    setPage(1);
                                }}
                                inputClassName="min-w-[150px]"
                                minDate={customStart ? new Date(`${customStart}T00:00:00`) : undefined}
                            />
                        </div>
                    )}
                </div>
                <ElevatedPillToggle
                    size="md"
                    value={provider}
                    onChange={(next) => {
                        setProvider(next);
                        setPage(1);
                    }}
                    aria-label={t("providerLabel")}
                    options={PROVIDER_CHOICES.map((p) => ({
                        value: p,
                        label: t(PROVIDER_KEYS[p]),
                    }))}
                />
                <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm tabular-nums text-muted-foreground">
                    <span>
                        {t.rich("exchangeRate", {
                            rate: exchangeRate ?? empty,
                            b: (chunks) => (
                                <b className={cn("font-semibold", exchangeRate ? "text-foreground" : "text-muted-foreground")}>
                                    {chunks}
                                </b>
                            ),
                        })}
                    </span>
                    <Link
                        href={PRICING_HREF}
                        className="font-semibold text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        {t("exchangeRateChange")}
                    </Link>
                </div>
            </div>

            {(totals?.serviceCostMissing ?? 0) > 0 ? (
                <Alert variant="warning">
                    <AlertTitle>{t("serviceCostMissingTitle")}</AlertTitle>
                    <AlertDescription>
                        {t("serviceCostMissingBody", { count: totals?.serviceCostMissing ?? 0 })}{" "}
                        <Link
                            href={PRICING_HREF}
                            className="font-semibold text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            {t("serviceCostMissingAction")}
                        </Link>
                    </AlertDescription>
                </Alert>
            ) : null}

            {error ? (
                <Alert variant="destructive">
                    <AlertDescription>{error || t("loadError")}</AlertDescription>
                </Alert>
            ) : null}

            <section aria-label={t("summaryLabel")}>
                <InstrumentStrip instruments={instruments} loading={loading && !report} columns={5} />
            </section>

            <MetaCostSafety
                unlinkedMessages={totals?.unlinkedServiceMessages ?? null}
                numbersAnchorId={NUMBERS_ANCHOR}
            />

            <MetaCostAnswers
                answers={totals?.answers ?? null}
                loading={loading}
            />

            <MetaCostNumbers
                anchorId={NUMBERS_ANCHOR}
                rows={numberRows}
                loading={loading && !report}
                providerLabel={providerLabel}
            />

            <section aria-labelledby="meta-cost-clients" className="grid gap-3">
                <SectionTitle id="meta-cost-clients" title={t("clientsTitle")} subtitle={t("clientsSubtitle")} />
                <DashboardTable
                    data={rows}
                    columns={columns}
                    rowKey={(row) => row.workspaceId}
                    loading={loading}
                    caption={t("caption")}
                    sorting={{
                        sorts: [{ key: sortBy, direction: sortOrder }],
                        onToggle: (key) => handleSort(key),
                    }}
                    stats={[
                        {
                            label: t("workspaces"),
                            value: integer.format(meta?.total_items ?? 0),
                            icon: <ChatCircle className="h-4 w-4" weight="fill" />,
                        },
                        {
                            label: t("page"),
                            value: `${meta?.page ?? 1}/${Math.max(meta?.total_pages ?? 1, 1)}`,
                            icon: <PaperPlaneTilt className="h-4 w-4" weight="fill" />,
                        },
                    ]}
                    toolbar={
                        <div className="flex w-full flex-wrap items-center gap-2">
                            <ElevatedInput
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                variant="search"
                                placeholder={t("searchPlaceholder")}
                                className="w-full lg:max-w-xs"
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    setSortOrder((c) => (c === "desc" ? "asc" : "desc"));
                                    setPage(1);
                                }}
                                className="inline-flex items-center gap-2 rounded-[--radius] border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                            >
                                {sortOrder === "desc" ? (
                                    <ArrowDown className="h-3.5 w-3.5 text-primary-ink" weight="bold" />
                                ) : (
                                    <ArrowUp className="h-3.5 w-3.5 text-primary-ink" weight="bold" />
                                )}
                                {t("order")}
                            </button>
                        </div>
                    }
                    emptyState={{
                        icon: <Scales className="h-8 w-8 text-muted-foreground" weight="fill" />,
                        title: t("emptyTitle"),
                        description: t("emptyDescription"),
                    }}
                    pagination={
                        meta
                            ? {
                                  currentPage: meta.page,
                                  totalPages: Math.max(meta.total_pages, 1),
                                  pageSize: meta.page_size,
                                  totalItems: meta.total_items,
                                  onPageChange: setPage,
                              }
                            : undefined
                    }
                    paginationText={{
                        showing: t("showing"),
                        of: t("of"),
                        items: t("items"),
                    }}
                />
            </section>

            <MetaCostInvoice
                report={invoice?.key === invoiceKey ? invoice.report : null}
                error={invoice?.key === invoiceKey ? invoice.error : null}
                loading={invoiceLoading}
            />
        </div>
    );
}
