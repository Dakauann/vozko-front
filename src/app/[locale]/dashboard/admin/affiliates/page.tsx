"use client";

import * as React from "react";

import type {
  Affiliate,
  AffiliateTier,
  PaginationMeta,
} from "@/lib/affiliate/types";
import {
  ArrowsClockwise,
  ArrowsDownUp,
  CaretLeft,
  CaretRight,
  CircleNotch,
  Crown,
  FloppyDisk,
  MagnifyingGlass,
  PencilSimple,
  UserCircle,
} from "@/components/icons";

import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { StatusRail } from "@/components/console/page-shapes";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import {
  adminListAffiliatesAction,
  adminUpdateAffiliateAction,
} from "@/app/actions/affiliate";

const DEFAULT_META: PaginationMeta = {
  page: 1,
  pageSize: 20,
  totalItems: 0,
  totalPages: 0,
};

function isSystemAdmin(role?: string | null) {
  return role === "admin" || role === "ADMIN" || role === "administrator";
}

interface AdminAffiliatesApiResponse {
  items: Affiliate[];
  meta: PaginationMeta;
  error?: string;
}

interface AdminAffiliateUpdateResponse {
  affiliate: Affiliate | null;
  error?: string;
}

async function fetchAffiliates(
  page: number,
  pageSize: number,
): Promise<AdminAffiliatesApiResponse> {
  return adminListAffiliatesAction(page, pageSize);
}

async function updateAffiliate(
  id: string,
  body: { commissionPct?: number; active?: boolean; tier?: AffiliateTier },
): Promise<AdminAffiliateUpdateResponse> {
  return adminUpdateAffiliateAction(id, body);
}

