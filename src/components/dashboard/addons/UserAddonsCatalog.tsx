"use client";

import * as React from "react";

import { useTranslations } from "next-intl";

import {
  ArrowsClockwise,
  CheckCircle,
  CircleNotch,
  Minus,
  Package,
  Phone,
  Plus,
  PuzzlePiece,
  ShieldCheck,
  DeviceMobile,
  WhatsappLogo,
} from "@/components/icons";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import {
  cancelAddonSubscriptionAction,
  getWorkspaceEntitlementsAction,
  listAvailableAddonsAction,
  listWorkspaceAddonsAction,
  previewAddonPurchaseAction,
  purchaseAddonAction,
} from "@/app/actions/addons";
import { getExchangeRateAction } from "@/app/actions/pricing";
import type {
  AddonBillingCycle,
  AddonDefinition,
  AddonEntitlementKind,
  AddonPurchasePreview,
  AddonSubscription,
  WorkspaceEntitlement,
} from "@/lib/workspace-addon/types";

import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { cn } from "@/lib/utils";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/contexts/workspace-context";

/**
 * VoIP is no longer sold, so call-channel addons and the entitlement they grant
 * never reach the catalogue, the active list or the capacity readouts — the API
 * may still return rows created before the feature was withdrawn.
 */
const RETIRED_KINDS = new Set<AddonEntitlementKind>(["call_channels"]);

const KIND_TILE: Record<AddonEntitlementKind, string> = {
  call_channels: "bg-muted",
  whatsapp_business_phones: "bg-healthy",
  // Neutral rather than WhatsApp green: the network is the same, the transport
  // is not, and the two must be distinguishable at a glance in a list where a
  // workspace may hold both.
  unofficial_whatsapp_instances: "bg-chart-4",
};

function KindGlyph({
  kind,
  className,
}: {
  kind: AddonEntitlementKind;
  className?: string;
}) {
  switch (kind) {
    case "whatsapp_business_phones":
      return <WhatsappLogo className={className} weight="fill" />;
    case "unofficial_whatsapp_instances":
      return <DeviceMobile className={className} weight="fill" />;
    default:
      return <Phone className={className} weight="fill" />;
  }
}

function priceMicros(addon: AddonDefinition, cycle: AddonBillingCycle): number {
  return cycle === "annual" ? addon.annualPriceMicros : addon.monthlyPriceMicros;
}

function formatBRL(micros: number, rate: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((micros / 1_000_000) * rate);
}

const PANEL = "rounded-[--radius] border border-border bg-card";
const EMPTY_STATE =
  "mx-auto mt-8 max-w-2xl rounded-[--radius] border border-border bg-card p-12 text-center";

