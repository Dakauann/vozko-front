"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { DotsThree, PencilSimple } from "@/components/icons";
import { LeadCallMenuItem } from "@/components/leads/LeadCall";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMayPlaceCalls } from "@/hooks/use-call-readiness";

export interface LeadRowActionsProps {
  leadId: string;
  revision?: number;
  label: string;
  onEdit?: () => void;
}

export function LeadRowActions({ leadId, revision, label, onEdit }: LeadRowActionsProps) {
  const t = useTranslations("leadsPage.table");
  const mayCall = useMayPlaceCalls();
  if (!mayCall && !onEdit) return null;
  const name = label.trim();
  const menuLabel = name ? t("rowActions", { name }) : t("rowActionsUnnamed");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={menuLabel}
          icon={<DotsThree className="h-4 w-4" weight="bold" />}
          iconVisible
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {mayCall ? <LeadCallMenuItem leadId={leadId} revision={revision} /> : null}
        {onEdit ? (
          <DropdownMenuItem onSelect={onEdit}>
            <PencilSimple className="h-4 w-4" aria-hidden />
            {t("edit")}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
