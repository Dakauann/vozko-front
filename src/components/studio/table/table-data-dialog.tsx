"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { ElevatedDialog, ElevatedDialogBody, ElevatedDialogContent, ElevatedDialogDescription, ElevatedDialogFooter, ElevatedDialogHeader, ElevatedDialogTitle } from "@/components/elevated-design/elevated-dialog";
import type { GridCell } from "@/lib/studio/data-grid";
import { gridOfTable, tableIssue, withGrid, type TableGrid, type TableSpec } from "@/lib/studio/table";

import { DataGrid } from "../chart/data-grid";
import { Notice, SwitchRow } from "../image/controls";

interface TableDataDialogProps {
  open: boolean;
  spec: TableSpec;
  focusCell?: GridCell;
  onOpenChange: (open: boolean) => void;
  onApply: (spec: TableSpec) => boolean;
}

function CellsForm({ spec, focusCell, onClose, onApply }: { spec: TableSpec; focusCell?: GridCell; onClose: () => void; onApply: (spec: TableSpec) => boolean }) {
  const t = useTranslations("studio.tables.data");
  const [grid, setGrid] = useState<TableGrid>(() => gridOfTable(spec));
  const [header, setHeader] = useState(spec.header);
  const [failed, setFailed] = useState<"import" | "apply" | null>(null);
  const next = { ...withGrid(spec, grid), header };
  const issue = tableIssue(next);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (issue) return;
    if (onApply(next)) onClose();
    else setFailed("apply");
  };

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <ElevatedDialogHeader>
        <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
        <ElevatedDialogDescription>{t("hint")}</ElevatedDialogDescription>
      </ElevatedDialogHeader>
      <ElevatedDialogBody className="space-y-3">
        <SwitchRow label={t("header")} checked={header} onChange={setHeader} />
        <DataGrid
          layout="table"
          grid={grid}
          focusCell={focusCell}
          onChange={(cells) => {
            setFailed(null);
            setGrid(cells);
          }}
          onImportFailed={() => setFailed("import")}
        />
        {issue ? <Notice tone="info" title={t("invalid")} /> : null}
        {failed ? <Notice tone="fault" title={failed === "import" ? t("importFailed") : t("applyFailed")} /> : null}
      </ElevatedDialogBody>
      <ElevatedDialogFooter>
        <Button type="button" variant="ghost" title={t("cancel")} onClick={onClose} />
        <Button type="submit" variant="primary" title={t("apply")} disabled={issue !== null} />
      </ElevatedDialogFooter>
    </form>
  );
}

export function TableDataDialog({ open, spec, focusCell, onOpenChange, onApply }: TableDataDialogProps) {
  return (
    <ElevatedDialog open={open} onOpenChange={onOpenChange}>
      <ElevatedDialogContent className="max-w-3xl">{open ? <CellsForm spec={spec} focusCell={focusCell} onClose={() => onOpenChange(false)} onApply={onApply} /> : null}</ElevatedDialogContent>
    </ElevatedDialog>
  );
}
