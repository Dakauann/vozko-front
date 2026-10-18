"use client";

import { useRef, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { groupedKinds, type VfxKind } from "@/lib/studio/vfx";
import { EFFECT_SAMPLE_SIZE } from "@/lib/studio/vfx-samples";
import { cn } from "@/lib/utils";

import { PLAIN_PREVIEW, useEffectThumbnails, type EffectThumbnails } from "../video/panels/effect-thumbnails";
import { VfxGlyph } from "../video/vfx-glyph";

const COLUMNS = 2;
const PREVIEW_DELAY_MS = 250;
const TILE = "[data-effect-tile]";

const STEPS: Record<string, (index: number, count: number) => number> = {
  ArrowRight: (index, count) => Math.min(count - 1, index + 1),
  ArrowLeft: (index) => Math.max(0, index - 1),
  ArrowDown: (index, count) => Math.min(count - 1, index + COLUMNS),
  ArrowUp: (index) => Math.max(0, index - COLUMNS),
  Home: () => 0,
  End: (_, count) => count - 1,
};

interface EffectTilesProps<K extends VfxKind> {
  kinds: readonly K[];
  label: string;
  tileLabel: (kind: K) => string;
  hint: (kind: K) => string;
  side: "left" | "right";
  disabled?: boolean;
  unavailable?: (kind: K) => string | null;
  onPick: (kind: K) => void;
}

function Picture({ src, role, kind }: { src: string; role: "before" | "after"; kind: VfxKind }) {
  return (
    <span
      aria-hidden
      {...(role === "after" ? { "data-studio-effect-preview": kind } : { "data-studio-effect-before": kind })}
      className="block aspect-video w-full bg-muted bg-cover bg-center"
      style={{ backgroundImage: `url(${src})` }}
    />
  );
}

function Pair({ kind, thumbnails }: { kind: VfxKind; thumbnails: EffectThumbnails | null }) {
  const before = thumbnails?.get(PLAIN_PREVIEW);
  const after = thumbnails?.get(kind);
  if (!before || !after) {
    return (
      <span aria-hidden className="flex aspect-[32/9] w-full items-center justify-center rounded-[calc(var(--radius)-2px)] bg-muted text-muted-foreground">
        <VfxGlyph kind={kind} />
      </span>
    );
  }
  return (
    <span aria-hidden className="grid w-full grid-cols-2 gap-px overflow-hidden rounded-[calc(var(--radius)-2px)] bg-border">
      <Picture src={before} role="before" kind={kind} />
      <Picture src={after} role="after" kind={kind} />
    </span>
  );
}

function Enlarged({ kind, name, hint, thumbnails }: { kind: VfxKind; name: string; hint: string; thumbnails: EffectThumbnails | null }) {
  const t = useTranslations("studio.video.vfx");
  const before = thumbnails?.get(PLAIN_PREVIEW);
  const after = thumbnails?.get(kind);
  return (
    <div className="space-y-2">
      {before && after ? (
        <div className="flex gap-2">
          {[
            { src: before, caption: t("before") },
            { src: after, caption: t("after") },
          ].map((entry) => (
            <figure key={entry.caption} className="space-y-1">
              <span aria-hidden className="block rounded-[calc(var(--radius)-2px)] bg-cover bg-center" style={{ width: EFFECT_SAMPLE_SIZE.width, height: EFFECT_SAMPLE_SIZE.height, backgroundImage: `url(${entry.src})` }} />
              <figcaption className="text-2xs text-muted-foreground">{entry.caption}</figcaption>
            </figure>
          ))}
        </div>
      ) : null}
      <div className="max-w-[24rem] space-y-0.5">
        <p className="text-xs font-medium text-popover-foreground">{name}</p>
        <p className="text-2xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

export function EffectTiles<K extends VfxKind>({ kinds, label, tileLabel, hint, side, disabled, unavailable, onPick }: EffectTilesProps<K>) {
  const t = useTranslations("studio.video.vfx");
  const thumbnails = useEffectThumbnails();
  const grid = useRef<HTMLDivElement>(null);
  const groups = groupedKinds(kinds);

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = STEPS[event.key];
    const tiles = Array.from(grid.current?.querySelectorAll<HTMLButtonElement>(TILE) ?? []);
    const index = tiles.findIndex((tile) => tile === document.activeElement);
    if (!step || index < 0) return;
    event.preventDefault();
    tiles[step(index, tiles.length)]?.focus();
  };

  const tile = (kind: K) => {
    const shown: VfxKind = kind;
    const name = t(`kinds.${shown}`);
    const reason = unavailable?.(kind) ?? null;
    return (
      <Tooltip key={kind} delayDuration={PREVIEW_DELAY_MS}>
        <TooltipTrigger asChild>
          <button
            type="button"
            data-effect-tile
            aria-label={tileLabel(kind)}
            aria-disabled={reason !== null || undefined}
            disabled={disabled}
            onClick={() => {
              if (reason === null) onPick(kind);
            }}
            className={cn(
              "flex min-w-0 flex-col gap-1 rounded-[--radius] border border-border bg-card p-1 text-left text-2xs font-medium text-foreground transition-colors",
              "hover:border-border-strong hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:pointer-events-none disabled:opacity-50",
              reason !== null && "cursor-not-allowed opacity-50 hover:border-border hover:bg-card",
            )}
          >
            <Pair kind={kind} thumbnails={thumbnails} />
            <span className="max-w-full truncate px-0.5">{name}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} align="start" className="border border-border-strong bg-popover p-2 text-popover-foreground shadow-md">
          <Enlarged kind={kind} name={name} hint={reason ?? hint(kind)} thumbnails={thumbnails} />
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <div ref={grid} role="group" aria-label={label} onKeyDown={move} className="space-y-2">
      {groups.map(({ group, kinds: members }) => (
        <section key={group} aria-label={t(`groups.${group}`)} className="space-y-1">
          {groups.length > 1 ? <h4 className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{t(`groups.${group}`)}</h4> : null}
          <div className="grid grid-cols-2 gap-1.5">{members.map(tile)}</div>
        </section>
      ))}
    </div>
  );
}
