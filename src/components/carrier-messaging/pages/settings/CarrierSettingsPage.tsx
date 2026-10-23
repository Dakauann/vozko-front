"use client";

import { motion } from "framer-motion";
import { useCallback, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { getCarrierSettingsAction, saveCarrierSettingsAction } from "@/app/actions/carrier-messaging";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { PanelSection } from "@/components/dashboard/PanelSection";
import { CompactWorkingHoursEditor } from "@/components/dashboard/working-hours/WorkingHoursEditor";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { CircleNotch, FloppyDisk, SlidersHorizontal } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import type { CodedRefusal } from "@/lib/api/coded-error";
import { ATTRIBUTION_DAYS, type CarrierSettings } from "@/lib/carrier-messaging/settings";
import { useCarrierRefusalText } from "@/components/carrier-messaging/shared/use-carrier-error-text";

import { useLoaded } from "@/lib/carrier-messaging/use-loaded";

function wholeNumber(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function SettingsForm({ initial, onSaved }: { initial: CarrierSettings; onSaved: (settings: CarrierSettings) => void }) {
  const t = useTranslations("carrierMessaging.pages.settings");
  const refusalText = useCarrierRefusalText();
  const [draft, setDraft] = useState<CarrierSettings>(initial);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<CodedRefusal | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  const save = async () => {
    setBusy(true);
    const answer = await saveCarrierSettingsAction(draft);
    setBusy(false);
    if (answer.error) {
      setRefusal(answer.error);
      return;
    }
    setRefusal(null);
    setDraft(answer.data);
    onSaved(answer.data);
    toast.success(t("saved"));
  };

  const cap = draft.frequency_cap;

  return (
    <div className="space-y-8">
      {refusal ? (
        <Notice tone="fault" title={t("refusedTitle")}>
          <p>{refusalText(refusal)}</p>
        </Notice>
      ) : null}

      <PanelSection title={t("quietHours.title")} description={t("quietHours.description")}>
        <div className="space-y-2">
          <CompactWorkingHoursEditor
            value={draft.quiet_hours}
            onChange={(next) => setDraft((current) => ({ ...current, quiet_hours: { ...next, ...(current.quiet_hours.holidays ? { holidays: current.quiet_hours.holidays } : {}) } }))}
            disabled={busy}
          />
          <p className="text-xs text-muted-foreground">{t("quietHours.hint")}</p>
        </div>
      </PanelSection>

      <PanelSection title={t("frequencyCap.title")} description={t("frequencyCap.description")}>
        <div className="grid max-w-md gap-4 sm:grid-cols-2">
          <ElevatedInput
            label={t("frequencyCap.perDay")}
            type="number"
            min={1}
            inputMode="numeric"
            value={cap.per_day}
            onChange={(event) => setDraft((current) => ({ ...current, frequency_cap: { ...current.frequency_cap, per_day: wholeNumber(event.target.value) } }))}
            disabled={busy}
          />
          <ElevatedInput
            label={t("frequencyCap.perWeek")}
            type="number"
            min={1}
            inputMode="numeric"
            value={cap.per_week}
            onChange={(event) => setDraft((current) => ({ ...current, frequency_cap: { ...current.frequency_cap, per_week: wholeNumber(event.target.value) } }))}
            disabled={busy}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("frequencyCap.hint")}</p>
      </PanelSection>

      <PanelSection title={t("attribution.title")} description={t("attribution.description")}>
        <div className="max-w-[12rem]">
          <ElevatedInput
            label={t("attribution.days")}
            type="number"
            min={1}
            max={ATTRIBUTION_DAYS.max}
            inputMode="numeric"
            value={draft.attribution_days}
            onChange={(event) => setDraft((current) => ({ ...current, attribution_days: wholeNumber(event.target.value) }))}
            disabled={busy}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("attribution.hint", { max: ATTRIBUTION_DAYS.max })}</p>
      </PanelSection>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-5">
        {dirty ? <span className="text-xs text-muted-foreground">{t("unsaved")}</span> : null}
        <Button variant="ghost" title={t("discard")} onClick={() => setDraft(initial)} disabled={!dirty || busy} />
        <Button title={t("save")} icon={busy ? <CircleNotch className="h-4 w-4 animate-spin" /> : <FloppyDisk className="h-4 w-4" />} iconVisible onClick={() => void save()} disabled={!dirty || busy} />
      </div>
    </div>
  );
}

export function CarrierSettingsPage({ headerActions }: { headerActions?: ReactNode } = {}) {
  const t = useTranslations("carrierMessaging.pages.settings");
  const refusalText = useCarrierRefusalText();
  const load = useCallback((signal: AbortSignal) => getCarrierSettingsAction(signal), []);
  const settings = useLoaded(load);
  const [version, setVersion] = useState(0);

  return (
    <motion.main className="w-full space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <DashboardPageHeader icon={<SlidersHorizontal className="h-6 w-6" />} badge={t("header.badge")} description={t("header.description")} actions={headerActions} />
      {settings.status === "loading" ? <p className="text-sm text-muted-foreground">{t("loading")}</p> : null}
      {settings.status === "failed" ? (
        <Notice tone="fault" title={t("failedTitle")}>
          <div className="flex flex-wrap items-center gap-3">
            <p>{refusalText(settings.error)}</p>
            <Button variant="secondary" size="sm" title={t("retry")} onClick={settings.reload} />
          </div>
        </Notice>
      ) : null}
      {settings.status === "ready" ? (
        <SettingsForm
          key={version}
          initial={settings.data}
          onSaved={(saved) => {
            settings.update(() => saved);
            setVersion((current) => current + 1);
          }}
        />
      ) : null}
    </motion.main>
  );
}
