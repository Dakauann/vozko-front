"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { SheetPicker } from "@/components/google-sheets/SheetPicker";
import { Notice } from "@/components/ui/notice";
import { codedErrorMessage, type CodedRefusal } from "@/lib/api/coded-error";
import { fetchGoogleStatus } from "@/lib/google/client";
import { fetchSheet } from "@/lib/google-sheets/client";
import { GOOGLE_SHEETS_PATH, googleSheetPath } from "@/lib/google-sheets/paths";
import type { GoogleSheet } from "@/lib/google-sheets/types";
import { mappedColumns, systemColumns } from "@/lib/google-sheets/columns";
import { readSheetRowConfig } from "@/lib/workflows/sheet-row-node";

import { VariableCommandInput } from "./variable-command-input";

interface LoadedSheet {
  id: string;
  sheet: GoogleSheet | null;
  error?: CodedRefusal;
}

function useSheet(sheetId: string): LoadedSheet | null {
  const [loaded, setLoaded] = useState<LoadedSheet | null>(null);
  useEffect(() => {
    if (!sheetId) return;
    let active = true;
    void fetchSheet(sheetId).then((res) => {
      if (!active) return;
      setLoaded({ id: sheetId, sheet: res.data, error: res.error });
    });
    return () => {
      active = false;
    };
  }, [sheetId]);
  return loaded?.id === sheetId ? loaded : null;
}

function useSheetsConnected(): boolean | null {
  const [connected, setConnected] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    void fetchGoogleStatus("sheets").then((res) => {
      if (active) setConnected(res.status?.connected ?? false);
    });
    return () => {
      active = false;
    };
  }, []);
  return connected;
}

export function SheetRowConfigSection({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const t = useTranslations("workflowsPage.sheetRow");
  const tSheets = useTranslations("googleSheets");
  const { sheetId, values } = readSheetRowConfig(config);
  const savedTitle = typeof config._display_sheet_id === "string" ? config._display_sheet_id : "";
  const connected = useSheetsConnected();
  const loaded = useSheet(sheetId);
  const sheet = loaded?.sheet ?? null;

  const pick = (nextId: string, title: string) => {
    if (nextId === sheetId) return;
    onChange({ sheet_id: nextId, _display_sheet_id: title, values: {} });
  };

  return (
    <div className="space-y-3 rounded-[--radius] border border-border bg-mist p-3" data-testid="sheet-row-config">
      {connected === false ? (
        <Notice tone="warning" title={t("notConnectedTitle")}>
          <p>
            {t("notConnected")}{" "}
            <Link href={GOOGLE_SHEETS_PATH} className="font-medium underline">
              {t("openSheets")}
            </Link>
          </p>
        </Notice>
      ) : null}

      <div className="space-y-1">
        <SheetPicker
          label={`${t("sheet")} *`}
          value={sheetId}
          savedTitle={savedTitle}
          searchPlaceholder={t("search")}
          emptyMessage={t("empty")}
          attentionLabel={tSheets("status.needs_attention")}
          onPick={pick}
        />
        {!sheetId ? <p className="text-2xs text-destructive-ink">{t("required")}</p> : null}
        {sheet ? (
          <Link href={googleSheetPath(sheet.id)} className="text-2xs font-medium text-primary-ink hover:underline">
            {t("manage")}
          </Link>
        ) : null}
      </div>

      {loaded?.error ? <p className="text-2xs text-destructive-ink">{codedErrorMessage(tSheets, loaded.error, t("loadFailed"))}</p> : null}

      {sheet?.status === "needs_attention" ? (
        <Notice tone="warning" title={tSheets("status.needs_attention")}>
          <p>{sheet.reason ? tSheets(`reasons.${sheet.reason}`) : t("attention")}</p>
        </Notice>
      ) : null}

      {sheet ? (
        <div className="space-y-3">
          <p className="text-2xs leading-relaxed text-muted-foreground">{t("valuesHint")}</p>
          {mappedColumns(sheet).map((column) => (
            <div key={column.key} className="space-y-1">
              <VariableCommandInput
                label={column.required ? `${column.header} *` : column.header}
                value={values[column.key] ?? ""}
                onChange={(next) => onChange({ values: { ...values, [column.key]: next } })}
                placeholder={tSheets(`types.${column.type}`)}
                controlSize="sm"
              />
              {column.instruction ? <p className="text-2xs text-muted-foreground">{column.instruction}</p> : null}
              {column.type === "choice" && column.options?.length ? (
                <p className="text-2xs text-muted-foreground">{t("options", { options: column.options.join(", ") })}</p>
              ) : null}
            </div>
          ))}
          {systemColumns(sheet).length > 0 ? (
            <p className="text-2xs leading-relaxed text-muted-foreground">
              {t("systemFilled", { columns: systemColumns(sheet).map((column) => column.header).join(", ") })}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
