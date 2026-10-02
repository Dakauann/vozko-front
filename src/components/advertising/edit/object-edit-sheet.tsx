"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  ElevatedSheet,
  ElevatedSheetContent,
  ElevatedSheetDescription,
  ElevatedSheetHeader,
  ElevatedSheetTitle,
} from "@/components/elevated-design/elevated-sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/elevated-design/elevated-tabs";
import { Warning } from "@/components/icons";
import type { AdAccount, AdLevel, AdRow } from "@/lib/advertising/types";

import { ObjectEditor } from "./object-editor";

export type PlacementCatalog = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; catalog: Record<string, string[]> };

function chainOf(row: AdRow): { level: AdLevel; metaId: string }[] {
  const campaignId = row.level === "campaign" ? row.metaId : row.campaignId;
  const adSetId = row.level === "adset" ? row.metaId : row.adSetId;
  return [
    campaignId ? { level: "campaign" as const, metaId: campaignId } : null,
    adSetId ? { level: "adset" as const, metaId: adSetId } : null,
    row.level === "ad" ? { level: "ad" as const, metaId: row.metaId } : null,
  ].filter((entry): entry is { level: AdLevel; metaId: string } => entry !== null);
}

function SheetBody({
  row,
  account,
  catalog,
  canUpdate,
  onSaved,
}: {
  row: AdRow;
  account: AdAccount;
  catalog: PlacementCatalog;
  canUpdate: boolean;
  onSaved: (row: AdRow) => void;
}) {
  const t = useTranslations("adsManager.edit");
  const chain = chainOf(row);
  const [active, setActive] = useState<AdLevel>(row.level);

  if (catalog.status !== "ready") {
    return catalog.status === "error" ? (
      <p className="flex items-center gap-2 px-6 text-sm text-destructive-ink">
        <Warning className="h-4 w-4" aria-hidden />
        {t("optionsFailed", { message: catalog.message })}
      </p>
    ) : (
      <div className="mx-6 h-24 animate-pulse rounded-[--radius] bg-muted" />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {chain.length > 1 ? (
        <Tabs value={active} onValueChange={(value) => setActive(value as AdLevel)}>
          <TabsList className="px-6">
            {chain.map((entry) => (
              <TabsTrigger key={entry.level} value={entry.level}>
                {t(`tabs.${entry.level}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}
      {chain.map((entry) => (
        <div key={entry.metaId} hidden={entry.level !== active} className="min-h-0 flex-1 pt-4">
          <ObjectEditor metaId={entry.metaId} account={account} catalog={catalog.catalog} canUpdate={canUpdate} onSaved={onSaved} />
        </div>
      ))}
    </div>
  );
}

export function ObjectEditSheet({
  row,
  account,
  catalog,
  canUpdate,
  onClose,
  onSaved,
}: {
  row: AdRow | null;
  account: AdAccount;
  catalog: PlacementCatalog;
  canUpdate: boolean;
  onClose: () => void;
  onSaved: (row: AdRow) => void;
}) {
  const t = useTranslations("adsManager.edit");
  return (
    <ElevatedSheet open={!!row} onOpenChange={(open) => !open && onClose()}>
      <ElevatedSheetContent side="right" className="flex w-full flex-col sm:max-w-2xl">
        <ElevatedSheetHeader>
          <ElevatedSheetTitle className="text-xl">{row ? t(`title.${row.level}`) : t("title.campaign")}</ElevatedSheetTitle>
          <ElevatedSheetDescription className="truncate">{row?.name}</ElevatedSheetDescription>
        </ElevatedSheetHeader>
        {row ? <SheetBody key={row.metaId} row={row} account={account} catalog={catalog} canUpdate={canUpdate} onSaved={onSaved} /> : null}
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}