function AdminAffiliatesTable() {
  const t = useTranslations("adminAffiliates");
  const { toast } = useToast();

  const [items, setItems] = React.useState<Affiliate[]>([]);
  const [meta, setMeta] = React.useState<PaginationMeta>(DEFAULT_META);
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(20);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draftPct, setDraftPct] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAffiliates(page, pageSize);
      if (res.error) {
        setError(res.error);
        return;
      }
      setItems(res.items ?? []);
      setMeta(res.meta ?? DEFAULT_META);
    } catch {
      setError(t("error.default"));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, t]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const filteredItems = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((a) => {
      if (statusFilter === "active" && !a.active) return false;
      if (statusFilter === "inactive" && a.active) return false;
      if (!q) return true;
      return (
        a.brandName.toLowerCase().includes(q) ||
        a.code.toLowerCase().includes(q)
      );
    });
  }, [items, search, statusFilter]);

  const activeCount = items.filter((a) => a.active).length;
  const inactiveCount = items.length - activeCount;

  const startEdit = (aff: Affiliate) => {
    setEditingId(aff.id);
    setDraftPct((aff.commissionPct * 100).toFixed(2));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftPct("");
  };

  const saveCommission = async (aff: Affiliate) => {
    const parsed = Number.parseFloat(draftPct.replace(/,/g, "."));
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 30) {
      toast({
        title: t("toast.invalidCommission"),
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const res = await updateAffiliate(aff.id, {
        commissionPct: parsed / 100,
      });
      if (res.error || !res.affiliate) {
        toast({
          title: t("toast.updateFailed"),
          description: res.error ?? undefined,
          variant: "destructive",
        });
        return;
      }
      toast({ title: t("toast.updated") });
      cancelEdit();
      await load();
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (aff: Affiliate) => {
    setSaving(true);
    try {
      const res = await updateAffiliate(aff.id, { active: !aff.active });
      if (res.error || !res.affiliate) {
        toast({
          title: t("toast.updateFailed"),
          description: res.error ?? undefined,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: aff.active ? t("toast.deactivated") : t("toast.activated"),
      });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const toggleTier = async (aff: Affiliate) => {
    const nextTier: AffiliateTier =
      aff.tier === "reseller" ? "affiliate" : "reseller";
    setSaving(true);
    try {
      const res = await updateAffiliate(aff.id, { tier: nextTier });
      if (res.error || !res.affiliate) {
        toast({
          title: t("toast.updateFailed"),
          description: res.error ?? undefined,
          variant: "destructive",
        });
        return;
      }
      toast({
        title:
          nextTier === "reseller"
            ? t("toast.tierPromoted")
            : t("toast.tierDemoted"),
      });
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.main
      animate={{ opacity: 1 }}
      className="w-full space-y-4"
      initial={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <DashboardPageHeader
        actions={
          <Button
            icon={<ArrowsClockwise className="h-4 w-4" weight="bold" />}
            iconVisible
            onClick={() => void load()}
            title={t("button.refresh")}
            variant="outline"
          />
        }
        badge={t("header.badge")}
        description={t("header.description")}
        icon={<UserCircle className="h-6 w-6" weight="fill" />}
      />

      {/* ROSTER. The three cards here reported active/inactive and left the
          operator to go find them in a filter that did not exist; the banks
          report the same split and select it. */}
      <StatusRail
        activeKey={statusFilter}
        allLabel={t("stats.total")}
        onSelect={setStatusFilter}
        segments={[
          { key: "active", label: t("stats.active"), count: activeCount, tone: "healthy" },
          { key: "inactive", label: t("stats.inactive"), count: inactiveCount, tone: "warning" },
        ]}
      />

      <section
        className="space-y-4 rounded-[--radius] border border-border bg-card p-5"
        style={{ boxShadow: softSurfaceShadow }}
      >
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <MagnifyingGlass
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              weight="bold"
            />
            <input
              className="w-full rounded-[--radius] border border-border bg-background px-10 py-2.5 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-ring/10"
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("filters.searchPlaceholder")}
              type="search"
              value={search}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <CircleNotch
              className="h-8 w-8 animate-spin text-primary-ink"
              weight="bold"
            />
          </div>
        ) : error ? (
          <div className="rounded-[--radius] border border-destructive/30 bg-muted px-4 py-6 text-center text-sm text-destructive-ink">
            {error}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-[--radius] border border-dashed border-border bg-background px-4 py-16 text-center">
            <UserCircle
              className="mx-auto h-10 w-10 text-muted-foreground"
              weight="fill"
            />
            <p className="mt-3 text-sm font-medium text-foreground">
              {t("empty.title")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("empty.description")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[--radius] border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <Th>{t("table.brand")}</Th>
                  <Th>{t("table.code")}</Th>
                  <Th>{t("table.commission")}</Th>
                  <Th>{t("table.tier")}</Th>
                  <Th>{t("table.status")}</Th>
                  <Th className="text-right">{t("table.actions")}</Th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((aff) => {
                  const isEditing = editingId === aff.id;
                  return (
                    <tr
                      key={aff.id}
                      className="border-b border-border last:border-b-0 hover:bg-muted"
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          {aff.brandLogoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              alt=""
                              className="h-6 w-6 rounded-full object-cover"
                              src={aff.brandLogoUrl}
                            />
                          ) : (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground">
                              <UserCircle
                                className="h-3.5 w-3.5"
                                weight="fill"
                              />
                            </div>
                          )}
                          <span className="font-medium text-foreground">
                            {aff.brandName}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                          {aff.code}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <ElevatedInput
                              className="w-24"
                              max="30"
                              min="0"
                              onChange={(e) => setDraftPct(e.target.value)}
                              step="0.1"
                              type="number"
                              value={draftPct}
                            />
                            <span className="text-xs text-muted-foreground">
                              %
                            </span>
                          </div>
                        ) : (
                          <span className="font-medium text-foreground">
                            {(aff.commissionPct * 100).toFixed(2)}%
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {aff.tier === "reseller" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground shadow-sm">
                            <Crown className="h-3 w-3" weight="fill" />
                            {t("tier.reseller")}
                          </span>
                        ) : (
                          <span className="rounded-[--radius] bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                            {t("tier.affiliate")}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            "rounded-[--radius] px-2 py-0.5 text-[11px] font-semibold",
                            aff.active
                              ? "bg-muted text-healthy-ink"
                              : "bg-muted text-warning-ink",
                          )}
                        >
                          {aff.active
                            ? t("status.active")
                            : t("status.inactive")}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {isEditing ? (
                            <>
                              <Button
                                disabled={saving}
                                icon={
                                  saving ? (
                                    <CircleNotch
                                      className="h-3.5 w-3.5 animate-spin"
                                      weight="bold"
                                    />
                                  ) : (
                                    <FloppyDisk
                                      className="h-3.5 w-3.5"
                                      weight="fill"
                                    />
                                  )
                                }
                                iconVisible
                                onClick={() => void saveCommission(aff)}
                                title={t("button.save")}
                              />
                              <Button
                                disabled={saving}
                                onClick={cancelEdit}
                                title={t("button.cancel")}
                                variant="outline"
                              />
                            </>
                          ) : (
                            <>
                              <Button
                                icon={
                                  <PencilSimple
                                    className="h-3.5 w-3.5"
                                    weight="bold"
                                  />
                                }
                                iconVisible
                                onClick={() => startEdit(aff)}
                                title={t("button.edit")}
                                variant="outline"
                              />
                              <Button
                                disabled={saving}
                                onClick={() => void toggleActive(aff)}
                                title={
                                  aff.active
                                    ? t("button.deactivate")
                                    : t("button.activate")
                                }
                                variant="outline"
                              />
                              <Button
                                disabled={saving}
                                icon={
                                  <ArrowsDownUp
                                    className="h-3.5 w-3.5"
                                    weight="bold"
                                  />
                                }
                                iconVisible
                                onClick={() => void toggleTier(aff)}
                                title={
                                  aff.tier === "reseller"
                                    ? t("button.demoteToAffiliate")
                                    : t("button.promoteToReseller")
                                }
                                variant="outline"
                              />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {meta.totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
            <span className="text-xs text-muted-foreground">
              {t("pagination.summary", {
                page: meta.page,
                totalPages: meta.totalPages,
                totalItems: meta.totalItems,
              })}
            </span>
            <div className="flex items-center gap-2">
              <Button
                disabled={loading || page <= 1}
                icon={<CaretLeft className="h-3.5 w-3.5" weight="bold" />}
                iconVisible
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                title={t("pagination.prev")}
                variant="outline"
              />
              <Button
                disabled={loading || page >= meta.totalPages}
                icon={<CaretRight className="h-3.5 w-3.5" weight="bold" />}
                iconVisible
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                title={t("pagination.next")}
                variant="outline"
              />
            </div>
          </div>
        ) : null}
      </section>
    </motion.main>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  );
}

export default function AdminAffiliatesPage() {
  const { user, isLoading } = useAuth();
  const t = useTranslations("adminAffiliates");

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <CircleNotch
          className="h-8 w-8 animate-spin text-primary-ink"
          weight="bold"
        />
      </div>
    );
  }

  if (!isSystemAdmin(user?.role)) {
    return (
      <div className="rounded-[--radius] border border-destructive/30 bg-muted px-4 py-8 text-center text-sm text-destructive-ink">
        {t("forbidden")}
      </div>
    );
  }

  return <AdminAffiliatesTable />;
}
