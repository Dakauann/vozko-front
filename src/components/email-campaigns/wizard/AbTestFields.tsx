"use client";

import { useTranslations } from "next-intl";

import { SegmentBar } from "@/components/charts/vozko";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { ElevatedSwitch } from "@/components/elevated-design/elevated-switch";
import { ExplainerHint } from "@/components/explainers/ExplainerHint";
import { CursorClick, Eye, TestTube } from "@/components/icons";
import { Slider } from "@/components/ui/slider";
import { MAX_SUBJECT_RUNES } from "@/lib/email-design/limits";
import type { CustomField } from "@/lib/email-design/merge-tags";
import { AB_DECIDE_CHOICES, AB_TEST_PERCENT, type ABDraft } from "@/lib/email-campaigns/draft";
import type { WinnerMetric } from "@/lib/email-campaigns/types";

import { EMAIL_SERIES_COLOR } from "../shared";
import { SubjectField } from "./SubjectField";

export function useWindowLabel() {
  const t = useTranslations("emailCampaigns.abTest");
  return (minutes: number) => (minutes < 60 ? t("window.minutes", { count: minutes }) : t("window.hours", { count: minutes / 60 }));
}

export function AbTestFields({
  value,
  onChange,
  customFields,
  disabled,
}: {
  value: ABDraft;
  onChange: (next: ABDraft) => void;
  customFields: readonly CustomField[];
  disabled?: boolean;
}) {
  const t = useTranslations("emailCampaigns.abTest");
  const windowLabel = useWindowLabel();
  const half = value.testPercent / 2;
  const rest = 100 - value.testPercent;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <TestTube className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              {t("title")}
              <ExplainerHint id="emailCampaigns.abTest" />
            </p>
            <p className="text-2xs text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>
        <ElevatedSwitch
          checked={value.enabled}
          disabled={disabled}
          onCheckedChange={(checked) => onChange({ ...value, enabled: checked })}
          aria-label={t("toggle")}
        />
      </div>

      {value.enabled ? (
        <div className="space-y-5 border-t border-border px-4 py-4">
          <SubjectField
            label={t("variantB")}
            value={value.variantBSubject}
            onChange={(variantBSubject) => onChange({ ...value, variantBSubject })}
            limit={MAX_SUBJECT_RUNES}
            customFields={customFields}
            disabled={disabled}
          />

          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto_auto]">
            <div className="min-w-0 space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="legend">{t("share")}</span>
                <span className="readout text-sm font-semibold text-foreground">{t("sharePercent", { percent: value.testPercent })}</span>
              </div>
              <Slider
                min={AB_TEST_PERCENT.min}
                max={AB_TEST_PERCENT.max}
                step={AB_TEST_PERCENT.step}
                value={[value.testPercent]}
                disabled={disabled}
                aria-label={t("share")}
                onValueChange={([next]) => onChange({ ...value, testPercent: next })}
              />
            </div>
            <div className="space-y-2">
              <span className="legend block">{t("metric")}</span>
              <ElevatedPillToggle<WinnerMetric>
                aria-label={t("metric")}
                value={value.winnerMetric}
                onChange={(winnerMetric) => onChange({ ...value, winnerMetric })}
                options={[
                  { value: "opens", label: t("metrics.opens"), icon: <Eye className="h-3.5 w-3.5" />, disabled },
                  { value: "clicks", label: t("metrics.clicks"), icon: <CursorClick className="h-3.5 w-3.5" />, disabled },
                ]}
              />
            </div>
            <div className="min-w-[160px] space-y-2">
              <span className="legend block">{t("decideAfter")}</span>
              <ElevatedSelect
                value={String(value.decideAfterMinutes)}
                disabled={disabled}
                onValueChange={(next) => onChange({ ...value, decideAfterMinutes: Number(next) })}
                aria-label={t("decideAfter")}
              >
                {AB_DECIDE_CHOICES.map((minutes) => (
                  <ElevatedSelectItem key={minutes} value={String(minutes)}>
                    {windowLabel(minutes)}
                  </ElevatedSelectItem>
                ))}
              </ElevatedSelect>
            </div>
          </div>

          <div className="space-y-2">
            <SegmentBar
              size="md"
              segments={[
                { key: "a", label: t("split.a"), value: half, color: EMAIL_SERIES_COLOR.delivered },
                { key: "b", label: t("split.b"), value: half, color: EMAIL_SERIES_COLOR.clicks },
                { key: "winner", label: t("split.winner"), value: rest, color: EMAIL_SERIES_COLOR.opens },
              ]}
              formatValue={(segment) => t("sharePercent", { percent: segment })}
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("summary", { test: value.testPercent, half, rest, window: windowLabel(value.decideAfterMinutes), metric: t(`metricsInline.${value.winnerMetric}`) })}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
