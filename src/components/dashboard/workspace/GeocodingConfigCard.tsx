"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { MapPin } from "@/components/icons";
import { ScreenLoader } from "@/components/brand/screen-loader";
import { Meter } from "@/components/charts/vozko";
import { SectionState } from "@/components/dashboard/attendance/section-state";
import { ChangeStampText } from "@/components/dashboard/workspace/ChangeStampText";
import { ConfigCardShell, type ConfigCardStatusTone } from "@/components/dashboard/workspace/ConfigCardShell";
import { SettingSwitchRow } from "@/components/dashboard/workspace/SettingSwitchRow";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Notice } from "@/components/ui/notice";
import { useGeocodingProviderName } from "@/hooks/use-geocoding-provider-name";
import { useChangeGeocodingSettings, useGeocodingSettings } from "@/hooks/use-geocoding-settings";
import { codedErrorMessage } from "@/lib/api/coded-error";
import {
  geocodingCeilingStamp,
  geocodingProviderStamp,
  geocodingUsage,
  providerMissing,
  providerToEnable,
  readCeilingInput,
  type GeocodingChange,
  type GeocodingProviderPause,
  type GeocodingSettings,
} from "@/lib/workspace/workspace-config/geocoding";

type StatusKey =
  | "loading"
  | "unavailable"
  | "reference"
  | "provider"
  | "providerMissing"
  | "providerPaused"
  | "providerPauseUnknown"
  | "ceilingReached"
  | "noCeiling";

function geocodingStatus(settings: GeocodingSettings | null, failed: boolean): { key: StatusKey; tone: ConfigCardStatusTone } {
  if (failed) return { key: "unavailable", tone: "inactive" };
  if (!settings) return { key: "loading", tone: "inactive" };
  if (settings.providerPause?.state === "paused") return { key: "providerPaused", tone: "warning" };
  if (settings.providerPause?.state === "unknown") return { key: "providerPauseUnknown", tone: "warning" };
  const usage = geocodingUsage(settings);
  if (usage.state === "off") return { key: "reference", tone: "inactive" };
  if (providerMissing(settings)) return { key: "providerMissing", tone: "warning" };
  if (usage.state === "none") return { key: "noCeiling", tone: "warning" };
  if (usage.state === "reached") return { key: "ceilingReached", tone: "warning" };
  return { key: "provider", tone: "active" };
}

