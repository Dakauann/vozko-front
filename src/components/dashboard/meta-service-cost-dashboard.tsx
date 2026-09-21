"use client";

/**
 * What October costs us, per customer.
 *
 * On 1 October 2026 Meta starts charging for service messages: the free-form
 * replies an agent or the AI sends inside the 24 hour window. We absorb that
 * and raise the price per campaign trigger instead. This page is the one input
 * to that pricing decision: per workspace, how much messaging each one does
 * against how much billable campaign volume it buys.
 *
 * It reports counts, not money, on purpose. Meta prices per recipient market,
 * so a count only becomes currency once a rate card and an exchange rate are
 * attached, and neither is ours to promise.
 *
 * All copy lives in the `metaCosts` namespace of the four locale files, and the
 * numbers are formatted for the active locale rather than hardcoded pt-BR. The
 * neighbouring admin-financial-dashboard does neither; this page is the pattern
 * to follow, not that one.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { useLocale, useTranslations } from "next-intl";

import {
    ArrowDown,
    ArrowUp,
    ChatCircle,
    Info,
    PaperPlaneTilt,
    Scales,
    Warning,
} from "@/components/icons";
import {
    DashboardTable,
    type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import {
    getMetaServiceMessageCostAction,
    type MetaServiceMessageCostReport,
    type MetaServiceMessageCostSortField,
    type WorkspaceMetaServiceMessageCost,
} from "@/app/actions/analytics";
import { ElevatedDatePicker } from "@/components/elevated-design/elevated-date-picker";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { InstrumentStrip } from "@/components/console/page-shapes";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 400;
const PAGE_SIZE = 20;

type PeriodPreset = "current" | "previous" | "custom";
type ProviderFilter = "meta" | "dialog360" | "all" | "unattributed";

/**
 * Translation keys for the two enums, so a label is never built by
 * concatenating a prefix onto a value. Every key here is greppable, which is
 * what lets a translator find them and a reviewer prove none is missing.
 */
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
/**
 * The three worth offering as a control. "unattributed" is a data-quality
 * state the notice reports, not a view anyone navigates to on purpose.
 */
const PROVIDER_CHOICES: ProviderFilter[] = ["meta", "dialog360", "all"];

/** Calendar month boundaries, as the half-open range the backend expects. */
function monthRange(offset: number): { startDate: string; endDate: string } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1, 0, 0, 0, 0);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
}

/**
 * The ratio as a bar against parity.
 *
 * Parity is the number that matters: at 1,00 a workspace sends as many service
 * messages as it buys billable sends, and a flat trigger increase stops
 * covering it. The bar is drawn against a scale of two so parity sits at the
 * midpoint and is marked, rather than being a number the reader has to compare
 * in their head.
 */
function RatioBar({
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
                <Warning className="h-3.5 w-3.5 text-warning" weight="fill" />
                <span className="text-xs font-semibold text-warning">{noSendsLabel}</span>
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
                {/* Parity marker at the midpoint of a scale of two. */}
                <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
            </div>
            <span
                className={cn(
                    "w-12 text-right text-sm font-semibold tabular-nums",
                    overParity ? "text-warning" : "text-foreground",
                )}
            >
                {format(ratio)}
            </span>
        </div>
    );
}

