"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { ArrowDown, ArrowUp, Eye, EyeSlash, Shuffle, Trash } from "@/components/icons";
import { randomSeed, usesSeed, type Vfx } from "@/lib/studio/vfx";
import type { VfxPatch } from "@/lib/studio/vfx-edit";
import { cn } from "@/lib/utils";

import { ToolButton } from "../video/tool-button";
import { VfxGlyph } from "../video/vfx-glyph";

const SLIDER_STEPS = 100;

export function sliderStep([low, high]: readonly [number, number]): { step: number; decimals: number } {
  const exponent = Math.floor(Math.log10((high - low) / SLIDER_STEPS));
  return { step: 10 ** exponent, decimals: Math.max(0, -exponent) };
}

interface OpenVfx {
  open: Vfx | null;
  openIndex: number;
  setOpenId: (id: string | null) => void;
}

export function useOpenVfx(list: readonly Vfx[]): OpenVfx {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = list.find((vfx) => vfx.id === openId) ?? list.at(-1) ?? null;
  return { open, openIndex: open ? list.indexOf(open) : -1, setOpenId };
}

interface VfxRowsProps {
  list: readonly Vfx[];
  open: Vfx | null;
  label: string;
  onOpen: (id: string) => void;
}

export function VfxRows({ list, open, label, onOpen }: VfxRowsProps) {
  const t = useTranslations("studio.video.vfx");
  return (
    <ul className="space-y-0.5" aria-label={label}>
      {list.map((vfx, index) => (
        <li key={vfx.id}>
          <button
            type="button"
            aria-pressed={vfx === open}
            onClick={() => onOpen(vfx.id)}
            className={cn(
              "flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              vfx === open ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              vfx.hidden && "opacity-60",
            )}
          >
            <VfxGlyph kind={vfx.kind} className="h-3.5 w-4" />
            <span className="min-w-0 flex-1 truncate">{t("item", { index: index + 1, kind: t(`kinds.${vfx.kind}`) })}</span>
            {vfx.hidden ? <span className="text-2xs text-muted-foreground">{t("hiddenTag")}</span> : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

interface VfxActionsProps {
  vfx: Vfx;
  disabled: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onPatch: (patch: VfxPatch) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}

export function VfxActions({ vfx, disabled, canMoveUp, canMoveDown, onPatch, onMove, onRemove }: VfxActionsProps) {
  const t = useTranslations("studio.video.vfx");
  return (
    <div className="flex items-center justify-end gap-0.5">
      {usesSeed(vfx.kind) ? <ToolButton size="sm" label={t("shuffle")} icon={<Shuffle className="h-3.5 w-3.5" />} disabled={disabled} onClick={() => onPatch({ seed: randomSeed() })} /> : null}
      <ToolButton
        size="sm"
        label={vfx.hidden ? t("show") : t("hide")}
        icon={vfx.hidden ? <EyeSlash className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        disabled={disabled}
        onClick={() => onPatch({ hidden: !vfx.hidden })}
      />
      <ToolButton size="sm" label={t("moveUp")} icon={<ArrowUp className="h-3.5 w-3.5" />} disabled={disabled || !canMoveUp} onClick={() => onMove(-1)} />
      <ToolButton size="sm" label={t("moveDown")} icon={<ArrowDown className="h-3.5 w-3.5" />} disabled={disabled || !canMoveDown} onClick={() => onMove(1)} />
      <ToolButton size="sm" label={t("remove")} icon={<Trash className="h-3.5 w-3.5" />} disabled={disabled} onClick={onRemove} />
    </div>
  );
}
