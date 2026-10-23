"use client";

import { useState } from "react";

import { CaretDown } from "@/components/icons";
import { AiGlow } from "@/components/elevated-design/ai-glow";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSegmentedControl } from "@/components/elevated-design/elevated-segmented-control";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { ElevatedSwitch } from "@/components/elevated-design/elevated-switch";
import { ExplainerHint } from "@/components/explainers/ExplainerHint";
import { CompactWorkingHoursEditor } from "@/components/dashboard/working-hours/WorkingHoursEditor";
import { browserTimezone, defaultWorkingHours } from "@/lib/working-hours/types";
import {
  SMART_PRESETS,
  canSaveSmartPolicy,
  presetPolicy,
  type SmartDefaults,
  type SmartPolicy,
  type SmartPreset,
  type SmartProtectiveAction,
} from "@/lib/whatsapp-campaigns/smart";
import { cn } from "@/lib/utils";

import { SmartSendBadge } from "./SmartSendArt";
import { useSmartText } from "./use-smart-text";
import { WaveProjectionList } from "./WaveProjection";

type NumberField = "firstWaveSize" | "minWaveSize" | "maxWaveSize" | "observeWaitMinutes" | "maxWavesPerDay" | "maxSlowWavesAtFloor";
type RateField = "failureRateSlow" | "failureRateStop";
type ActionField = "onTemplateYellow" | "onPhoneYellow" | "onPhoneRed";
type Field = { kind: "number"; key: NumberField } | { kind: "rate"; key: RateField } | { kind: "action"; key: ActionField };

const FIELD_GROUPS: { key: "waves" | "pace" | "protection"; fields: Field[] }[] = [
  { key: "waves", fields: [{ kind: "number", key: "firstWaveSize" }, { kind: "number", key: "minWaveSize" }, { kind: "number", key: "maxWaveSize" }] },
  { key: "pace", fields: [{ kind: "number", key: "observeWaitMinutes" }, { kind: "number", key: "maxWavesPerDay" }, { kind: "number", key: "maxSlowWavesAtFloor" }] },
  {
    key: "protection",
    fields: [
      { kind: "rate", key: "failureRateSlow" },
      { kind: "rate", key: "failureRateStop" },
      { kind: "action", key: "onTemplateYellow" },
      { kind: "action", key: "onPhoneYellow" },
      { kind: "action", key: "onPhoneRed" },
    ],
  },
];
const PROTECTIVE_ACTIONS: SmartProtectiveAction[] = ["slow_down", "pause", "stop"];