export default function UserAddonsCatalog() {
  const t = useTranslations("addonsPage");
  const { toast } = useToast();
  const { currentWorkspace, can, permissionsLoading } = useWorkspace();

  const kindLabel = React.useCallback(
    (kind: AddonEntitlementKind) => {
      switch (kind) {
        case "whatsapp_business_phones":
          return t("kind.whatsappPhones");
        case "unofficial_whatsapp_instances":
          return t("kind.unofficialWhatsapp");
        default:
          return t("kind.callChannels");
      }
    },
    [t],
  );

  const [available, setAvailable] = React.useState<AddonDefinition[]>([]);
  const [active, setActive] = React.useState<AddonSubscription[]>([]);
  const [entitlements, setEntitlements] = React.useState<WorkspaceEntitlement[]>([]);
  const [cycle, setCycle] = React.useState<AddonBillingCycle>("monthly");
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const [selected, setSelected] = React.useState<AddonDefinition | null>(null);
  const [quantity, setQuantity] = React.useState(1);
  const [purchasing, setPurchasing] = React.useState(false);
  const [rate, setRate] = React.useState(6);
  const [preview, setPreview] = React.useState<AddonPurchasePreview | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);

  const canRead = can("plans", "read");
  const canBuy = can("plans", "create");
  const workspaceId = currentWorkspace?.id ?? null;

  const load = React.useCallback(async () => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [avail, subs, ents, ex] = await Promise.all([
      listAvailableAddonsAction(workspaceId),
      listWorkspaceAddonsAction(workspaceId),
      getWorkspaceEntitlementsAction(workspaceId),
      getExchangeRateAction(),
    ]);
    setAvailable(
      avail.addons.filter((a) => !RETIRED_KINDS.has(a.entitlementKind)),
    );
    setActive(
      subs.subscriptions.filter((s) => !RETIRED_KINDS.has(s.entitlementKind)),
    );
    setEntitlements(
      ents.entitlements.filter((e) => !RETIRED_KINDS.has(e.kind)),
    );
    if (ex.item && ex.item.priceMicros > 0) {
      setRate(ex.item.priceMicros / 1_000_000);
    }
    setLoading(false);
  }, [workspaceId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Fetch the exact "you pay now" quote from the backend whenever the dialog selection, cycle, or
  // quantity changes, so the customer sees the prorated amount before confirming. The same math drives
  // the actual charge, so the quote is authoritative (never recomputed on the client).
  React.useEffect(() => {
    if (!selected || !workspaceId) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    void previewAddonPurchaseAction(workspaceId, {
      addonDefinitionId: selected.id,
      quantity,
      billingCycle: cycle,
    }).then((result) => {
      if (cancelled) return;
      setPreview(result.preview);
      setPreviewLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selected, workspaceId, cycle, quantity]);

  function openPurchase(addon: AddonDefinition) {
    setSelected(addon);
    setQuantity(1);
  }

  async function confirmPurchase() {
    if (!selected || !workspaceId) return;
    setPurchasing(true);
    const result = await purchaseAddonAction(workspaceId, {
      addonDefinitionId: selected.id,
      quantity,
      billingCycle: cycle,
    });
    setPurchasing(false);

    if (result.insufficientBalance) {
      toast({
        title: t("toast.insufficientTitle"),
        description: t("toast.insufficientDescription"),
        variant: "destructive",
      });
      return;
    }
    if (result.error || !result.subscription) {
      toast({
        title: t("toast.purchaseFailedTitle"),
        description: result.error ?? "",
        variant: "destructive",
      });
      return;
    }
    setSelected(null);
    toast({
      title: t("toast.activatedTitle"),
      description: t("toast.activatedDescription", { name: selected.name }),
    });
    void load();
  }

  async function cancel(sub: AddonSubscription) {
    if (!workspaceId) return;
    setBusyId(sub.id);
    const result = await cancelAddonSubscriptionAction(workspaceId, sub.id);
    setBusyId(null);
    if (result.error) {
      toast({
        title: t("toast.cancelFailedTitle"),
        description: result.error,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: t("toast.cancelledTitle"),
      description: t("toast.cancelledDescription"),
    });
    void load();
  }

  if (loading || permissionsLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <CircleNotch className="h-8 w-8 animate-spin text-primary-ink" weight="bold" />
        <p className="mt-3 text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (!currentWorkspace) {
    return (
      <div className={EMPTY_STATE} style={{ boxShadow: softSurfaceShadow }}>
        <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground" weight="fill" />
        <p className="font-semibold text-foreground">{t("emptyWorkspace.title")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("emptyWorkspace.description")}</p>
      </div>
    );
  }

  if (!canRead) {
    return (
      <div className={EMPTY_STATE} style={{ boxShadow: softSurfaceShadow }}>
        <ShieldCheck className="mx-auto mb-4 h-12 w-12 text-warning-ink" weight="fill" />
        <p className="font-semibold text-foreground">{t("noAccess.title")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("noAccess.description")}</p>
      </div>
    );
  }

  const selectedUnit = selected ? priceMicros(selected, cycle) : 0;
  const activeCount = active.reduce((n, s) => n + s.quantity, 0);

  const stats = [
    ...entitlements.map((ent) => ({
      key: ent.kind as string,
      label: kindLabel(ent.kind),
      value: String(ent.total),
      helper: t("stats.entitlementHelper", {
        planBase: ent.planBase,
        addonUnits: ent.addonUnits,
      }),
      tile: KIND_TILE[ent.kind],
      glyph: <KindGlyph kind={ent.kind} className="h-4 w-4" />,
    })),
    {
      key: "active",
      label: t("stats.activeAddons"),
      value: String(activeCount),
      helper: t("stats.subscriptionCount", { count: activeCount }),
      tile: "tile-warning",
      glyph: <PuzzlePiece className="h-4 w-4" weight="fill" />,
    },
  ];

  return (
    <>
      <main className="w-full space-y-4">
        <DashboardPageHeader
          icon={<PuzzlePiece className="h-6 w-6" weight="fill" />}
          badge={t("header.badge")}
          description={t("header.description")}
          actions={
            <Button
              icon={<ArrowsClockwise className="h-4 w-4" weight="bold" />}
              iconVisible
              onClick={() => void load()}
              title={t("header.refresh")}
              variant="outline"
            />
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.key}
              className={cn(PANEL, "p-5")}
              style={{ boxShadow: softSurfaceShadow }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-2xs font-semibold text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="mt-2 truncate font-display text-2xl font-semibold text-foreground">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{stat.helper}</p>
                </div>
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-[--radius]",
                    stat.tile,
                  )}
                >
                  {stat.glyph}
                </div>
              </div>
            </div>
          ))}
        </div>

        <section className={cn(PANEL, "space-y-4 p-5")} style={{ boxShadow: softSurfaceShadow }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{t("catalog.title")}</p>
              <p className="text-xs text-muted-foreground">{t("catalog.subtitle")}</p>
            </div>
            <div className="inline-flex rounded-lg border border-border bg-background p-1">
              {(["monthly", "annual"] as AddonBillingCycle[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCycle(c)}
                  className={cn(
                    "rounded-[--radius] px-4 py-1.5 text-xs font-semibold transition-colors",
                    cycle === c
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c === "monthly" ? t("catalog.monthly") : t("catalog.annual")}
                </button>
              ))}
            </div>
          </div>

          {available.length === 0 ? (
            <div className="rounded-[--radius] border border-dashed border-border bg-background px-4 py-12 text-center">
              <PuzzlePiece className="mx-auto h-8 w-8 text-muted-foreground" weight="fill" />
              <p className="mt-3 text-sm font-medium text-foreground">{t("catalog.emptyTitle")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("catalog.emptyDescription")}</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {available.map((addon) => (
                <div
                  key={addon.id}
                  className="flex flex-col rounded-[--radius] border border-border bg-background p-5 transition-colors hover:border-primary/30"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[--radius] bg-primary text-primary-foreground">
                      <KindGlyph kind={addon.entitlementKind} className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {addon.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("catalog.unitsSuffix", {
                          units: addon.unitsPerQuantity,
                          kind: kindLabel(addon.entitlementKind).toLowerCase(),
                        })}
                      </p>
                    </div>
                  </div>
                  {addon.description && (
                    <p className="mt-3 line-clamp-2 flex-1 text-xs text-muted-foreground">
                      {addon.description}
                    </p>
                  )}
                  <div className="mt-4 flex items-end justify-between gap-2">
                    <div>
                      <span className="font-display text-xl font-semibold text-foreground">
                        {formatBRL(priceMicros(addon, cycle), rate)}
                      </span>
                      <span className="ml-1 text-2xs text-muted-foreground">
                        /{cycle === "annual" ? t("catalog.perYear") : t("catalog.perMonth")}
                      </span>
                    </div>
                    <Button
                      onClick={() => openPurchase(addon)}
                      disabled={!canBuy}
                      size="sm"
                      title={t("catalog.buy")}
                      variant="primary"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {active.length > 0 && (
          <section className={cn(PANEL, "space-y-3 p-5")} style={{ boxShadow: softSurfaceShadow }}>
            <p className="text-sm font-semibold text-foreground">{t("active.title")}</p>
            <div className="space-y-2">
              {active.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between gap-3 rounded-[--radius] border border-border bg-background p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <KindGlyph kind={sub.entitlementKind} className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {kindLabel(sub.entitlementKind)}
                        <span className="text-muted-foreground"> ×{sub.quantity}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatBRL(sub.unitPriceMicros * sub.quantity, rate)} /{" "}
                        {sub.billingCycle === "annual" ? t("catalog.perYear") : t("catalog.perMonth")}
                      </p>
                    </div>
                  </div>
                  {sub.cancelledAt ? (
                    <span className="rounded-full bg-warning px-2.5 py-1 text-2xs font-semibold text-warning-foreground">
                      {t("active.cancelled")}
                    </span>
                  ) : (
                    canBuy && (
                      <Button
                        disabled={busyId === sub.id}
                        onClick={() => cancel(sub)}
                        size="sm"
                        title={t("active.cancel")}
                        variant="ghost"
                      />
                    )
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <ElevatedDialog open={selected != null} onOpenChange={(o) => !o && setSelected(null)}>
        <ElevatedDialogContent className="max-w-md">
          <ElevatedDialogHeader>
            <ElevatedDialogTitle>{t("purchase.title")}</ElevatedDialogTitle>
            <ElevatedDialogDescription>{t("purchase.description")}</ElevatedDialogDescription>
          </ElevatedDialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-[--radius] border border-border bg-background p-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[--radius] bg-primary text-primary-foreground">
                  <KindGlyph kind={selected.entitlementKind} className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{selected.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {cycle === "annual" ? t("catalog.annual") : t("catalog.monthly")} ·{" "}
                    {formatBRL(selectedUnit, rate)} / {t("purchase.unitSuffix")}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("purchase.quantity")}</span>
                <div className="inline-flex items-center gap-3">
                  <button
                    type="button"
                    aria-label={t("purchase.decrease")}
                    className="flex size-8 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-muted disabled:opacity-40"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold text-foreground">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    aria-label={t("purchase.increase")}
                    className="flex size-8 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-muted"
                    onClick={() => setQuantity((q) => q + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Exact charge from the backend preview: what is debited from saldo now (prorated for a
                  new monthly channel) vs the recurring amount on the day-23 invoice. Same math as the
                  charge, so it is authoritative. Falls back to the full price while the quote loads. */}
              <div className="space-y-2 rounded-[--radius] border border-border bg-background p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{t("purchase.payNow")}</span>
                  <span className="font-display text-lg font-semibold text-primary-ink tabular-nums">
                    {previewLoading || !preview
                      ? formatBRL(selectedUnit * quantity, rate)
                      : formatBRL(preview.chargeNowMicros, rate)}
                  </span>
                </div>
                {preview?.prorated && (
                  <p className="text-2xs leading-relaxed text-muted-foreground">
                    {t("purchase.proratedNote", { days: preview.proratedDays })}
                  </p>
                )}
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span className="text-xs text-muted-foreground">
                    {cycle === "annual" ? t("purchase.thenAnnual") : t("purchase.thenMonthly")}
                  </span>
                  <span className="text-sm font-medium text-foreground tabular-nums">
                    {formatBRL(preview?.recurringMicros ?? selectedUnit * quantity, rate)}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => setSelected(null)}
                  title={t("purchase.cancel")}
                  variant="outline-subtle"
                />
                <Button
                  className="flex-1"
                  disabled={purchasing}
                  icon={
                    purchasing ? (
                      <CircleNotch className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" weight="fill" />
                    )
                  }
                  iconVisible
                  onClick={confirmPurchase}
                  title={t("purchase.confirm")}
                  variant="primary"
                />
              </div>
            </div>
          )}
        </ElevatedDialogContent>
      </ElevatedDialog>
    </>
  );
}
