"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Info, Trash, CircleNotch } from "@/components/icons";

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
import { cn } from "@/lib/utils";

type ConfirmTone = "danger" | "default";

export interface ConfirmDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;

  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | boolean | Promise<void | boolean>;
  tone?: ConfirmTone;
  icon?: React.ReactNode;
  confirmDisabled?: boolean;
  children?: React.ReactNode;
}

export function ConfirmDialog({
  trigger,
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  tone = "danger",
  icon,
  confirmDisabled = false,
  children,
}: ConfirmDialogProps) {
  const t = useTranslations("common");
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
    confirmLabel ?? (danger ? t("delete") : t("confirm"));
  const resolvedCancelLabel = cancelLabel ?? t("cancel");
  const TileIcon = danger ? Trash : Info;

  const handleConfirm = async () => {
    try {
      setBusy(true);
      const keepOpen = (await onConfirm()) === false;
      setBusy(false);
      if (!keepOpen) setOpen(false);
    } catch {
      setBusy(false);
    }
  };

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(next) => {
        if (!busy) setOpen(next);
      }}
    >
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent className="max-w-md gap-0 overflow-hidden rounded-[--radius] p-0 sm:rounded-[--radius]">
        <div className="flex justify-center px-6 pt-6">
          <div
            aria-hidden="true"
            className={cn(
              "grid h-14 w-14 place-items-center",
              danger ? "tile-fault" : "tile-info",
            )}
          >
            {icon ?? <TileIcon size={28} />}
          </div>
        </div>

        <div className="space-y-4 p-6 pt-4">
          <div className="space-y-1.5 text-center">
            <AlertDialogTitle className="text-lg font-semibold">
              {title}
            </AlertDialogTitle>
            {description && (
              <AlertDialogDescription className="text-sm leading-relaxed">
                {description}
              </AlertDialogDescription>
            )}
          </div>

          {children}

          <AlertDialogFooter className="flex-row gap-2.5 sm:justify-stretch sm:space-x-0">
            <AlertDialogCancel
              disabled={busy}
              className="mt-0 flex-1 rounded-[--radius]"
            >
              {resolvedCancelLabel}
            </AlertDialogCancel>
            <button
              type="button"
              disabled={busy || confirmDisabled}
              onClick={() => void handleConfirm()}
              className={cn(
                buttonVariants(),
                "flex-1 gap-2 rounded-[--radius]",
                danger &&
                  "bg-destructive text-destructive-foreground hover:bg-destructive focus-visible:ring-destructive",
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
