"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useStore } from "zustand";

import { EloMark } from "@/components/ai-chat/elo-mark";
import { useLookTargetText } from "@/components/ai-chat/look-step";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { ANCHOR_INSET, useAnchorRect } from "./anchor-rect";
import type { LookShot, LookShots } from "./look-shots";

export const SHOT_VISIBLE_MS = 6000;

interface LookShotPeekProps {
  shots: LookShots;
  anchor: string;
  reduceMotion: boolean;
}

function useFreshShot(shots: LookShots, paused: boolean): number | null {
  const [freshId, setFreshId] = useState<number | null>(null);

  useEffect(
    () =>
      shots.store.subscribe((state, previous) => {
        const latest = state.shots[0];
        if (latest && latest !== previous.shots[0]) setFreshId(latest.id);
      }),
    [shots],
  );

  useEffect(() => {
    if (freshId === null || paused) return;
    const timer = setTimeout(() => setFreshId(null), SHOT_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [freshId, paused]);

  return freshId;
}

interface ShotDialogProps {
  shots: readonly LookShot[];
  selected: LookShot;
  open: boolean;
  onPick: (id: number) => void;
  onClose: () => void;
}

function ShotDialog({ shots, selected, open, onPick, onClose }: ShotDialogProps) {
  const t = useTranslations("studio.agent.seen");
  const text = useLookTargetText();
  const what = text(selected.target);
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="max-w-[min(92vw,72rem)] gap-3 p-4 motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:animate-none">
        <div className="space-y-1 pr-8">
          <DialogTitle className="text-base">{t("title")}</DialogTitle>
          <DialogDescription className="truncate">{t("description", { target: what })}</DialogDescription>
        </div>
        <Image src={selected.image} alt={what} unoptimized draggable={false} width={1568} height={1568} className="h-auto max-h-[72vh] w-full rounded-md bg-muted object-contain" />
        {shots.length > 1 ? (
          <div role="group" aria-label={t("recent")} className="flex gap-2">
            {shots.map((shot) => {
              const current = shot.id === selected.id;
              return (
                <button
                  key={shot.id}
                  type="button"
                  aria-pressed={current}
                  aria-label={t("pick", { target: text(shot.target) })}
                  onClick={() => onPick(shot.id)}
                  className={cn(
                    "h-14 w-24 overflow-hidden rounded-md border bg-muted transition-colors duration-DEFAULT focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    current ? "border-primary ring-1 ring-primary" : "border-border hover:border-border-strong",
                  )}
                >
                  <Image src={shot.image} alt="" unoptimized draggable={false} width={96} height={56} className="h-full w-full object-contain" />
                </button>
              );
            })}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function LookShotPeek({ shots, anchor, reduceMotion }: LookShotPeekProps) {
  const t = useTranslations("studio.agent.seen");
  const text = useLookTargetText();
  const list = useStore(shots.store, (state) => state.shots);
  const rect = useAnchorRect(anchor);
  const [held, setHeld] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const open = openId !== null;
  const freshId = useFreshShot(shots, held || open);
  const latest = list[0];
  if (!latest) return null;
  const shown = freshId === latest.id;
  const selected = list.find((shot) => shot.id === openId) ?? latest;
  const placement: CSSProperties | undefined = rect ? { top: rect.bottom - ANCHOR_INSET, left: rect.right - ANCHOR_INSET, transform: "translate(-100%, -100%)" } : undefined;

  return (
    <>
      <button
        type="button"
        aria-label={t("open", { target: text(latest.target) })}
        aria-hidden={shown ? undefined : true}
        inert={!shown}
        title={t("label")}
        onClick={() => setOpenId(latest.id)}
        onPointerEnter={() => setHeld(true)}
        onPointerLeave={() => setHeld(false)}
        onFocus={() => setHeld(true)}
        onBlur={() => setHeld(false)}
        style={{ ...placement, transition: reduceMotion ? "none" : "opacity 280ms cubic-bezier(0.22, 1, 0.36, 1), filter 280ms cubic-bezier(0.22, 1, 0.36, 1), visibility 280ms" }}
        className={cn(
          "fixed z-[56] w-36 overflow-hidden rounded-lg border border-border-strong bg-card text-left shadow-md hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          !rect && "bottom-4 right-4",
          shown ? "visible opacity-100 blur-0" : "pointer-events-none invisible opacity-0 blur-[2px]",
        )}
      >
        <Image src={latest.image} alt="" unoptimized draggable={false} width={144} height={81} className="block aspect-video w-full bg-muted object-contain" />
        <span className="flex items-center gap-1.5 px-2 py-1 text-2xs text-muted-foreground">
          <EloMark className="h-3 w-3 shrink-0" />
          <span className="truncate">{text(latest.target)}</span>
        </span>
      </button>
      <ShotDialog shots={list} selected={selected} open={open} onPick={setOpenId} onClose={() => setOpenId(null)} />
    </>
  );
}
