"use client";

import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";

import Button from "@/components/elevated-design/button";
import { CircleNotch } from "@/components/icons";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Optional richer body (e.g. a hint box). */
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  loadingLabel?: string;
  loading?: boolean;
  /** Accent of the confirm button. Reversible actions stay neutral. */
  tone?: "primary" | "warning";
  icon?: ReactNode;
  onConfirm: () => void;
}

/**
 * A small, reusable confirmation for reversible phone actions (disconnect,
 * unassign). Destructive/irreversible removal has its own dedicated dialog with
 * a typed confirmation, this one is intentionally lighter.
 */
export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel,
  loadingLabel,
  loading = false,
  tone = "primary",
  icon,
  onConfirm,
}: ConfirmActionDialogProps) {
  return (
    <ElevatedDialog
      open={open}
      onOpenChange={(next) => {
        if (!loading) onOpenChange(next);
      }}
    >
      <ElevatedDialogContent className="max-w-md">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{title}</ElevatedDialogTitle>
          <ElevatedDialogDescription>{description}</ElevatedDialogDescription>
        </ElevatedDialogHeader>

        {children && <div className="py-2">{children}</div>}

        <div className="flex justify-end gap-3 pt-4">
          <Button
            variant="ghost"
            title={cancelLabel}
            onClick={() => onOpenChange(false)}
            disabled={loading}
          />
          <Button
            variant={tone === "warning" ? "outline" : "primary"}
            title={loading && loadingLabel ? loadingLabel : confirmLabel}
            icon={
              loading ? (
                <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />
              ) : (
                icon
              )
            }
            iconVisible={loading || !!icon}
            iconSide="left"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              tone === "warning" &&
                "border-warning/30 text-warning-ink hover:border-warning hover:bg-muted dark:border-warning dark:hover:bg-warning/30",
            )}
          />
        </div>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
