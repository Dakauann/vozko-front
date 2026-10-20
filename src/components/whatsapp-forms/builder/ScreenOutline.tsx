"use client";

import { useTranslations } from "next-intl";

import { Plus, WarningCircle } from "@/components/icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { BlockSpec } from "@/lib/whatsapp-forms/document-edit";
import type { ProblemIndex } from "@/lib/whatsapp-forms/problems";
import type { Block, DisplayKind, Document, FieldKind, Screen } from "@/lib/whatsapp-forms/types";
import { cn } from "@/lib/utils";

import { SortableList } from "./SortableList";

export function blockTitle(block: Block, kindLabel: (block: Block) => string): string {
  const text = block.field ? block.field.label || block.field.question : block.display?.text;
  return text?.trim() || kindLabel(block);
}

export function AddBlockMenu({
  fieldKinds,
  displayKinds,
  onAdd,
  label,
  compact,
}: {
  fieldKinds: readonly FieldKind[];
  displayKinds: readonly DisplayKind[];
  onAdd: (spec: BlockSpec) => void;
  label: string;
  compact?: boolean;
}) {
  const t = useTranslations("whatsappForms");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-[--radius] text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            compact ? "px-2 py-1" : "w-full border border-dashed border-border px-3 py-2",
          )}
        >
          <Plus className="h-3.5 w-3.5" weight="bold" />
          {label}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[70vh] w-60 overflow-y-auto">
        <DropdownMenuLabel>{t("builder.addQuestion")}</DropdownMenuLabel>
        {fieldKinds.map((kind) => (
          <DropdownMenuItem key={kind} onSelect={() => onAdd({ field: kind })}>
            {t(`fieldKinds.${kind}`)}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("builder.addContent")}</DropdownMenuLabel>
        {displayKinds.map((kind) => (
          <DropdownMenuItem key={kind} onSelect={() => onAdd({ display: kind })}>
            {t(`displayKinds.${kind}`)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ScreenOutline({
  document,
  activeScreen,
  selectedBlock,
  problems,
  fieldKinds,
  displayKinds,
  readOnly,
  onSelectScreen,
  onSelectBlock,
  onMoveScreen,
  onMoveBlock,
  onAddScreen,
  onAddBlock,
}: {
  document: Document;
  activeScreen: string;
  selectedBlock: string | null;
  problems: ProblemIndex;
  fieldKinds: readonly FieldKind[];
  displayKinds: readonly DisplayKind[];
  readOnly?: boolean;
  onSelectScreen: (key: string) => void;
  onSelectBlock: (key: string) => void;
  onMoveScreen: (from: number, to: number) => void;
  onMoveBlock: (screen: Screen, from: number, to: number) => void;
  onAddScreen: () => void;
  onAddBlock: (screen: Screen, spec: BlockSpec) => void;
}) {
  const t = useTranslations("whatsappForms");
  const kindLabel = (block: Block) => (block.field ? t(`fieldKinds.${block.field.kind}`) : block.display ? t(`displayKinds.${block.display.kind}`) : "");

  return (
    <nav aria-label={t("builder.screens")} className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-muted-foreground">{t("builder.screens")}</h2>
        {!readOnly ? (
          <button
            type="button"
            onClick={onAddScreen}
            className="inline-flex items-center gap-1 rounded-[--radius] px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="h-3.5 w-3.5" weight="bold" />
            {t("builder.addScreen")}
          </button>
        ) : null}
      </div>
      <SortableList
        items={document.screens}
        itemKey={(screen) => screen.key}
        onMove={onMoveScreen}
        disabled={readOnly}
        handleLabel={(screen) => t("builder.dragScreen", { title: screen.title || screen.key })}
        className="space-y-2"
        renderItem={(screen, index, handle) => (
          <div className={cn("rounded-[--radius] border bg-card", screen.key === activeScreen ? "border-primary" : "border-border")}>
            <div className="flex items-center gap-1.5 px-2 py-2">
              {handle}
              <button
                type="button"
                onClick={() => onSelectScreen(screen.key)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded text-left text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="shrink-0 text-2xs font-medium text-muted-foreground">{index + 1}</span>
                <span className="truncate">{screen.title || t("builder.untitledScreen")}</span>
              </button>
              {problems.flaggedScreens.has(screen.key) ? <WarningCircle aria-label={t("builder.flagged")} weight="fill" className="h-4 w-4 shrink-0 text-destructive" /> : null}
            </div>
            <SortableList
              items={screen.blocks}
              itemKey={(block) => block.key}
              onMove={(from, to) => onMoveBlock(screen, from, to)}
              disabled={readOnly}
              handleLabel={(block) => t("builder.dragBlock", { title: blockTitle(block, kindLabel) })}
              className="space-y-0.5 px-2 pb-2"
              renderItem={(block, _index, blockHandle) => (
                <div className={cn("flex items-center gap-1.5 rounded px-1 py-1", selectedBlock === block.key ? "bg-muted" : "hover:bg-muted/60")}>
                  {blockHandle}
                  <button
                    type="button"
                    onClick={() => onSelectBlock(block.key)}
                    aria-current={selectedBlock === block.key ? "true" : undefined}
                    className="min-w-0 flex-1 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="block truncate text-xs text-foreground">{blockTitle(block, kindLabel)}</span>
                    <span className="block truncate text-2xs text-muted-foreground">{kindLabel(block)}</span>
                  </button>
                  {problems.flaggedBlocks.has(block.key) ? <WarningCircle aria-label={t("builder.flagged")} weight="fill" className="h-3.5 w-3.5 shrink-0 text-destructive" /> : null}
                </div>
              )}
            />
            {!readOnly ? (
              <div className="px-2 pb-2">
                <AddBlockMenu fieldKinds={fieldKinds} displayKinds={displayKinds} onAdd={(spec) => onAddBlock(screen, spec)} label={t("builder.addBlock")} />
              </div>
            ) : null}
          </div>
        )}
      />
    </nav>
  );
}
