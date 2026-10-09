"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogBody,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { CaretDown } from "@/components/icons";
import { SELECTION_LINK } from "@/components/selection/SelectionCount";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { parseTypedCount } from "@/lib/leads/bulk-selection";

export function LeadSelectionModes({
  quantityReason,
  sortLabel,
  onQuantity,
  onEveryone,
}: {
  quantityReason: string | null;
  sortLabel: string;
  onQuantity: (limit: number) => void;
  onEveryone: () => void;
}) {
  const t = useTranslations("leadsPage.selection");
  const [asking, setAsking] = useState(false);
  const [typed, setTyped] = useState("");
  const limit = parseTypedCount(typed);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={SELECTION_LINK}>
            {t("modes")}
            <CaretDown className="h-3 w-3" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuItem disabled={quantityReason !== null} onSelect={() => setAsking(true)}>
            <span className="flex flex-col">
              {t("quantity")}
              {quantityReason ? <span className="text-2xs text-muted-foreground">{quantityReason}</span> : null}
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onEveryone}>
            <span className="flex flex-col">
              {t("everyone")}
              <span className="text-2xs text-muted-foreground">{t("everyoneHint")}</span>
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {asking ? (
        <ElevatedDialog open onOpenChange={(open) => !open && setAsking(false)}>
          <ElevatedDialogContent className="max-w-sm">
            <ElevatedDialogHeader>
              <ElevatedDialogTitle>{t("quantityTitle")}</ElevatedDialogTitle>
              <ElevatedDialogDescription>{t("quantityHint", { sort: sortLabel })}</ElevatedDialogDescription>
            </ElevatedDialogHeader>
            <ElevatedDialogBody>
              <ElevatedInput
                label={t("quantityLabel")}
                placeholder=" "
                inputMode="numeric"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
              />
            </ElevatedDialogBody>
            <ElevatedDialogFooter>
              <Button variant="secondary" title={t("cancel")} onClick={() => setAsking(false)} />
              <Button
                variant="primary"
                title={t("quantityApply")}
                disabled={limit === null}
                onClick={() => {
                  if (limit === null) return;
                  onQuantity(limit);
                  setAsking(false);
                  setTyped("");
                }}
              />
            </ElevatedDialogFooter>
          </ElevatedDialogContent>
        </ElevatedDialog>
      ) : null}
    </>
  );
}
