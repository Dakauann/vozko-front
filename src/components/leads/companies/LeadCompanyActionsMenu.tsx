"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { deleteLeadCompanyAction } from "@/app/actions/lead-companies";
import Button from "@/components/elevated-design/button";
import { DotsThree, PencilSimple, Trash, UsersThree } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useRefreshLeadCompanies } from "@/hooks/use-lead-companies";
import type { LeadCompany } from "@/lib/leads/companies";

import { useCompanyError } from "./use-company-error";

export function LeadCompanyActionsMenu({
  company,
  canEdit,
  canDelete,
  onEdit,
  onMembers,
}: {
  company: LeadCompany;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onMembers: () => void;
}) {
  const t = useTranslations("leadCompanies");
  const errorText = useCompanyError();
  const refresh = useRefreshLeadCompanies();
  const [confirming, setConfirming] = useState(false);

  const remove = async (): Promise<boolean> => {
    const answer = await deleteLeadCompanyAction(company.id);
    if (answer.error) {
      toast.error(errorText(answer.error));
      return false;
    }
    await refresh();
    toast.success(t("actions.deleted"));
    return true;
  };

  return (
    <span className="contents" onClick={(event) => event.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("actions.menu", { name: company.name })} icon={<DotsThree className="h-4 w-4" weight="bold" />} iconVisible />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={onMembers}>
            <UsersThree className="h-4 w-4" aria-hidden />
            {t("actions.members")}
          </DropdownMenuItem>
          {canEdit ? (
            <DropdownMenuItem onSelect={onEdit}>
              <PencilSimple className="h-4 w-4" aria-hidden />
              {t("actions.edit")}
            </DropdownMenuItem>
          ) : null}
          {canDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setConfirming(true)} className="text-destructive-ink">
                <Trash className="h-4 w-4" aria-hidden />
                {t("actions.delete")}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("confirm.deleteTitle", { name: company.name })}
        description={t("confirm.deleteDescription")}
        confirmLabel={t("confirm.deleteConfirm")}
        cancelLabel={t("confirm.cancel")}
        onConfirm={remove}
      />
    </span>
  );
}