export function SmartPolicyEditor({
  value,
  defaults,
  onChange,
  contacts,
  startAt,
  disabled,
}: {
  value: SmartPolicy | null;
  defaults: SmartDefaults | null;
  onChange: (next: SmartPolicy | null) => void;
  contacts?: number;
  startAt?: string | null;
  disabled?: boolean;
}) {
  const { t } = useSmartText();
  const blocked = disabled || !defaults;
  const on = value !== null;

  const enable = (next: boolean) => {
    if (!defaults) return;
    onChange(next ? presetPolicy(defaults, "standard", defaults.sendHours ?? defaultWorkingHours(browserTimezone())) : null);
  };

  return (
    <div className={cn("relative rounded-xl", on && "vz-ai-card")}>
      {on ? <AiGlow /> : null}
      <div className={cn("relative rounded-[inherit] border bg-card", on ? "border-transparent" : "border-border")}>
        <div className="flex items-center gap-3 p-4">
          <SmartSendBadge className={cn(on && "text-primary")} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <p className="font-display text-base font-semibold leading-tight text-foreground">{t("brand")}</p>
              <ExplainerHint id="campaigns.smartSend" />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{on ? t("onHint") : t("tagline")}</p>
          </div>
          <ElevatedSwitch checked={on} onCheckedChange={enable} disabled={blocked} aria-label={t("enable")} />
        </div>
        {value && defaults ? (
          <div className="border-t border-border p-4">
            <PolicyFields value={value} defaults={defaults} onChange={onChange} contacts={contacts} startAt={startAt} disabled={blocked} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PolicyFields({
  value,
  defaults,
  onChange,
  contacts,
  startAt,
  disabled,
}: {
  value: SmartPolicy;
  defaults: SmartDefaults;
  onChange: (next: SmartPolicy) => void;
  contacts?: number;
  startAt?: string | null;
  disabled?: boolean;
}) {
  const { t } = useSmartText();
  const [advanced, setAdvanced] = useState(false);
  const options = SMART_PRESETS.map((preset) => ({
    value: preset,
    label: t(`presets.${preset}`),
    description: `${t("presetHint", {
      first: defaults.presets[preset].firstWaveSize,
      max: defaults.presets[preset].maxWaveSize,
      minutes: defaults.presets[preset].observeWaitMinutes,
    })}. ${t("presetProtection", {
      yellow: t(`protectiveShort.${defaults.presets[preset].onPhoneYellow}`),
      red: t(`protectiveShort.${defaults.presets[preset].onPhoneRed}`),
    })}`,
  }));

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">{t("preset")}</p>
        <ElevatedSegmentedControl
          options={options}
          value={value.preset}
          onChange={(preset) => onChange(presetPolicy(defaults, preset as SmartPreset, value.sendHours))}
          disabled={disabled}
          size="sm"
        />
      </div>

      <div className="space-y-2">
        <div>
          <p className="text-sm font-medium text-foreground">{t("sendHours")}</p>
          <p className="text-xs text-muted-foreground">{t("sendHoursHint")}</p>
        </div>
        {value.sendHours ? (
          <CompactWorkingHoursEditor value={value.sendHours} onChange={(sendHours) => onChange({ ...value, sendHours })} disabled={disabled} />
        ) : null}
        {canSaveSmartPolicy(value) ? null : <p className="text-xs font-semibold text-warning-ink">{t("sendHoursRequired")}</p>}
      </div>

      {contacts !== undefined && contacts > 0 && canSaveSmartPolicy(value) ? <WaveProjectionList policy={value} contacts={contacts} startAt={startAt} /> : null}

      <div className="space-y-3">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-[--radius] text-xs font-semibold text-primary transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setAdvanced((open) => !open)}
          aria-expanded={advanced}
        >
          {t("advanced")}
          <CaretDown className={cn("h-3 w-3 transition-transform", advanced && "rotate-180")} />
        </button>
        {advanced ? (
          <div className="grid gap-x-4 gap-y-5 rounded-lg border border-border bg-muted/30 p-3 md:grid-cols-3">
            {FIELD_GROUPS.map((group) => (
              <fieldset key={group.key} className="min-w-0 space-y-2">
                <legend className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{t(`advancedGroups.${group.key}`)}</legend>
                {group.key === "protection" ? <p className="text-xs text-muted-foreground">{t("protectionHint")}</p> : null}
                {group.fields.map((field) => (
                  <PolicyField key={field.key} field={field} value={value} onChange={onChange} disabled={disabled} />
                ))}
              </fieldset>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PolicyField({ field, value, onChange, disabled }: { field: Field; value: SmartPolicy; onChange: (next: SmartPolicy) => void; disabled?: boolean }) {
  const { t } = useSmartText();
  const label = t(`fields.${field.key}`);

  if (field.kind === "action") {
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <ElevatedSelect value={value[field.key]} onValueChange={(next) => onChange({ ...value, [field.key]: next as SmartProtectiveAction })} disabled={disabled}>
          {PROTECTIVE_ACTIONS.map((action) => (
            <ElevatedSelectItem key={action} value={action} description={t(`protectiveHints.${action}`)}>
              {t(`protective.${action}`)}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
      </div>
    );
  }

  const rate = field.kind === "rate";
  return (
    <ElevatedInput
      type="number"
      min={0}
      max={rate ? 50 : undefined}
      step={rate ? 0.5 : 1}
      controlSize="sm"
      label={label}
      value={String(rate ? Math.round(value[field.key] * 1000) / 10 : value[field.key])}
      disabled={disabled}
      onChange={(event) => onChange({ ...value, [field.key]: rate ? Number(event.target.value) / 100 : Number(event.target.value) })}
    />
  );
}
