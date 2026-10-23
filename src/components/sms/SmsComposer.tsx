"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { smsTextToGsmAction } from "@/app/actions/sms";
import { PanelSection } from "@/components/dashboard/PanelSection";
import Button from "@/components/elevated-design/button";
import { Lock, TextAa } from "@/components/icons";
import { VariableBindingFields } from "@/components/leads/sends/VariableBindingFields";
import { RcsTextField } from "@/components/rcs/composer/RcsTextField";
import { useVariableTools } from "@/components/rcs/composer/variable-tools";
import { useCarrierErrorText } from "@/components/carrier-messaging/shared/use-carrier-error-text";
import { bindingPreviewValues, sizedBindings, type VariableBinding } from "@/lib/leads/sends";
import { slotNames } from "@/lib/rcs/variables";
import { smsFieldOf } from "@/lib/sms/errors";
import { cn } from "@/lib/utils";

import { SmsMeasurePill } from "./SmsMeasurePill";
import { SmsPhonePreview } from "./SmsPhonePreview";
import { useSmsTextCheck, type SmsTextCheckState } from "./use-sms-text-check";

function PrefixLine({ prefix }: { prefix: string }) {
  const t = useTranslations("sms.composer");
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {t("prefixLead")}
      <span className="inline-flex items-center gap-1 rounded-full border border-control-edge bg-muted px-2.5 py-0.5 font-semibold text-foreground" title={t("prefixLocked")}>
        <Lock aria-hidden className="h-3 w-3 text-muted-foreground" />
        {t("prefixChip", { prefix })}
        <span className="sr-only">{t("prefixLocked")}</span>
      </span>
    </p>
  );
}

function textIssues(check: SmsTextCheckState["check"]): string[] {
  return (check?.issues ?? []).map((issue) => issue.code).filter((code) => smsFieldOf(code) !== "route");
}

export function SmsComposer({
  value,
  onChange,
  bindings,
  onBindingsChange,
  brandPrefix,
  routeId,
  sender,
  routeSlot,
  check,
  compact = false,
  disabled = false,
  className,
}: {
  value: string;
  onChange: (text: string) => void;
  bindings: VariableBinding[];
  onBindingsChange: (bindings: VariableBinding[]) => void;
  brandPrefix?: string;
  routeId?: string;
  sender?: string;
  routeSlot?: ReactNode;
  check?: SmsTextCheckState;
  compact?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const t = useTranslations("sms.composer");
  const tShared = useTranslations("carrierMessaging");
  const errorText = useCarrierErrorText();
  const ownCheck = useSmsTextCheck(check ? "" : value, routeId);
  const state = check ?? ownCheck;
  const backendSlots = state.check?.variable_slots ?? 0;
  const slots = state.status === "ready" ? backendSlots : Math.max(backendSlots, bindings.length);
  const sized = sizedBindings(bindings, slots);
  const variables = useVariableTools(sizedBindings(bindings, Math.max(slots, bindings.length)), onBindingsChange);
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const measurement = state.check?.measurement;
  const unicode = measurement?.encoding === "ucs2";
  const issues = textIssues(state.check);
  const routeIssues = (state.check?.issues ?? []).filter((issue) => smsFieldOf(issue.code) === "route");
  const fieldError = [...new Set(issues.map((code) => errorText(code)))].join(" ") || undefined;
  const previewValues = bindingPreviewValues(sized, variables.labelOf);
  const previewText = state.check?.composed_text ?? value;

  const removeAccents = async () => {
    setConverting(true);
    setConvertError(null);
    const answer = await smsTextToGsmAction({ text: value });
    setConverting(false);
    if (answer.data) {
      onChange(answer.data.text);
      return;
    }
    setConvertError(errorText(answer.error.code));
  };

  const editor = (
    <div className="space-y-3">
      {routeSlot}
      {routeIssues.length > 0 ? <p className="text-xs font-medium text-destructive-ink">{routeIssues.map((issue) => errorText(issue.code)).join(" ")}</p> : null}
      {brandPrefix?.trim() ? <PrefixLine prefix={brandPrefix.trim()} /> : null}
      <RcsTextField
        label={t("label")}
        multiline
        placeholder={t("placeholder")}
        value={value}
        onChange={onChange}
        error={fieldError}
        variables={variables}
        variableStyle={compact ? "menu" : "chips"}
        disabled={disabled}
        aside={compact ? <SmsMeasurePill state={state} /> : undefined}
      />
      {unicode ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[--radius] border border-border bg-card px-3 py-2.5">
          <p className="min-w-0 flex-1 text-xs text-muted-foreground">{t("unicodeHint", { perSegment: measurement?.per_segment ?? 0 })}</p>
          <Button
            variant="outline"
            size="sm"
            title={converting ? t("removingAccents") : t("removeAccents")}
            icon={<TextAa className="h-3.5 w-3.5" />}
            iconVisible
            iconSide="left"
            disabled={disabled || converting}
            onClick={() => void removeAccents()}
          />
        </div>
      ) : null}
      {convertError ? <p role="alert" className="text-xs font-medium text-destructive-ink">{convertError}</p> : null}
    </div>
  );

  if (compact) return <div className={className}>{editor}</div>;

  return (
    <div className={cn("grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] lg:items-start", className)}>
      <div className="min-w-0 space-y-8">
        <PanelSection title={t("title")} description={t("description")} actions={<SmsMeasurePill state={state} />}>
          {editor}
        </PanelSection>
        {slots > 0 ? (
          <PanelSection title={tShared("variables.title")} description={tShared("variables.description")}>
            <VariableBindingFields
              slots={slotNames(slots)}
              binding={{
                choices: variables.choices,
                values: sized,
                labelOf: variables.labelOf,
                onChange: (index, binding) => onBindingsChange(sized.map((item, at) => (at === index ? binding : item))),
              }}
            />
          </PanelSection>
        ) : null}
      </div>
      <aside className="min-w-0 lg:sticky lg:top-16">
        <SmsPhonePreview text={previewText} sender={sender} values={previewValues} />
      </aside>
    </div>
  );
}
