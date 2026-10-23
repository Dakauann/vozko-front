"use client";

import { useDraggable } from "@dnd-kit/core";
import { useTranslations } from "next-intl";

import type { BlockKind } from "@/lib/email-design/types";
import { cn } from "@/lib/utils";

import { DRAG_PREFIX, KIND_ICONS, PALETTE_KINDS } from "./block-meta";

function PaletteItem({ kind, disabled, onAdd }: { kind: BlockKind; disabled: boolean; onAdd: (kind: BlockKind) => void }) {
  const t = useTranslations("emailEditor.palette");
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `${DRAG_PREFIX}${kind}`, data: { kind }, disabled });
  const Glyph = KIND_ICONS[kind];
  const label = t(`kinds.${kind}.label`);
  const description = t(`kinds.${kind}.description`);
  return (
    <li>
      <button
        ref={setNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={t("add", { block: label })}
        aria-describedby={undefined}
        title={description}
        disabled={disabled}
        onClick={() => onAdd(kind)}
        className={cn(
          "group flex h-full w-full cursor-grab flex-col items-center gap-1.5 rounded-[--radius] border border-border bg-card px-1.5 pb-2 pt-2.5 text-center transition-colors active:cursor-grabbing dark:bg-muted",
          "hover:border-control-edge hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-[hsl(var(--accent-hover))]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          isDragging && "opacity-40",
        )}
      >
        <Glyph className="h-5 w-5 text-foreground" />
        <span className="block w-full text-xs font-medium leading-4 text-foreground [overflow-wrap:anywhere]">{label}</span>
      </button>
    </li>
  );
}

export function Palette({ disabled, onAdd }: { disabled: boolean; onAdd: (kind: BlockKind) => void }) {
  const t = useTranslations("emailEditor.palette");
  return (
    <section aria-label={t("title")} className="pb-3 pt-3">
      <div className="px-4 pb-2.5">
        <h2 className="legend">{t("title")}</h2>
        <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">{t("hint")}</p>
      </div>
      <ul className="grid grid-cols-2 gap-1.5 px-4">
        {PALETTE_KINDS.map((kind) => (
          <PaletteItem key={kind} kind={kind} disabled={disabled} onAdd={onAdd} />
        ))}
      </ul>
    </section>
  );
}

export function KindMenu({ onPick, kinds = PALETTE_KINDS }: { onPick: (kind: BlockKind) => void; kinds?: readonly BlockKind[] }) {
  const t = useTranslations("emailEditor.palette");
  return (
    <div role="menu" aria-label={t("title")} className="grid grid-cols-2 gap-1">
      {kinds.map((kind) => {
        const Glyph = KIND_ICONS[kind];
        return (
          <button
            key={kind}
            type="button"
            role="menuitem"
            onClick={() => onPick(kind)}
            className="flex items-center gap-2 rounded-[--radius] px-2 py-2 text-left text-sm text-foreground transition-colors hover:bg-[hsl(var(--accent-hover))] focus-visible:bg-[hsl(var(--accent-hover))] focus-visible:outline-none"
          >
            <Glyph className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{t(`kinds.${kind}.label`)}</span>
          </button>
        );
      })}
    </div>
  );
}
