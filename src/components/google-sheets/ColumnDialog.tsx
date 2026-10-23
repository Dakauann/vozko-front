"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import Button from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogBody,
  ElevatedDialogContent,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import { ExplainerHint } from "@/components/explainers/ExplainerHint";
import { codedErrorMessage } from "@/lib/api/coded-error";
import { editSheetColumns } from "@/lib/google-sheets/client";
import type { GoogleSheet, SheetCatalog, SheetColumn, SheetColumnInput, SheetColumnUpdate } from "@/lib/google-sheets/types";

import { BLANK_COLUMN, ColumnFields, ColumnOptionsField, optionLines } from "./ColumnFields";

export type ColumnDialogMode = { kind: "add" } | { kind: "edit"; column: SheetColumn };

function columnUpdate(column: SheetColumn, draft: SheetColumn): SheetColumnUpdate {
  return {
    key: column.key,
    header: draft.header.trim(),
    instruction: draft.instruction?.trim() ?? "",
    required: draft.required,
    archived: draft.archived,
    options: column.type === "choice" ? optionLines((draft.options ?? []).join("\n")) : undefined,
  };
}

function EditColumnFields({ catalog, draft, onChange }: { catalog: SheetCatalog; draft: SheetColumn; onChange: (next: SheetColumn) => void }) {
  const t = useTranslations("googleSheets");
  const filled = draft.source !== "input";
  return (
    <div className="space-y-3">
      <ElevatedInput label={t("column.header")} value={draft.header} maxLength={catalog.maxHeader} onChange={(event) => onChange({ ...draft, header: event.target.value })} controlSize="sm" />
      <p className="text-2xs text-muted-foreground">
        {filled ? t("column.systemFilled", { type: t(`types.${draft.type}`) }) : t("column.typeFixed", { type: t(`types.${draft.type}`) })}
      </p>
      {!filled && draft.type === "choice" ? <ColumnOptionsField options={draft.options ?? []} onChange={(options) => onChange({ ...draft, options })} /> : null}
      {!filled ? (
        <>
          <ElevatedInput
            label={t("column.instruction")}
            value={draft.instruction ?? ""}
            maxLength={catalog.maxInstruction}
            onChange={(event) => onChange({ ...draft, instruction: event.target.value })}
            controlSize="sm"
          />
          <ElevatedSwitch
            checked={draft.required}
            onCheckedChange={(required) => onChange({ ...draft, required })}
            label={t("column.required")}
            description={t("column.requiredHint")}
            explainer={<ExplainerHint id="sheets.requiredColumn" />}
          />
        </>
      ) : null}
      <ElevatedSwitch
        checked={draft.archived}
        onCheckedChange={(archived) => onChange({ ...draft, archived })}
        label={t("column.archived")}
        description={t("column.archivedHint")}
        explainer={<ExplainerHint id="sheets.archivedColumn" />}
      />
    </div>
  );
}

export function ColumnDialog({
  sheet,
  catalog,
  mode,
  onClose,
  onSaved,
}: {
  sheet: GoogleSheet;
  catalog: SheetCatalog;
  mode: ColumnDialogMode;
  onClose: () => void;
  onSaved: (sheet: GoogleSheet) => void;
}) {
  const t = useTranslations("googleSheets");
  const [added, setAdded] = useState<SheetColumnInput>(BLANK_COLUMN);
  const [edited, setEdited] = useState<SheetColumn | null>(mode.kind === "edit" ? mode.column : null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    const res =
      mode.kind === "edit" && edited
        ? await editSheetColumns(sheet.id, { version: sheet.version, update: [columnUpdate(mode.column, edited)] })
        : await editSheetColumns(sheet.id, {
            version: sheet.version,
            add: [{ ...added, header: added.header.trim(), instruction: added.instruction?.trim() || undefined, options: added.options ? optionLines(added.options.join("\n")) : undefined }],
          });
    setSaving(false);
    if (res.error || !res.data) {
      setError(codedErrorMessage(t, res.error ?? {}, t("columnDialog.failed")));
      return;
    }
    toast(t("columnDialog.saved"));
    onSaved(res.data);
  };

  return (
    <ElevatedDialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <ElevatedDialogContent className="max-w-lg">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{mode.kind === "edit" ? t("columnDialog.editTitle", { header: mode.column.header }) : t("columnDialog.addTitle")}</ElevatedDialogTitle>
        </ElevatedDialogHeader>
        <ElevatedDialogBody>
          <div className="space-y-4">
            {edited ? <EditColumnFields catalog={catalog} draft={edited} onChange={setEdited} /> : <ColumnFields catalog={catalog} value={added} onChange={setAdded} />}
            {mode.kind === "add" ? <p className="text-2xs text-muted-foreground">{t("columnDialog.addHint")}</p> : null}
            {error ? <p className="text-xs text-destructive-ink">{error}</p> : null}
          </div>
        </ElevatedDialogBody>
        <ElevatedDialogFooter>
          <Button variant="secondary" title={t("columnDialog.cancel")} onClick={onClose} disabled={saving} />
          <Button variant="primary" title={t("columnDialog.save")} onClick={() => void submit()} disabled={saving} />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
