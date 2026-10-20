"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";

import { ArrowsLeftRight, Bookmark, MagnifyingGlass, Tag as TagIcon } from "@/components/icons";
import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import type { InboxEntryLabel, Label } from "@/lib/conversations/types";
import { stateTransition } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";

const ROUND_CONTROL = "flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-colors";

const MENU_MOTION = {
  initial: { opacity: 0, y: -8, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.95 },
  transition: stateTransition,
};

export interface StageChoice {
  id: string;
  name: string;
  color: string;
}

function ControlMenu({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <motion.div
        {...MENU_MOTION}
        className="absolute left-0 top-full z-40 mt-2 w-48 rounded-[--radius] border border-border bg-card shadow-xl py-1.5 overflow-hidden"
      >
        <div className="px-3 py-1.5 text-2xs font-semibold text-muted-foreground ">{title}</div>
        {children}
      </motion.div>
    </>
  );
}

function DisabledControl({ hint, children }: { hint: string; children: ReactNode }) {
  return (
    <TooltipWrapper content={hint} enabled side="right">
      <button type="button" disabled className={cn(ROUND_CONTROL, "bg-card text-muted-foreground cursor-not-allowed")}>
        {children}
      </button>
    </TooltipWrapper>
  );
}

export function StageControl({
  choices,
  currentStageId,
  hasStages,
  canMove,
  canMoveAcrossFunnels,
  noPermissionHint,
  onMove,
  onMoveAcrossFunnels,
}: {
  choices: StageChoice[];
  currentStageId: string | null;
  hasStages: boolean;
  canMove: boolean;
  canMoveAcrossFunnels: boolean;
  noPermissionHint: string;
  onMove: (stageId: string) => void;
  onMoveAcrossFunnels: () => void;
}) {
  const t = useTranslations("crmConversation.thread.stage");
  const [open, setOpen] = useState(false);

  if (!canMove) {
    return (
      <DisabledControl hint={noPermissionHint}>
        <TagIcon weight="bold" className="h-5 w-5" />
      </DisabledControl>
    );
  }

  return (
    <div className="relative">
      <motion.button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(ROUND_CONTROL, open ? "bg-healthy text-healthy-foreground" : "bg-card text-muted-foreground hover:bg-muted")}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title={hasStages ? t("moveToOtherStage") : t("stages")}
      >
        <TagIcon weight={open ? "fill" : "bold"} className="h-5 w-5" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <ControlMenu title={t("moveTo")} onClose={() => setOpen(false)}>
            <div className="max-h-64 overflow-y-auto">
              {choices.map((choice) => {
                const isCurrent = choice.id === currentStageId;
                return (
                  <button
                    type="button"
                    key={choice.id}
                    onClick={() => {
                      if (!isCurrent) onMove(choice.id);
                      setOpen(false);
                    }}
                    disabled={isCurrent}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors",
                      isCurrent ? "text-muted-foreground cursor-not-allowed bg-muted" : "text-foreground hover:bg-muted",
                    )}
                  >
                    <span className="h-3 w-3 rounded-full ring-1 ring-black/10 flex-shrink-0" style={{ backgroundColor: choice.color }} />
                    <span className="text-xs font-medium truncate flex-1">{choice.name}</span>
                    {isCurrent && <span className="text-2xs text-muted-foreground flex-shrink-0">{t("current")}</span>}
                  </button>
                );
              })}
            </div>

            {canMoveAcrossFunnels ? (
              <>
                <div className="my-1 border-t border-border" />
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onMoveAcrossFunnels();
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <ArrowsLeftRight weight="bold" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{t("moveToOtherFunnel")}</span>
                </button>
              </>
            ) : null}
          </ControlMenu>
        )}
      </AnimatePresence>
    </div>
  );
}

export function LabelControl({
  labels,
  assigned,
  canAssign,
  onToggle,
}: {
  labels: Label[];
  assigned: InboxEntryLabel[];
  canAssign: boolean;
  onToggle: (labelId: string, isAssigned: boolean) => void;
}) {
  const t = useTranslations("crmConversation.thread.labels");
  const [open, setOpen] = useState(false);

  if (!canAssign) {
    return (
      <DisabledControl hint={t("noPermission")}>
        <Bookmark weight="bold" className="h-5 w-5" />
      </DisabledControl>
    );
  }

  return (
    <div className="relative">
      <motion.button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(ROUND_CONTROL, open ? "bg-muted text-muted-foreground" : "bg-card text-muted-foreground hover:bg-muted")}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title={t("title")}
      >
        <Bookmark weight={open ? "fill" : "bold"} className="h-5 w-5" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <ControlMenu title={t("title")} onClose={() => setOpen(false)}>
            <div className="max-h-64 overflow-y-auto">
              {labels.map((label) => {
                const isAssigned = assigned.some((entryLabel) => entryLabel.label_id === label.id);
                return (
                  <button
                    type="button"
                    key={label.id}
                    onClick={() => onToggle(label.id, isAssigned)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors text-foreground hover:bg-muted"
                  >
                    <span
                      className="h-3 w-3 rounded-full ring-1 ring-black/10 flex-shrink-0"
                      style={{ backgroundColor: label.color || "hsl(var(--plate-5))" }}
                    />
                    <span className="text-xs font-medium truncate flex-1">{label.name}</span>
                    {isAssigned && <span className="text-2xs text-chart-4 flex-shrink-0">✓</span>}
                  </button>
                );
              })}
            </div>
          </ControlMenu>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SearchTrigger({ label, onOpen }: { label: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={label}
      aria-label={label}
      className={cn(ROUND_CONTROL, "border border-border bg-card text-muted-foreground hover:bg-muted")}
    >
      <MagnifyingGlass weight="bold" className="h-4 w-4" />
    </button>
  );
}
