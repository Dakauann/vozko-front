"use client";

import * as React from "react";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowCounterClockwise,
  Calculator,
  CalendarCheck,
  CircleNotch,
  CurrencyDollar,
  Eye,
  FloppyDisk,
  Gear,
  Lightning,
  Microphone,
  MonitorPlay,
  PencilSimple,
  Phone,
  Scales,
  SpeakerHigh,
  WhatsappLogo,
  X,
} from "@/components/icons";
import type {
} from "@/app/actions/pricing";
import type {
  PricingAuditEntry,
  PricingItem,
  PublicExchangeRate,
} from "@/lib/pricing/types";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/elevated-design/elevated-tabs";
import {
  getDefaultPricingItemsAction,
  getExchangeRateAction,
  getPricingAuditLogAction,
  updateDefaultPricingItemAction,
  updateExchangeRateAction,
} from "@/app/actions/pricing";
import {
  formatPricingServiceFallback,
} from "@/lib/branding/ai-models";
import {
  formatUsdCurrency,
  microsToUsdDisplay,
  parseAmount,
  parseBrlToUsdMicros,
  resolveExchangeRate,
  usdMicrosToBrlInput,
  usdMicrosToBrl,
  formatBrlCurrency,
  microsToUsdNumber,
} from "@/lib/pricing/money";

import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import type { Icon } from "@/components/icons";
import { IconBox } from "@/components/elevated-design/listing-card";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
const CATEGORY_ICONS: Record<string, Icon> = {
  tts: SpeakerHigh,
  stt: Microphone,
  whatsapp: WhatsappLogo,
  telephony: Phone,
  exchange_rate: Scales,
};

// Solid opaque tiles with white glyphs (DESIGN.md symbols rule).
const CATEGORY_TILE: Record<string, string> = {
  tts: "bg-muted text-white",
  stt: "bg-healthy text-white",
  whatsapp: "bg-healthy text-white",
  telephony: "bg-muted text-white",
  exchange_rate: "bg-warning text-white",
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}


