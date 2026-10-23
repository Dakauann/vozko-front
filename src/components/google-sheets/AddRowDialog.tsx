"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

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
import { codedErrorMessage } from "@/lib/api/coded-error";
import { addSheetRow } from "@/lib/google-sheets/client";
import type { GoogleSheet } from "@/lib/google-sheets/types";
import { mappedColumns } from "@/lib/google-sheets/columns";

function refusedColumn(details: Record<string, unknown> | undefined): string | null {
  const column = details?.column;
  return typeof column === "string" ? column : null;
}

export function AddRowDialog({ sheet, onClose, onQueued }: { sheet: GoogleSheet; onClose: () => void; onQueued: () => void }) {
  const t = useTranslations("googleSheets");
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ message: string; column: string | null } | null>(null);
  const columns = mappedColumns(sheet);

  const submit = async () => {
    setSaving(true);
    setError(null);
    const filled = Object.fromEntries(Object.entries(values).filter(([, value]) => value.trim() !== ""));
    const res = await addSheetRow(sheet.id, filled, idempotencyKey);
    setSaving(false);
    if (res.error || !res.data) {
      setError({ message: codedErrorMessage(t, res.error ?? {}, t("addRow.failed")), column: refusedColumn(res.error?.details) });
      return;
    }
    toast.success(res.data.duplicate ? t("addRow.duplicate") : t("addRow.queued"));
    onQueued();
  };

  return (
    <ElevatedDialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <ElevatedDialogContent className="max-w-lg">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("addRow.title")}</ElevatedDialogTitle>
          <ElevatedDialogDescription>{t("addRow.description")}</ElevatedDialogDescription>
        </ElevatedDialogHeader>
        <ElevatedDialogBody>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            {columns.map((column, index) => (
              <div key={column.key} className="space-y-1">
                <ElevatedInput
                  label={column.required ? `${column.header} *` : column.header}
                  placeholder={t(`types.${column.type}`)}
                  value={values[column.key] ?? ""}
                  onChange={(event) => setValues((current) => ({ ...current, [column.key]: event.target.value }))}
                  error={error?.column === column.key ? error.message : undefined}
                  controlSize="sm"
                  autoFocus={index === 0}
                />
                {column.type === "choice" && column.options?.length ? (
                  <p className="text-2xs text-muted-foreground">{t("addRow.options", { options: column.options.join(", ") })}</p>
                ) : null}
              </div>
            ))}
            {error && !error.column ? <p className="text-xs text-destructive-ink">{error.message}</p> : null}
            <button type="submit" hidden aria-hidden tabIndex={-1} />
          </form>
        </ElevatedDialogBody>
        <ElevatedDialogFooter>
          <Button variant="secondary" title={t("addRow.cancel")} onClick={onClose} disabled={saving} />
          <Button variant="primary" title={t("addRow.submit")} onClick={() => void submit()} disabled={saving} />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
