"use client";

import { useTranslations } from "next-intl";

import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { LITERAL_SOURCE, type BindingChoice, type BindingSource, type VariableBinding } from "@/lib/leads/sends";

export interface VariableBindingControls {
  choices: readonly BindingChoice[];
  values: readonly VariableBinding[];
  onChange: (index: number, binding: VariableBinding) => void;
  labelOf: (source: BindingSource) => string;
}

export function VariableBindingFields({ slots, binding }: { slots: readonly string[]; binding: VariableBindingControls }) {
  const t = useTranslations("leadSends.bindings");
  const { choices, values, onChange, labelOf } = binding;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <span className="legend">{t("title")}</span>
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
      </div>
      {slots.map((slot, index) => {
        const name = `{{${slot}}}`;
        const current = values[index] ?? { source: LITERAL_SOURCE, value: "" };
        const literal = current.source === LITERAL_SOURCE;
        return (
          <div key={`binding-${index}`} className="grid items-start gap-2 sm:grid-cols-[3rem_minmax(0,1fr)_minmax(0,1fr)]">
            <span className="readout mt-2.5 w-fit rounded-[--radius] bg-muted px-1.5 text-xs font-semibold text-foreground">{name}</span>
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