export default function AdminPricingPage() {
  const t = useTranslations("adminPricing");
  const { toast } = useToast();

  const [defaults, setDefaults] = React.useState<PricingItem[]>([]);
  const [exchangeRate, setExchangeRate] = React.useState<
    PricingItem | PublicExchangeRate | null
  >(null);
  const [auditLog, setAuditLog] = React.useState<PricingAuditEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState("defaults");

  const [editingId, setEditingId] = React.useState<string | null>(null);
  /** BRL input while editing a default price row. */
  const [editValueBrl, setEditValueBrl] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const rateNumber = React.useMemo(() => {
    if (!exchangeRate) return null;
    return resolveExchangeRate(exchangeRate.priceMicros / 1_000_000);
  }, [exchangeRate]);

  const [editingRate, setEditingRate] = React.useState(false);
  const [rateValue, setRateValue] = React.useState("");
  const [savingRate, setSavingRate] = React.useState(false);

  const [calculating, setCalculating] = React.useState(false);
  const [calcError, setCalcError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [defaultsRes, rateRes, auditRes] = await Promise.all([
        getDefaultPricingItemsAction(),
        getExchangeRateAction(),
        getPricingAuditLogAction(),
      ]);
      if (defaultsRes.error) {
        setError(defaultsRes.error);
        return;
      }
      setDefaults(defaultsRes.items);
      if (!rateRes.error && rateRes.item) setExchangeRate(rateRes.item);
      if (!auditRes.error) setAuditLog(auditRes.entries);
    } catch {
      setError("Failed to load pricing data");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveItem = async (item: PricingItem) => {
    if (rateNumber == null) {
      toast({
        title: t("form.error.exchangeRateRequired"),
        variant: "destructive",
      });
      return;
    }
    const brl = parseAmount(editValueBrl);
    if (brl === null || brl <= 0) {
      toast({ title: t("form.error.invalidPrice"), variant: "destructive" });
      return;
    }
    const newMicros = parseBrlToUsdMicros(editValueBrl, rateNumber);
    if (newMicros <= 0) {
      toast({ title: t("form.error.priceTooSmall"), variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const result = await updateDefaultPricingItemAction({
        category: item.category,
        service: item.service,
        metric: item.metric,
        priceMicros: newMicros,
        currency: item.currency,
      });
      if (result.error) {
        toast({
          title: t("form.error.saveFailed"),
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: t("form.success.saved"),
          description: t("form.success.savedDetail", {
            brl: formatBrlCurrency(brl),
            usd: formatUsdCurrency(microsToUsdNumber(newMicros)),
          }),
        });
        setEditingId(null);
        loadData();
      }
    } catch {
      toast({ title: t("form.error.saveFailed"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRate = async () => {
    const n = parseAmount(rateValue);
    if (n === null || n <= 0) {
      toast({ title: t("form.error.invalidPrice"), variant: "destructive" });
      return;
    }
    const newMicros = Math.round(n * 1_000_000);
    if (newMicros <= 0) {
      toast({ title: t("form.error.invalidPrice"), variant: "destructive" });
      return;
    }
    setSavingRate(true);
    try {
      const result = await updateExchangeRateAction(newMicros);
      if (result.error) {
        toast({
          title: t("form.error.saveFailed"),
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({ title: t("form.success.rateSaved") });
        setEditingRate(false);
        loadData();
      }
    } catch {
      toast({ title: t("form.error.saveFailed"), variant: "destructive" });
    } finally {
      setSavingRate(false);
    }
  };

  const grouped = React.useMemo(() => {
    const map = new Map<string, PricingItem[]>();
    for (const item of defaults) {
      if (item.category === "exchange_rate" || item.category === "llm")
        continue;
      const arr = map.get(item.category) || [];
      arr.push(item);
      map.set(item.category, arr);
    }
    return map;
  }, [defaults]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <CircleNotch
          className="h-8 w-8 animate-spin text-lamp-ink"
          weight="bold"
        />
        <p className="text-sm text-muted-foreground mt-3">{t("loading")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl rounded-[--radius] border border-border bg-card p-12 text-center mt-8 shadow-sm">
        <CurrencyDollar
          className="h-12 w-12 text-red-400 mx-auto mb-4"
          weight="fill"
        />
        <p className="font-semibold text-foreground">{t("error.title")}</p>
        <p className="text-sm text-muted-foreground mt-1">{error}</p>
        <Button
          variant="outline"
          title={t("button.retry")}
          className="mt-4"
          onClick={loadData}
        />
      </div>
    );
  }

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full space-y-4"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <DashboardPageHeader
          icon={<CurrencyDollar className="h-6 w-6" weight="fill" />}
          badge={t("header.badge")}
          description={t("header.title")}
        />
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="defaults" className="gap-2">
              <Gear className="h-4 w-4" weight="fill" />
              <span className="hidden sm:inline">{t("tabs.defaults")}</span>
            </TabsTrigger>
            <TabsTrigger value="exchangeRate" className="gap-2">
              <Scales className="h-4 w-4" weight="fill" />
              <span className="hidden sm:inline">{t("tabs.exchangeRate")}</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2">
              <Eye className="h-4 w-4" weight="fill" />
              <span className="hidden sm:inline">{t("tabs.audit")}</span>
            </TabsTrigger>
          </TabsList>

          {/* ── Defaults Tab ── */}
          <TabsContent value="defaults">
            <div className="space-y-6">
              {rateNumber != null ? (
                <div className="flex flex-col gap-3 rounded-[--radius] border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[--radius] bg-warning text-white">
                      <Scales className="h-5 w-5" weight="fill" />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {t("defaults.rateBannerLabel")}
                      </p>
                      <p className="text-sm font-semibold tabular-nums text-foreground">
                        {t("defaults.rateBannerValue", {
                          rate: microsToUsdDisplay(exchangeRate!.priceMicros),
                        })}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t("defaults.conversionNote")}
                      </p>
                    </div>
                  </div>
                  <button
                    className="text-sm font-medium text-lamp-ink hover:underline"
                    onClick={() => setActiveTab("exchangeRate")}
                    type="button"
                  >
                    {t("defaults.editRateLink")}
                  </button>
                </div>
              ) : (
                <div className="rounded-[--radius] border border-warning/30 bg-card p-4 text-sm text-amber-800">
                  {t("defaults.rateMissing")}
                </div>
              )}

              {Array.from(grouped.entries()).map(([category, items]) => {
                const Icon = CATEGORY_ICONS[category] ?? Lightning;
                const tile =
                  CATEGORY_TILE[category] ?? "bg-muted text-white";
                return (
                  <div
                    key={category}
                    className="rounded-[--radius] border border-border bg-card overflow-hidden shadow-sm"
                  >
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-[--radius] ${tile}`}
                      >
                        <Icon className="h-5 w-5" weight="fill" />
                      </div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {t(`categories.${category}`)}
                      </h3>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="px-6 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                              {t("table.service")}
                            </th>
                            <th className="px-6 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                              {t("table.metric")}
                            </th>
                            <th className="px-6 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-right">
                              {t("table.priceBrl")}
                            </th>
                            <th className="px-4 py-3 w-12" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {items.map((item) => {
                            const isEditing = editingId === item.id;
                            const brlDisplay =
                              rateNumber != null
                                ? formatBrlCurrency(
                                    usdMicrosToBrl(item.priceMicros, rateNumber),
                                  )
                                : null;
                            const usdDisplay = formatUsdCurrency(
                              microsToUsdNumber(item.priceMicros),
                            );
                            return (
                              <tr
                                key={`${item.category}-${item.service}-${item.metric}`}
                                className="transition-colors hover:bg-muted"
                              >
                                <td className="px-6 py-3.5 text-sm font-medium text-foreground">
                                  {(() => {
                                    const translationKey =
                                      `services.${item.category}.${item.service}` as const;
                                    return t.has(translationKey)
                                      ? t(translationKey)
                                      : formatPricingServiceFallback(
                                          item.service,
                                        );
                                  })()}
                                </td>
                                <td className="px-6 py-3.5 text-sm text-muted-foreground">
                                  {t(`metrics.${item.metric}`)}
                                </td>
                                <td className="px-6 py-3.5 text-right">
                                  {isEditing ? (
                                    <div className="flex flex-col items-end gap-1">
                                      <div className="flex items-center justify-end gap-2">
                                        <ElevatedInput
                                          value={editValueBrl}
                                          onChange={(e) =>
                                            setEditValueBrl(e.target.value)
                                          }
                                          type="text"
                                          inputMode="decimal"
                                          min="0"
                                          className="w-36 text-right"
                                          placeholder="0,00"
                                          label={t("table.priceBrl")}
                                        />
                                        <Button
                                          variant="primary"
                                          title=""
                                          icon={
                                            saving ? (
                                              <CircleNotch
                                                className="h-4 w-4 animate-spin"
                                                weight="bold"
                                              />
                                            ) : (
                                              <FloppyDisk
                                                className="h-4 w-4"
                                                weight="fill"
                                              />
                                            )
                                          }
                                          iconVisible
                                          className="!px-2.5"
                                          onClick={() => handleSaveItem(item)}
                                          disabled={saving || rateNumber == null}
                                        />
                                        <Button
                                          variant="outline"
                                          title=""
                                          icon={
                                            <X
                                              className="h-4 w-4"
                                              weight="bold"
                                            />
                                          }
                                          iconVisible
                                          className="!px-2.5"
                                          onClick={() => setEditingId(null)}
                                        />
                                      </div>
                                      {rateNumber != null &&
                                      parseAmount(editValueBrl) != null ? (
                                        <p className="text-[11px] tabular-nums text-muted-foreground">
                                          ≈{" "}
                                          {formatUsdCurrency(
                                            microsToUsdNumber(
                                              parseBrlToUsdMicros(
                                                editValueBrl,
                                                rateNumber,
                                              ),
                                            ),
                                          )}{" "}
                                          {t("defaults.storedAsUsd")}
                                        </p>
                                      ) : null}
                                    </div>
                                  ) : (
                                    <div className="text-right">
                                      <span className="text-sm font-semibold text-foreground tabular-nums">
                                        {brlDisplay ?? usdDisplay}
                                      </span>
                                      {brlDisplay ? (
                                        <p className="text-[11px] tabular-nums text-muted-foreground">
                                          ≈ {usdDisplay}
                                        </p>
                                      ) : null}
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-3.5">
                                  {!isEditing && (
                                    <Button
                                      variant="outline"
                                      title=""
                                      icon={
                                        <PencilSimple
                                          className="h-4 w-4"
                                          weight="bold"
                                        />
                                      }
                                      iconVisible
                                      className="!px-2.5"
                                      disabled={rateNumber == null}
                                      onClick={() => {
                                        if (rateNumber == null) return;
                                        setEditingId(item.id);
                                        setEditValueBrl(
                                          usdMicrosToBrlInput(
                                            item.priceMicros,
                                            rateNumber,
                                          ),
                                        );
                                      }}
                                    />
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* ── Exchange Rate Tab ── */}
          <TabsContent value="exchangeRate">
            <div className="rounded-[--radius] border border-border bg-card p-6 space-y-6 max-w-lg shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-[--radius] bg-warning text-white">
                  <Scales className="h-6 w-6" weight="fill" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {t("exchangeRate.title")}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {t("exchangeRate.description")}
                  </p>
                </div>
              </div>

              {exchangeRate ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                      {t("exchangeRate.currentRate")}
                    </p>
                    <p className="text-2xl font-semibold text-foreground tabular-nums">
                      1 USD = R$ {microsToUsdDisplay(exchangeRate.priceMicros)}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-border">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                      {t("exchangeRate.updatedAt")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate((exchangeRate as PricingItem).updatedAt)}
                    </p>
                  </div>

                  <AnimatePresence>
                    {editingRate ? (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-3 overflow-hidden"
                      >
                        <ElevatedInput
                          label={t("exchangeRate.newRate")}
                          value={rateValue}
                          onChange={(e) => setRateValue(e.target.value)}
                          type="number"
                          step="any"
                          min="0"
                          placeholder="6.00"
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="primary"
                            title={
                              savingRate ? t("button.saving") : t("button.save")
                            }
                            icon={
                              savingRate ? (
                                <CircleNotch
                                  className="h-4 w-4 animate-spin"
                                  weight="bold"
                                />
                              ) : (
                                <FloppyDisk className="h-4 w-4" weight="fill" />
                              )
                            }
                            iconVisible
                            iconSide="left"
                            onClick={handleSaveRate}
                            disabled={savingRate}
                          />
                          <Button
                            variant="outline"
                            title={t("button.cancel")}
                            onClick={() => setEditingRate(false)}
                          />
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <Button
                          variant="outline"
                          title={t("exchangeRate.editRate")}
                          icon={
                            <PencilSimple className="h-4 w-4" weight="bold" />
                          }
                          iconVisible
                          iconSide="left"
                          onClick={() => {
                            setRateValue(
                              microsToUsdDisplay(exchangeRate.priceMicros),
                            );
                            setEditingRate(true);
                          }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="rounded-[--radius] border border-border bg-muted p-3">
                    <p className="text-xs font-medium text-foreground">
                      {t("exchangeRate.warning")}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("exchangeRate.noRate")}
                </p>
              )}
            </div>
          </TabsContent>

          {/* ── Audit Log Tab ── */}
          <TabsContent value="audit">
            <div className="rounded-[--radius] border border-border bg-card overflow-hidden shadow-sm">
              {auditLog.length === 0 ? (
                <div className="p-12 text-center">
                  <Eye
                    className="h-10 w-10 text-muted-foreground mx-auto mb-3"
                    weight="fill"
                  />
                  <p className="text-sm text-muted-foreground">
                    {t("audit.empty")}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {t("audit.date")}
                        </th>
                        <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {t("audit.service")}
                        </th>
                        <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {t("audit.oldPrice")}
                        </th>
                        <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {t("audit.newPrice")}
                        </th>
                        <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {t("audit.changedBy")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      <AnimatePresence mode="popLayout">
                        {auditLog.map((entry, i) => {
                          const Icon =
                            CATEGORY_ICONS[entry.category] ?? Lightning;
                          return (
                            <motion.tr
                              key={entry.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              transition={{
                                duration: 0.2,
                                delay: i * 0.02,
                              }}
                              className="transition-colors hover:bg-muted"
                            >
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <CalendarCheck
                                    className="h-3.5 w-3.5"
                                    weight="fill"
                                  />
                                  {formatDate(entry.changedAt)}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <Icon
                                    className="h-4 w-4 text-muted-foreground"
                                    weight="fill"
                                  />
                                  <div>
                                    <p className="text-sm font-medium text-foreground">
                                      {formatPricingServiceFallback(
                                        entry.service,
                                      )}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {entry.category} · {entry.metric}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="text-sm text-muted-foreground tabular-nums">
                                  {rateNumber != null &&
                                  entry.currency === "USD" ? (
                                    <>
                                      <p>
                                        {formatBrlCurrency(
                                          usdMicrosToBrl(
                                            entry.oldPriceMicros,
                                            rateNumber,
                                          ),
                                        )}
                                      </p>
                                      <p className="text-[11px]">
                                        ≈{" "}
                                        {formatUsdCurrency(
                                          microsToUsdNumber(
                                            entry.oldPriceMicros,
                                          ),
                                        )}
                                      </p>
                                    </>
                                  ) : (
                                    <p>
                                      {entry.currency === "USD" ? "$" : "R$"}{" "}
                                      {microsToUsdDisplay(
                                        entry.oldPriceMicros,
                                      )}
                                    </p>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="text-sm font-semibold text-foreground tabular-nums">
                                  {rateNumber != null &&
                                  entry.currency === "USD" ? (
                                    <>
                                      <p>
                                        {formatBrlCurrency(
                                          usdMicrosToBrl(
                                            entry.newPriceMicros,
                                            rateNumber,
                                          ),
                                        )}
                                      </p>
                                      <p className="text-[11px] font-normal text-muted-foreground">
                                        ≈{" "}
                                        {formatUsdCurrency(
                                          microsToUsdNumber(
                                            entry.newPriceMicros,
                                          ),
                                        )}
                                      </p>
                                    </>
                                  ) : (
                                    <p>
                                      {entry.currency === "USD" ? "$" : "R$"}{" "}
                                      {microsToUsdDisplay(
                                        entry.newPriceMicros,
                                      )}
                                    </p>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-xs text-muted-foreground font-mono">
                                  {entry.changedBy.slice(0, 8)}...
                                </span>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              )}

              {auditLog.length > 0 && (
                <div className="border-t border-border px-6 py-3 flex justify-end">
                  <Button
                    variant="outline"
                    title={t("audit.loadMore")}
                    icon={
                      <ArrowCounterClockwise
                        className="h-4 w-4"
                        weight="bold"
                      />
                    }
                    iconVisible
                    iconSide="left"
                    onClick={async () => {
                      const res = await getPricingAuditLogAction(
                        50,
                        auditLog.length,
                      );
                      if (!res.error && res.entries.length > 0) {
                        setAuditLog((prev) => [...prev, ...res.entries]);
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </TabsContent>
          {/* ── Calculator Tab ── */}
        </Tabs>
      </motion.div>
    </motion.main>
  );
}


function CalculatorSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[--radius] border border-border bg-card overflow-hidden shadow-sm">
      <div className="px-5 py-3 border-b border-border">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </h4>
      </div>
      <div className="p-5 grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function CalcField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function ResultCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[--radius] border border-border bg-card overflow-hidden shadow-sm">
      <div className="px-5 py-3 border-b border-border">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </h4>
      </div>
      <div className="divide-y divide-border/30">{children}</div>
    </div>
  );
}

function ResultRow({
  label,
  value,
  bold,
  color,
}: {
  label: string;
  value: string;
  bold?: boolean;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`text-sm tabular-nums ${bold ? "font-semibold" : "font-medium"} ${color ?? "text-foreground"}`}
      >
        {value}
      </span>
    </div>
  );
}
