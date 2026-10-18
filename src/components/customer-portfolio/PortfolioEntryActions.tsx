"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { ArrowSquareOut, ArrowsLeftRight, DotsThree, UserMinus } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { customerLines, type PortfolioRow } from "@/lib/customer-portfolio/portfolio";

import { usePortfolioCommands } from "./use-portfolio-commands";

export function PortfolioEntryActions({
  row,
  canMove,
  canRemove,
  onOpenLead,
  onMove,
}: {
  row: PortfolioRow;
  canMove: boolean;
  canRemove: boolean;
  onOpenLead?: () => void;
  onMove: () => void;
}) {
  const t = useTranslations("customerPortfolio");
  const { remove } = usePortfolioCommands();
  const [confirming, setConfirming] = useState(false);
  const name = customerLines(row).primary;
  if (!onOpenLead && !canMove && !canRemove) return null;

  return (
    <span className="contents" onClick={(event) => event.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("actions.menu", { name })} icon={<DotsThree className="h-4 w-4" weight="bold" />} iconVisible />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {onOpenLead ? (
            <DropdownMenuItem onSelect={onOpenLead}>
              <ArrowSquareOut className="h-4 w-4" aria-hidden />
              {t("actions.openLead")}
            </DropdownMenuItem>
          ) : null}
          {canMove ? (
            <DropdownMenuItem onSelect={onMove}>
              <ArrowsLeftRight className="h-4 w-4" aria-hidden />
              {t("actions.move")}
            </DropdownMenuItem>
          ) : null}
          {canRemove ? (
            <>
              {onOpenLead || canMove ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem onSelect={() => setConfirming(true)} className="text-destructive-ink">
                <UserMinus className="h-4 w-4" aria-hidden />
                {t("actions.remove")}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("confirm.removeTitle", { name })}
        description={t("confirm.removeDescription")}
        confirmLabel={t("confirm.removeConfirm")}
        cancelLabel={t("confirm.cancel")}
        onConfirm={() => remove(row.id)}
      />
    </span>
  );
}
