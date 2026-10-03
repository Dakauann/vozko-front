"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { Section } from "@/components/advertising/wizard/choice-row";
import { CREATIVE_FIELDS, type CreativeField } from "@/lib/advertising/manager-bulk";

export function AdTextFields({
  values,
  disabled,
  onChange,
  slot,
}: {
  values: Record<CreativeField, string>;
  disabled: boolean;
  onChange: (field: CreativeField, value: string) => void;
  slot: (field: CreativeField, input: ReactNode) => ReactNode;
}) {
  const t = useTranslations("adsEditor.multi");
  const tFields = useTranslations("adsManager.toolbar.fields");
  return (
    <Section title={t("textTitle")}>
      {CREATIVE_FIELDS.map((field) => (
        <div key={field}>
          {slot(
            field,
            field === "primaryText" ? (
              <ElevatedTextarea label={tFields(field)} value={values[field]} disabled={disabled} onChange={(event) => onChange(field, event.target.value)} />
            ) : (
              <ElevatedInput
                label={tFields(field)}
                value={values[field]}
                disabled={disabled}
                inputMode={field === "link" ? "url" : undefined}
                onChange={(event) => onChange(field, event.target.value)}
                controlSize="sm"
              />
            ),
          )}
        </div>
      ))}
    </Section>
  );
}
