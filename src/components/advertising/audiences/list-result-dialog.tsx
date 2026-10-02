"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import type { CustomerListResult } from "@/lib/advertising/audiences";

import { useAdsFormat } from "../use-ads-format";

export function ListResultDialog({ result, onClose }: { result: CustomerListResult | null; onClose: () => void }) {
  const t = useTranslations("adsAudiences.result");
  const fmt = useAdsFormat();
  return (
    <ElevatedDialog open={!!result} onOpenChange={(open) => !open && onClose()}>
      <ElevatedDialogContent>
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("title", { name: result?.audience.name ?? "" })}</ElevatedDialogTitle>
          <ElevatedDialogDescription>{t("description")}</ElevatedDialogDescription>
        </ElevatedDialogHeader>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[--radius] border border-border bg-border">
          <div className="bg-card px-4 py-3">
            <dt className="text-xs text-muted-foreground">{t("matched")}</dt>
            <dd className="font-display text-2xl font-semibold tabular-nums text-foreground">{fmt.count(result?.matched)}</dd>
          </div>
          <div className="bg-card px-4 py-3">
            <dt className="text-xs text-muted-foreground">{t("skipped")}</dt>
            <dd className="font-display text-2xl font-semibold tabular-nums text-foreground">{fmt.count(result?.skipped)}</dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">{t("skippedHint")}</p>
        <ElevatedDialogFooter>
          <Button variant="primary" title={t("close")} onClick={onClose} />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
