"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useFormatter, useTranslations } from "next-intl";

import { adminListSendCapsAction } from "@/app/actions/send-caps";
import { describeSendCapError } from "@/components/admin/send-caps/send-cap-errors";
import { SendCapLimitDialog } from "@/components/admin/send-caps/send-cap-limit-dialog";
import { SendCapUnlockDialog } from "@/components/admin/send-caps/send-cap-unlock-dialog";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import {
    DashboardTable,
    type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import { ArrowsClockwise, CheckCircle, CircleNotch, LockKey, Plus, Prohibit, Warning } from "@/components/icons";
import { AccessDenied } from "@/components/ui/access-denied";
import { useAuth } from "@/contexts/auth-context";
import { isSystemAdmin } from "@/lib/auth/roles";
import {
    sendCapUsageRatio,
    type SendCapItem,
    type SendCapLevel,
    type SendCapListing,
} from "@/lib/balance/send-cap-types";
import { cn } from "@/lib/utils";

type LevelFilter = "all" | SendCapLevel;

const LEVEL_FILTERS: LevelFilter[] = ["all", "reached", "near", "ok"];

const LEVEL_BADGE: Record<SendCapLevel, string> = {
    ok: "bg-healthy text-healthy-foreground",
    near: "bg-warning text-warning-foreground",
    reached: "bg-destructive text-destructive-foreground",
};

const LEVEL_BAR: Record<SendCapLevel, string> = {
    ok: "bg-healthy",
    near: "bg-warning",
    reached: "bg-destructive",
};

type LimitDialogState = { item: SendCapItem | null } | null;

function AdminSendCaps() {
    const t = useTranslations("adminSendCaps");
    const format = useFormatter();

    const [listing, setListing] = useState<SendCapListing | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [reloadKey, setReloadKey] = useState(0);
    const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
    const [limitDialog, setLimitDialog] = useState<LimitDialogState>(null);
    const [unlockTarget, setUnlockTarget] = useState<SendCapItem | null>(null);

    useEffect(() => {
        let cancelled = false;
        void adminListSendCapsAction().then((result) => {
            if (cancelled) return;
            setError(result.error ? describeSendCapError(t, result.error) : null);
            setListing(result.listing);
            setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [reloadKey, t]);

    const reload = () => {
        setLoading(true);
        setReloadKey((key) => key + 1);
    };

    const closeDialogsAndReload = () => {
        setLimitDialog(null);
        setUnlockTarget(null);
        reload();
    };

    const items = useMemo(() => listing?.items ?? [], [listing]);
    const visibleItems = levelFilter === "all" ? items : items.filter((item) => item.level === levelFilter);
    const countOf = (level: SendCapLevel) => items.filter((item) => item.level === level).length;
    const canUnlock = listing?.canUnlock ?? false;
    const statValue = (value: number) => (loading ? "..." : format.number(value));

    const columns = useMemo<DashboardTableColumn<SendCapItem>[]>(
        () => [
            {
                header: t("table.workspace"),
                key: "workspace",
                render: (item) => <p className="truncate text-sm font-semibold text-foreground">{item.workspaceName}</p>,
            },
            {
                header: t("table.usage"),
                key: "usage",
                render: (item) => (
                    <div className="flex min-w-[12rem] items-center gap-2.5">
                        <div
                            className="relative h-1.5 w-24 overflow-hidden rounded-full bg-muted"
                            role="meter"
                            aria-valuemin={0}
                            aria-valuemax={item.limit}
                            aria-valuenow={Math.min(item.used, item.limit)}
                            aria-label={t("table.usage")}
                        >
                            <div
                                className={cn("absolute inset-y-0 left-0 rounded-full", LEVEL_BAR[item.level])}
                                style={{ width: `${sendCapUsageRatio(item) * 100}%` }}
                            />
                        </div>
                        <span className="tabular-nums text-xs text-muted-foreground">
                            {t("table.usageValue", { used: format.number(item.used), limit: format.number(item.limit) })}
                        </span>
                    </div>
                ),
            },
            {
                header: t("table.remaining"),
                key: "remaining",
                className: "text-right",
                render: (item) => <span className="tabular-nums text-foreground">{format.number(item.remaining)}</span>,
            },
            {
                header: t("table.status"),
                key: "status",
                render: (item) => (
                    <span className={cn("inline-flex items-center rounded-[--radius] px-2 py-0.5 text-2xs font-semibold", LEVEL_BADGE[item.level])}>
                        {t(`levels.${item.level}`)}
                    </span>
                ),
            },
            {
                header: t("table.updated"),
                key: "updated",
                render: (item) => (
                    <span className="text-sm text-muted-foreground">
                        {format.dateTime(new Date(item.unlockedAt ?? item.updatedAt), { dateStyle: "short", timeStyle: "short" })}
                        {item.unlockedAt ? <span className="ml-1 text-xs">{t("table.unlockedMark")}</span> : null}
                    </span>
                ),
            },
            {
                header: t("table.actions"),
                key: "actions",
                className: "text-right",
                render: (item) => (
                    <div className="flex items-center justify-end gap-2">
                        <Button onClick={() => setLimitDialog({ item })} title={t("actions.adjust")} variant="outline" />
                        {canUnlock ? (
                            <Button
                                icon={<LockKey className="h-3.5 w-3.5" weight="bold" />}
                                iconVisible
                                onClick={() => setUnlockTarget(item)}
                                title={t("actions.unlock")}
                                variant="outline"
                            />
                        ) : null}
                    </div>
                ),
            },
        ],
        [t, format, canUnlock],
    );

    return (
        <motion.main
            className="w-full space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
        >
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
                <DashboardPageHeader
                    icon={<LockKey className="h-6 w-6" weight="fill" />}
                    badge={t("header.badge")}
                    description={
                        listing
                            ? t("header.descriptionWithMonth", {
                                  month: format.dateTime(new Date(listing.monthStart), {
                                      month: "long",
                                      year: "numeric",
                                      timeZone: "America/Sao_Paulo",
                                  }),
                              })
                            : t("header.description")
                    }
                />
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.1 }}>
                <DashboardTable<SendCapItem>
                    stats={[
                        {
                            label: t("stats.capped"),
                            value: statValue(items.length),
                            icon: <LockKey className="h-4 w-4 text-info-ink" weight="fill" />,
                        },
                        {
                            label: t("levels.near"),
                            value: statValue(countOf("near")),
                            icon: <Warning className="h-4 w-4 text-warning-ink" weight="fill" />,
                        },
                        {
                            label: t("levels.reached"),
                            value: statValue(countOf("reached")),
                            icon: <Prohibit className="h-4 w-4 text-destructive-ink" weight="bold" />,
                        },
                        {
                            label: t("levels.ok"),
                            value: statValue(countOf("ok")),
                            icon: <CheckCircle className="h-4 w-4 text-healthy-ink" weight="fill" />,
                        },
                    ]}
                    headerLeft={
                        <ElevatedPillToggle
                            size="md"
                            value={levelFilter}
                            onChange={setLevelFilter}
                            aria-label={t("levels.all")}
                            options={LEVEL_FILTERS.map((level) => ({ value: level, label: t(`levels.${level}`) }))}
                        />
                    }
                    headerRight={
                        <>
                            <Button
                                icon={<ArrowsClockwise className="h-4 w-4" weight="bold" />}
                                iconVisible
                                disabled={loading}
                                onClick={reload}
                                title={t("actions.refresh")}
                                variant="outline"
                            />
                            <Button
                                icon={<Plus className="h-4 w-4" weight="bold" />}
                                iconVisible
                                onClick={() => setLimitDialog({ item: null })}
                                title={t("actions.create")}
                            />
                        </>
                    }
                    data={error ? [] : visibleItems}
                    columns={columns}
                    rowKey={(item) => item.workspaceId}
                    loading={loading}
                    emptyState={
                        error
                            ? {
                                  icon: <LockKey className="h-7 w-7 text-destructive-ink" weight="fill" />,
                                  title: t("errors.default"),
                                  description: error,
                                  action: <Button variant="outline" title={t("actions.refresh")} onClick={reload} />,
                              }
                            : {
                                  icon: <LockKey className="h-7 w-7 text-muted-foreground" weight="fill" />,
                                  title: levelFilter === "all" ? t("empty.title") : t("empty.filteredTitle"),
                                  description: t("empty.description"),
                              }
                    }
                />
            </motion.div>

            {limitDialog ? (
                <SendCapLimitDialog
                    item={limitDialog.item}
                    canUnlock={canUnlock}
                    onClose={() => setLimitDialog(null)}
                    onSaved={closeDialogsAndReload}
                    onUnlockInstead={(item) => {
                        setLimitDialog(null);
                        setUnlockTarget(item);
                    }}
                />
            ) : null}

            {unlockTarget ? (
                <SendCapUnlockDialog
                    item={unlockTarget}
                    onClose={() => setUnlockTarget(null)}
                    onUnlocked={closeDialogsAndReload}
                />
            ) : null}
        </motion.main>
    );
}

export default function AdminSendCapsPage() {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-32">
                <CircleNotch className="h-8 w-8 animate-spin text-primary-ink" weight="bold" />
            </div>
        );
    }

    if (!isSystemAdmin(user?.role)) {
        return <AccessDenied backHref="/dashboard" />;
    }

    return <AdminSendCaps />;
}