export default function MetaServiceCostDashboard() {
    const t = useTranslations("metaCosts");
    const locale = useLocale();

    // Grouping separators and the decimal comma differ per language, and these
    // are the figures a pricing decision is made from. Formatting them for
    // pt-BR regardless of the reader is how "1.058" becomes ambiguous.
    const integer = useMemo(
        () => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
        [locale],
    );
    const ratioFormat = useMemo(
        () =>
            new Intl.NumberFormat(locale, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }),
        [locale],
    );

    const [report, setReport] = useState<MetaServiceMessageCostReport | null>(null);
    const [error, setError] = useState<string | null>(null);
    /**
     * Which request the state in `report` answers.
     *
     * Loading is derived from this rather than set at the top of the fetch
     * effect, because a synchronous setState in an effect body cascades an
     * extra render and the lint rule here rightly forbids it. Comparing the
     * requested parameters to the answered ones is also simply more accurate:
     * it is true on the first render, before any effect has run, and it cannot
     * be left stuck on by an early return.
     */
    const [answeredKey, setAnsweredKey] = useState<string | null>(null);

    const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("current");
    const [customStart, setCustomStart] = useState("");
    const [customEnd, setCustomEnd] = useState("");
    const [provider, setProvider] = useState<ProviderFilter>("meta");

    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [page, setPage] = useState(1);
    const [sortBy, setSortBy] = useState<MetaServiceMessageCostSortField>("ratio");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

    // Debounced so typing a workspace name does not fire one aggregate per
    // keystroke. The query reads three million message rows; a request per
    // character is how an admin page takes the database down.
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

        // A half-filled custom range is not a request: the backend rejects one
        // date without the other, so send neither until both are present and
        // let the month default stand in the meantime.
        if (!customStart || !customEnd) return {};

        const start = new Date(`${customStart}T00:00:00`);
        // Exclusive upper bound: the picker names a day, and the operator means
        // that whole day, so the range runs to the start of the next one.
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

    // Clicking a sorted column flips its direction; clicking a new one starts
    // it descending, because every column here is read "who is highest".
    const handleSort = useCallback(
        (key: string) => {
            const field = key as MetaServiceMessageCostSortField;
            setSortOrder(field === sortBy && sortOrder === "desc" ? "asc" : "desc");
            setSortBy(field);
            setPage(1);
        },
        [sortBy, sortOrder],
    );

    const totals = report?.totals;
    const meta = report?.workspaces;
    const rows = report?.workspaces.items ?? [];

    // How much of the period Meta has given a verdict on. Null while there is
    // nothing to be a share of, rather than 0%, which would read as "Meta has
    // answered for none of a real total".
    const coveragePct = useMemo(() => {
        if (!totals || totals.serviceMessages <= 0) return null;
        return Math.floor((totals.metaAnswered / totals.serviceMessages) * 100);
    }, [totals]);

    const instruments = useMemo(
        () => [
            {
                label: t("serviceMessages"),
                value: integer.format(totals?.serviceMessages ?? 0),
                detail: report?.inferredOnly
                    ? t("serviceMessagesInferred")
                    : t("serviceMessagesConfirmed"),
                tone: "warning" as const,
            },
            {
                label: t("billableSends"),
                value: integer.format(totals?.netBillableSends ?? 0),
                detail: t("billableSendsHint"),
            },
            {
                label: t("perSend"),
                value:
                    totals?.ratio === null || totals?.ratio === undefined
                        ? t("noSends")
                        : ratioFormat.format(totals.ratio),
                detail: t("perSendHint", {
                    count: integer.format(totals?.workspacesCovered ?? 0),
                }),
                tone:
                    totals?.ratio !== null && totals?.ratio !== undefined && totals.ratio >= 1
                        ? ("fault" as const)
                        : ("default" as const),
            },
        ],
        [t, integer, ratioFormat, totals, report?.inferredOnly],
    );

    const columns: DashboardTableColumn<WorkspaceMetaServiceMessageCost>[] = useMemo(
        () => [
            {
                header: t("colWorkspace"),
                key: "workspaceName",
                sortKey: "workspaceName",
                render: (row) => (
                    <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">
                            {row.workspaceName}
                        </p>
                        {row.providers.length > 0 && (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {row.providers
                                    .map((p) =>
                                        PROVIDER_KEYS[p as ProviderFilter]
                                            ? t(PROVIDER_KEYS[p as ProviderFilter])
                                            : p,
                                    )
                                    .join(" · ")}
                            </p>
                        )}
                    </div>
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
                            // Meta's own verdict, shown under our inference rather than
                            // replacing it: the gap between the two is the reader's cue
                            // for how much of this figure is still an estimate.
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
                    <span className="tabular-nums text-muted-foreground">
                        {integer.format(row.netBillableSends)}
                    </span>
                ),
            },
            {
                header: t("colPerSend"),
                key: "ratio",
                sortKey: "ratio",
                className: "text-right",
                render: (row) => (
                    <RatioBar
                        ratio={row.ratio}
                        format={(v) => ratioFormat.format(v)}
                        noSendsLabel={t("noSends")}
                    />
                ),
            },
        ],
        [t, integer, ratioFormat],
    );

    /**
     * One line, not a paragraph.
     *
     * This used to spell out the whole free-entry-point rule, which is the kind
     * of thing the reader needs once and then resents on every visit. What they
     * need standing is the status of the number in front of them: estimate or
     * confirmed, and how far along.
     */
    const notice = useMemo(() => {
        if (!report) return null;
        const parts: string[] = [];
        if (report.inferredOnly) {
            parts.push(t("noticeInferred"));
            if (coveragePct !== null && coveragePct > 0) {
                parts.push(t("noticeCoverage", { percent: coveragePct }));
            }
        } else {
            parts.push(
                t("noticeConfirmed", {
                    count: integer.format(totals?.metaConfirmed ?? 0),
                }),
            );
        }
        if ((totals?.unattributedServiceMessages ?? 0) > 0) {
            parts.push(
                t("noticeUnattributed", {
                    count: integer.format(totals?.unattributedServiceMessages ?? 0),
                }),
            );
        }
        return parts.join(" ");
    }, [report, t, integer, coveragePct, totals]);

    return (
        <div className="space-y-6">
            <header>
                <h1 className="font-display text-2xl font-semibold tracking-[0.01em] text-foreground">
                    {t("title")}
                </h1>
                <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                    {t("subtitle")}
                </p>
            </header>

            <InstrumentStrip instruments={instruments} loading={loading && !report} columns={3} />

            {notice && (
                <div className="flex items-start gap-3 rounded-[--radius] border border-border bg-muted px-4 py-3">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" weight="duotone" />
                    <p className="text-xs leading-relaxed text-muted-foreground">{notice}</p>
                </div>
            )}

            {error && (
                <div className="flex items-start gap-3 rounded-[--radius] border border-destructive/40 bg-destructive/5 px-4 py-3">
                    <Warning className="mt-0.5 h-4 w-4 shrink-0 text-destructive" weight="fill" />
                    <p className="text-sm text-destructive">{error || t("loadError")}</p>
                </div>
            )}

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
                    <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                            <ElevatedPillToggle
                                size="md"
                                value={periodPreset}
                                onChange={(next) => {
                                    setPeriodPreset(next);
                                    setPage(1);
                                }}
                                aria-label={t("customPeriod")}
                                options={PERIOD_PRESETS.map((preset) => ({
                                    value: preset,
                                    label: t(PERIOD_KEYS[preset]),
                                }))}
                            />
                            {periodPreset === "custom" && (
                                <div className="flex items-center gap-2">
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
                                        minDate={
                                            customStart ? new Date(`${customStart}T00:00:00`) : undefined
                                        }
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <ElevatedInput
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                variant="search"
                                placeholder={t("searchPlaceholder")}
                                className="w-full lg:max-w-xs"
                            />
                            <ElevatedPillToggle
                                size="md"
                                value={provider}
                                onChange={(next) => {
                                    setProvider(next);
                                    setPage(1);
                                }}
                                aria-label={t("providerAll")}
                                options={PROVIDER_CHOICES.map((p) => ({
                                    value: p,
                                    label: t(PROVIDER_KEYS[p]),
                                }))}
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
        </div>
    );
}
