"use client";

import { useTranslations } from "next-intl";

import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { LITERAL_SOURCE, type BindingChoice, type BindingSource, type VariableBinding } from "@/lib/leads/sends";

interface VariableBindingControls {
  choices: readonly BindingChoice[];
  values: readonly VariableBinding[];
  onChange: (index: number, binding: VariableBinding) => void;
  labelOf: (source: BindingSource) => string;
}

export interface BindingSlot {
  name: string;
  header: boolean;
}

function slotOf(slot: string | BindingSlot): BindingSlot {
  return typeof slot === "string" ? { name: slot, header: false } : slot;
}

export function VariableBindingFields({ slots, binding }: { slots: readonly (string | BindingSlot)[]; binding: VariableBindingControls }) {
  const t = useTranslations("leadSends.bindings");
  const tSlot = useTranslations("campaignAudience.step.slot");
  const { choices, values, onChange, labelOf } = binding;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <span className="legend">{t("title")}</span>
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
      </div>
      {slots.map((entry, index) => {
        const slot = slotOf(entry);
        const tag = `{{${slot.name}}}`;
        const name = slot.header ? tSlot("headerSlot", { tag }) : tag;
        const current = values[index] ?? { source: LITERAL_SOURCE, value: "" };
        const literal = current.source === LITERAL_SOURCE;
        return (
          <div key={`binding-${index}`} className="grid items-start gap-2 sm:grid-cols-[minmax(3rem,auto)_minmax(0,1fr)_minmax(0,1fr)]">
            <span className="mt-2.5 flex flex-col items-start gap-1">
              <span className="readout w-fit rounded-[--radius] bg-muted px-1.5 text-xs font-semibold text-foreground">{tag}</span>
              {slot.header ? <span className="text-2xs font-medium text-muted-foreground">{tSlot("header")}</span> : null}
            </span>
            <ElevatedSelect
              label={t("source", { slot: name })}
              aria-label={t("source", { slot: name })}
              value={current.source}
              onValueChange={(source) =>
                onChange(index, source === LITERAL_SOURCE ? { source: LITERAL_SOURCE, value: "" } : { source: source as BindingSource })
              }
              contentClassName="z-[200]"
            >
              {choices.map((choice) => (
                <ElevatedSelectItem key={choice.source} value={choice.source}>
                  {labelOf(choice.source)}
                </ElevatedSelectItem>
              ))}
            </ElevatedSelect>
            {literal ? (
              <ElevatedInput
                label={t("literalValue", { slot: name })}
                aria-label={t("literalValue", { slot: name })}
                value={current.value ?? ""}
                onChange={(event) => onChange(index, { source: LITERAL_SOURCE, value: event.target.value })}
                className="w-full"
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
