"use client";

import * as React from "react";
import { Warning, Trash, CircleNotch } from "@/components/icons";

import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import GrainBackground, {
  type ColorGroup,
} from "@/components/elevated-design/grain-background";
import { cn } from "@/lib/utils";

type ConfirmTone = "danger" | "default";

// Seeded grain palettes for the header band. Danger runs deep rose so the modal
// reads as consequential the instant it opens; default carries the Signal Blue.
const DANGER_PALETTE: ColorGroup[] = [
  { colors: ["#fb7185", "#f43f5e"], weight: 40 },
  { colors: ["#f43f5e", "#e11d48"], weight: 30 },
  { colors: ["#e11d48", "#be123c"], weight: 20 },
  { colors: ["#be123c", "#9f1239"], weight: 10 },
];
const DEFAULT_PALETTE: ColorGroup[] = [
  { colors: ["#3b82f6", "#2563eb"], weight: 40 },
  { colors: ["#2563eb", "#1d4ed8"], weight: 30 },
  { colors: ["#1d4ed8", "#1e40af"], weight: 20 },
  { colors: ["#1e40af", "#1e3a8a"], weight: 10 },
];

export interface ConfirmDialogProps {
  /** Uncontrolled usage: the element that opens the dialog (wrapped as the
   *  trigger). Omit when driving `open`/`onOpenChange` yourself. */
  trigger?: React.ReactNode;
  /** Controlled open state. Omit to let the trigger manage it. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;

  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /**
   * Runs on confirm. If it returns a promise the buttons show a busy state and
   * the dialog stays open until it settles, closing on success and staying open
   * (so the user can retry) if it throws.
   */
  onConfirm: () => void | Promise<void>;
  /** "danger" (default) is destructive: rose grain header + rose confirm button. */
  tone?: ConfirmTone;
  /** Overrides the default tone icon inside the header medallion. */
  icon?: React.ReactNode;
  /** Disables confirm (e.g. a "type the name to confirm" gate). */
  confirmDisabled?: boolean;
}

/**
 * The single confirmation modal for destructive and other consequential actions.
 * Built on the AlertDialog primitive (accessible, escapes any stacking context)
 * with a grainy gradient header that mirrors the feature dialog and signals the
 * danger. Reuse it everywhere instead of hand-rolling an AlertDialog per site.
 */
export function ConfirmDialog({
  trigger,
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  onConfirm,
  tone = "danger",
  icon,
  confirmDisabled = false,
}: ConfirmDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const danger = tone === "danger";
  const resolvedConfirmLabel =
    confirmLabel ?? (danger ? "Excluir" : "Confirmar");
  const TileIcon = danger ? Trash : Warning;

  const handleConfirm = async () => {
    try {
      setBusy(true);
      await onConfirm();
      setBusy(false);
      setOpen(false);
    } catch {
      // Keep the dialog open on failure so the user can retry; the caller is
      // responsible for surfacing the error (e.g. a toast).
      setBusy(false);
    }
  };

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(next) => {
        // Don't let an outside click / Escape close the modal mid-action.
        if (!busy) setOpen(next);
      }}
    >
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent className="max-w-md gap-0 overflow-hidden rounded-[--radius] p-0 sm:rounded-[--radius]">
        {/* Grainy gradient header with a floating medallion icon. */}
        <div className="relative h-28 w-full overflow-hidden">
          <GrainBackground
            palette={danger ? DANGER_PALETTE : DEFAULT_PALETTE}
            seed={danger ? 13 : 50}
            mode="islands"
            islandsScale={0.01}
            islandsElongation={0.9}
            islandsWarp={10}
            islandsBlur={2}
            opacity={0.22}
            className="h-full !rounded-none"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-white/10" />
          <div className="absolute inset-0 grid place-items-center">
            <div className="grid h-16 w-16 place-items-center rounded-[--radius] bg-white/15 shadow-lg ring-1 ring-white/25">
              {icon ?? (
                <TileIcon
                  size={30}
                  weight="fill"
                  className="text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.35)]"
                />
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4 p-6">
          <div className="space-y-1.5 text-center">
            <AlertDialogTitle className="text-lg font-semibold tracking-tight">
              {title}
            </AlertDialogTitle>
            {description && (
              <AlertDialogDescription className="text-sm leading-relaxed">
                {description}
              </AlertDialogDescription>
            )}
          </div>

          <AlertDialogFooter className="flex-row gap-2.5 sm:justify-stretch sm:space-x-0">
            <AlertDialogCancel
              disabled={busy}
              className="mt-0 flex-1 rounded-[--radius]"
            >
              {cancelLabel}
            </AlertDialogCancel>
            <button
              type="button"
              disabled={busy || confirmDisabled}
              onClick={() => void handleConfirm()}
              className={cn(
                buttonVariants(),
                "flex-1 gap-2 rounded-[--radius]",
                danger &&
                  "bg-destructive text-white hover:bg-destructive focus-visible:ring-rose-500",
              )}
            >
              {busy && (
                <CircleNotch size={15} weight="bold" className="animate-spin" />
              )}
              {resolvedConfirmLabel}
            </button>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
