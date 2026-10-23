"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Plus, Trash } from "@/components/icons";
import Button from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogBody,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { codedErrorMessage } from "@/lib/api/coded-error";
import { createSheet } from "@/lib/google-sheets/client";
import type { GoogleSheet, SheetCatalog, SheetColumnInput } from "@/lib/google-sheets/types";

import { BLANK_COLUMN, ColumnFields, optionLines } from "./ColumnFields";

function cleanColumn(column: SheetColumnInput): SheetColumnInput {
  return { ...column, header: column.header.trim(), instruction: column.instruction?.trim() || undefined, options: column.options ? optionLines(column.options.join("\n")) : undefined };
}

export function CreateSheetDialog({ catalog, onClose, onCreated }: { catalog: SheetCatalog; onClose: () => void; onCreated: (sheet: GoogleSheet) => void }) {
  const t = useTranslations("googleSheets");
  const [title, setTitle] = useState("");
  const [tabName, setTabName] = useState("");
  const [description, setDescription] = useState("");
  const [columns, setColumns] = useState<SheetColumnInput[]>([BLANK_COLUMN]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setColumn = (index: number, next: SheetColumnInput) => setColumns((current) => current.map((column, at) => (at === index ? next : column)));

  const submit = async () => {
    setSaving(true);
    setError(null);
    const res = await createSheet({
      title: title.trim(),
      tabName: tabName.trim() || undefined,
      description: description.trim() || undefined,
      columns: columns.map(cleanColumn),
    });
    setSaving(false);
    if (res.error || !res.data) {
      setError(codedErrorMessage(t, res.error ?? {}, t("create.failed")));
      return;
    }
    toast.success(t("create.created"), { description: res.data.title });
    onCreated(res.data);
  };

  return (
    <ElevatedDialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <ElevatedDialogContent className="max-w-2xl">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("create.title")}</ElevatedDialogTitle>
          <ElevatedDialogDescription>{t("create.description")}</ElevatedDialogDescription>
        </ElevatedDialogHeader>
        <ElevatedDialogBody>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ElevatedInput label={`${t("create.sheetTitle")} *`} value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
              <div className="space-y-1">
                <ElevatedInput label={t("create.tabName")} value={tabName} onChange={(event) => setTabName(event.target.value)} />
                <p className="text-2xs text-muted-foreground">{t("create.tabNameHint")}</p>
              </div>
            </div>
            <div className="space-y-1">
              <ElevatedTextarea label={t("create.sheetDescription")} value={description} onChange={(event) => setDescription(event.target.value)} autoResize />
              <p className="text-2xs text-muted-foreground">{t("create.sheetDescriptionHint")}</p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold">{t("create.columns")}</p>
              {columns.map((column, index) => (
                <div key={index} className="space-y-3 rounded-[--radius] border border-border bg-mist p-3">
                  <ColumnFields catalog={catalog} value={column} onChange={(next) => setColumn(index, next)} />
                  {columns.length > 1 ? (
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        title={t("create.removeColumn")}
                        icon={<Trash size={14} />}
                        iconVisible
                        onClick={() => setColumns((current) => current.filter((_, at) => at !== index))}
                      />
                    </div>
                  ) : null}
                </div>
              ))}
              <Button
                variant="secondary"
                size="sm"
                title={t("create.addColumn")}
                icon={<Plus size={14} />}
                iconVisible
                onClick={() => setColumns((current) => [...current, BLANK_COLUMN])}
              />
            </div>
            {error ? <p className="text-xs text-destructive-ink">{error}</p> : null}
            <button type="submit" hidden aria-hidden tabIndex={-1} />
          </form>
        </ElevatedDialogBody>
        <ElevatedDialogFooter>
          <Button variant="secondary" title={t("create.cancel")} onClick={onClose} disabled={saving} />
          <Button variant="primary" title={saving ? t("create.creating") : t("create.submit")} onClick={() => void submit()} disabled={saving || !title.trim()} />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
