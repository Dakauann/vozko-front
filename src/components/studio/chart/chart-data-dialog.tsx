"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { ElevatedDialog, ElevatedDialogBody, ElevatedDialogContent, ElevatedDialogDescription, ElevatedDialogFooter, ElevatedDialogHeader, ElevatedDialogTitle } from "@/components/elevated-design/elevated-dialog";
import { chartIssue, dataOfGrid, gridOf, minimumSeries, type ChartData, type ChartGrid, type ChartSpec } from "@/lib/studio/chart";

import { Notice } from "../image/controls";
import { DataGrid } from "./data-grid";

interface ChartDataDialogProps {
  open: boolean;
  spec: ChartSpec;
  onOpenChange: (open: boolean) => void;
  onApply: (data: ChartData) => boolean;
}

function DataForm({ spec, onClose, onApply }: { spec: ChartSpec; onClose: () => void; onApply: (data: ChartData) => boolean }) {
  const t = useTranslations("studio.chart.data");
  const [grid, setGrid] = useState<ChartGrid>(() => gridOf(spec.data, spec.format.locale));
  const [failed, setFailed] = useState<"import" | "apply" | null>(null);
  const data = dataOfGrid(grid, spec.format.locale);
  const issue = chartIssue({ ...spec, data });
  const short = data.series.length < minimumSeries(spec.kind) && spec.kind === "scatter";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (issue) return;
    if (onApply(data)) onClose();
    else setFailed("apply");
  };

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <ElevatedDialogHeader>
        <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
        <ElevatedDialogDescription>{t("hint")}</ElevatedDialogDescription>
      </ElevatedDialogHeader>
      <ElevatedDialogBody className="space-y-3">
        <DataGrid
          grid={grid}
          onChange={(next) => {
            setFailed(null);
            setGrid(next);
          }}
          onImportFailed={() => setFailed("import")}
        />
        {issue ? <Notice tone="info" title={short ? t("scatterNeedsTwo") : t("invalid")} /> : null}
        {failed ? <Notice tone="fault" title={failed === "import" ? t("importFailed") : t("applyFailed")} /> : null}
      </ElevatedDialogBody>
      <ElevatedDialogFooter>
        <Button type="button" variant="ghost" title={t("cancel")} onClick={onClose} />
        <Button type="submit" variant="primary" title={t("apply")} disabled={issue !== null} />
      </ElevatedDialogFooter>
    </form>
  );
}

export function ChartDataDialog({ open, spec, onOpenChange, onApply }: ChartDataDialogProps) {
  return (
    <ElevatedDialog open={open} onOpenChange={onOpenChange}>
      <ElevatedDialogContent className="max-w-3xl">{open ? <DataForm spec={spec} onClose={() => onOpenChange(false)} onApply={onApply} /> : null}</ElevatedDialogContent>
    </ElevatedDialog>
  );
}
