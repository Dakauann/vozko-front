"use client";

import { useTranslations } from "next-intl";

import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { ExplainerHint } from "@/components/explainers/ExplainerHint";
import type { SheetCatalog, SheetColumnInput, SheetColumnSource } from "@/lib/google-sheets/types";

export const BLANK_COLUMN: SheetColumnInput = { header: "", type: "text", required: false, source: "input" };

export function optionLines(text: string): string[] {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

export function ColumnOptionsField({ options, onChange }: { options: string[]; onChange: (options: string[]) => void }) {
  const t = useTranslations("googleSheets.column");
  return (
    <div className="space-y-1">
      <ElevatedTextarea
        label={t("options")}
        value={options.join("\n")}
        onChange={(event) => onChange(event.target.value.split(/\r?\n/))}
        onBlur={() => onChange(optionLines(options.join("\n")))}
        controlSize="sm"
        autoResize
      />
      <p className="text-2xs text-muted-foreground">{t("optionsHint")}</p>
    </div>
  );
}

export function ColumnFields({
  catalog,
  value,
  onChange,
}: {
  catalog: SheetCatalog;
  value: SheetColumnInput;
  onChange: (next: SheetColumnInput) => void;
}) {
  const t = useTranslations("googleSheets");
  const filled = value.source !== "input";

  const pickSource = (source: SheetColumnSource) => {
    const info = catalog.sources.find((entry) => entry.source === source);
    onChange({ ...value, source, type: info?.type ?? value.type, options: undefined, required: source === "input" && value.required });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ElevatedInput
          label={t("column.header")}
          value={value.header}
          maxLength={catalog.maxHeader}
          onChange={(event) => onChange({ ...value, header: event.target.value })}
          controlSize="sm"
        />
        <ElevatedSelect label={t("column.source")} value={value.source} onValueChange={(next) => pickSource(next as SheetColumnSource)}>
          <ElevatedSelectItem value="input">{t("sources.input")}</ElevatedSelectItem>
          {catalog.sources.map((entry) => (
            <ElevatedSelectItem key={entry.source} value={entry.source}>
              {t(`sources.${entry.source}`)}
            </ElevatedSelectItem>
          ))}
        </ElevatedSelect>
      </div>

      {filled ? (
        <p className="text-2xs text-muted-foreground">{t("column.systemFilled", { type: t(`types.${value.type}`) })}</p>
      ) : (
        <>
          <ElevatedSelect
            label={t("column.type")}
            value={value.type}
            onValueChange={(next) => onChange({ ...value, type: next as SheetColumnInput["type"], options: next === "choice" ? (value.options ?? []) : undefined })}
          >
            {catalog.types.map((type) => (
              <ElevatedSelectItem key={type} value={type}>
                {t(`types.${type}`)}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
          {value.type === "choice" ? <ColumnOptionsField options={value.options ?? []} onChange={(options) => onChange({ ...value, options })} /> : null}
          <div className="space-y-1">
            <ElevatedInput
              label={t("column.instruction")}
              value={value.instruction ?? ""}
              maxLength={catalog.maxInstruction}
              onChange={(event) => onChange({ ...value, instruction: event.target.value })}
              controlSize="sm"
            />
            <p className="text-2xs text-muted-foreground">{t("column.instructionHint")}</p>
          </div>
          <ElevatedSwitch
            checked={value.required}
            onCheckedChange={(required) => onChange({ ...value, required })}
            label={t("column.required")}
            description={t("column.requiredHint")}
            explainer={<ExplainerHint id="sheets.requiredColumn" />}
          />
        </>
      )}
    </div>
  );
}