export function GeocodingConfigCard({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("workspaceSettings.geocoding");
  const [open, setOpen] = React.useState(false);
  const query = useGeocodingSettings(workspaceId);
  const settings = query.data ?? null;
  const status = geocodingStatus(settings, query.isError);

  return (
    <ConfigCardShell
      open={open}
      onToggle={() => setOpen((value) => !value)}
      icon={<MapPin weight="fill" className="h-4.5 w-4.5" />}
      title={t("title")}
      description={t("description")}
      statusLabel={t(`status.${status.key}`)}
      statusTone={status.tone}
    >
      <SectionState query={query} message={t("loadFailed")}>
        {settings ? (
          <GeocodingForm workspaceId={workspaceId} settings={settings} />
        ) : (
          <ScreenLoader fit="fill" label={t("loading")} className="min-h-24" />
        )}
      </SectionState>
    </ConfigCardShell>
  );
}

function GeocodingForm({ workspaceId, settings }: { workspaceId: string; settings: GeocodingSettings }) {
  const t = useTranslations("workspaceSettings.geocoding");
  const change = useChangeGeocodingSettings(workspaceId);
  const providerName = useGeocodingProviderName();
  const [saving, setSaving] = React.useState(false);
  const [confirming, setConfirming] = React.useState<string | null>(null);
  const readOnlyId = React.useId();

  const apply = async (next: GeocodingChange) => {
    setSaving(true);
    try {
      const error = await change(next);
      if (error) {
        toast.error(t("saveFailed"), { description: codedErrorMessage(t, error, t("errors.unknown")) });
        return false;
      }
      toast.success(t("saved"));
      return true;
    } finally {
      setSaving(false);
    }
  };

  const candidate = providerToEnable(settings);
  const shownProvider = settings.enabled ? settings.provider : candidate;
  const nothingToEnable = !settings.enabled && candidate === null;
  const unreachable = nothingToEnable || providerMissing(settings);
  const label = shownProvider ? t("provider.label", { provider: providerName(shownProvider) }) : t("provider.labelNone");

  const toggle = (on: boolean) => {
    if (!on) {
      void apply({ provider: "" });
      return;
    }
    if (candidate) setConfirming(candidate);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1 rounded-[--radius] border border-border px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-foreground">{t("reference.label")}</p>
          <p className="text-sm text-foreground">{settings.attribution}</p>
        </div>
        <p className="text-xs text-muted-foreground">{t("reference.hint")}</p>
      </div>

      {settings.providerPause ? <ProviderPauseNotice pause={settings.providerPause} /> : null}

      {!settings.canChangeProvider ? (
        <p id={readOnlyId} className="text-xs text-muted-foreground">
          {t("provider.readOnly")}
        </p>
      ) : null}

      <SettingSwitchRow
        label={label}
        hint={t("provider.hint")}
        checked={settings.enabled}
        disabled={!settings.canChangeProvider || saving || nothingToEnable}
        describedBy={settings.canChangeProvider ? undefined : readOnlyId}
        reason={unreachable ? t("provider.notConfigured") : undefined}
        onCheckedChange={toggle}
        stamp={
          <ChangeStampText
            stamp={geocodingProviderStamp(settings)}
            never={t("provider.never")}
            message={(values) => t.rich(settings.enabled ? "provider.stamp.on" : "provider.stamp.off", values)}
          />
        }
      >
        <GeocodingUsagePanel settings={settings} saving={saving} onCeiling={(monthlyCeiling) => apply({ monthlyCeiling })} />
      </SettingSwitchRow>

      {confirming ? (
        <ConfirmDialog
          open
          onOpenChange={(next) => {
            if (!next) setConfirming(null);
          }}
          title={t("confirm.enable.title")}
          description={t("confirm.enable.description", { provider: providerName(confirming) })}
          confirmLabel={t("confirm.enable.confirm")}
          cancelLabel={t("confirm.cancel")}
          tone="default"
          onConfirm={() => apply({ provider: confirming })}
        />
      ) : null}
    </div>
  );
}

function ProviderPauseNotice({ pause }: { pause: GeocodingProviderPause }) {
  const t = useTranslations("workspaceSettings.geocoding.pause");
  const format = useFormatter();
  const instant = (text: string) => format.dateTime(new Date(text), { dateStyle: "short", timeStyle: "short" });
  const paused = pause.state === "paused";

  return (
    <Notice tone="warning" title={paused ? t("title") : t("unknownTitle")}>
      {paused ? (
        <>
          <p>{t(`reasons.${pause.reason}`)}</p>
          <p className="tabular-nums">{t("since", { since: instant(pause.since) })}</p>
          <p className="tabular-nums">{t("until", { until: instant(pause.until) })}</p>
        </>
      ) : (
        <p>{t("unknown")}</p>
      )}
      <p>{t("reference")}</p>
    </Notice>
  );
}

function GeocodingUsagePanel({
  settings,
  saving,
  onCeiling,
}: {
  settings: GeocodingSettings;
  saving: boolean;
  onCeiling: (ceiling: number) => Promise<boolean>;
}) {
  const t = useTranslations("workspaceSettings.geocoding");
  const format = useFormatter();
  const usage = geocodingUsage(settings);

  if (usage.state === "off") return <p className="text-xs text-muted-foreground">{t("usage.off")}</p>;

  const renews = settings.nextCycleStart ? new Date(settings.nextCycleStart) : null;

  return (
    <div className="space-y-3 border-t border-border pt-3">
      {usage.state === "none" ? (
        <p className="text-xs text-muted-foreground">{t("usage.none")}</p>
      ) : (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
            <span className="font-medium text-foreground">{t("usage.title")}</span>
            <span className="tabular-nums text-foreground">{t("usage.count", { used: settings.usedThisCycle, ceiling: settings.monthlyCeiling })}</span>
          </div>
          <Meter
            value={usage.percent ?? 0}
            label={t("usage.title")}
            color={usage.state === "reached" ? "hsl(var(--warning))" : "hsl(var(--muted-foreground))"}
          />
          <div className="flex flex-wrap justify-between gap-2 text-2xs text-muted-foreground">
            <span className="tabular-nums">{t("usage.today", { used: settings.usedToday, share: settings.dailyShare })}</span>
            {renews ? <span>{t("usage.renews", { date: format.dateTime(renews, { dateStyle: "short" }) })}</span> : null}
          </div>
          {usage.state === "reached" ? <Notice tone="warning">{t("usage.reached")}</Notice> : null}
          {usage.state === "todayReached" ? <Notice tone="warning">{t("usage.todayReached")}</Notice> : null}
        </div>
      )}
      <CeilingField settings={settings} saving={saving} onSave={onCeiling} />
    </div>
  );
}

function CeilingField({
  settings,
  saving,
  onSave,
}: {
  settings: GeocodingSettings;
  saving: boolean;
  onSave: (ceiling: number) => Promise<boolean>;
}) {
  const t = useTranslations("workspaceSettings.geocoding");
  const [draft, setDraft] = React.useState(String(settings.monthlyCeiling));
  const [stored, setStored] = React.useState(settings.monthlyCeiling);
  const hintId = React.useId();
  if (stored !== settings.monthlyCeiling) {
    setStored(settings.monthlyCeiling);
    setDraft(String(settings.monthlyCeiling));
  }

  const stamp = <ChangeStampText stamp={geocodingCeilingStamp(settings)} message={(values) => t.rich("ceiling.stamp", values)} />;

  if (!settings.canChangeCeiling) {
    return (
      <div className="space-y-0.5">
        <p className="text-xs text-muted-foreground">{t("ceiling.readOnly")}</p>
        {stamp}
      </div>
    );
  }

  const value = readCeilingInput(draft);
  const invalid = value === null;
  const unchanged = value === settings.monthlyCeiling;

  return (
    <form
      className="space-y-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        if (value === null || unchanged) return;
        void onSave(value);
      }}
    >
      <div className="flex flex-wrap items-start gap-2">
        <ElevatedInput
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          controlSize="sm"
          label={t("ceiling.label")}
          error={invalid ? t("ceiling.invalid") : undefined}
          aria-describedby={invalid ? undefined : hintId}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="w-60 max-w-full"
          inputClassName="tabular-nums"
        />
        <Button type="submit" variant="secondary" size="default" className="mt-1" title={t("ceiling.save")} disabled={saving || invalid || unchanged} />
      </div>
      {invalid ? null : (
        <p id={hintId} className="text-2xs text-muted-foreground">
          {t("ceiling.hint")}
        </p>
      )}
      {stamp}
    </form>
  );
}
