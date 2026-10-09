"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { DotsThree, DownloadSimple, Plus, Sliders, UploadSimple } from "@/components/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LeadView } from "@/lib/leads/map-view";

import { LeadViewToggle } from "./LeadViewToggle";

export interface LeadsHeaderActionsProps {
  view: LeadView;
  showViewToggle: boolean;
  onViewChange: (view: LeadView) => void;
  canCreate: boolean;
  canManageFields: boolean;
  imports?: ReactNode;
  onCreate: () => void;
  onImport: () => void;
  onDownloadTemplate: () => void;
  onManageFields: () => void;
}

const MENU_ITEM = "flex cursor-pointer items-center gap-2.5";

export function LeadsHeaderActions({
  view,
  showViewToggle,
  onViewChange,
  canCreate,
  canManageFields,
  imports,
  onCreate,
  onImport,
  onDownloadTemplate,
  onManageFields,
}: LeadsHeaderActionsProps) {
  const t = useTranslations("leadsPage");
  const hasMenu = canCreate || canManageFields;

  return (
    <div className="flex flex-wrap items-center gap-1.5 max-sm:max-w-[calc(100vw-1.5rem)]">
      {showViewToggle ? <LeadViewToggle value={view} onChange={onViewChange} /> : null}
      {canCreate ? imports : null}
      {canCreate ? (
        <Button variant="primary" icon={<Plus weight="bold" />} iconVisible title={t("header.newLead")} onClick={onCreate} />
      ) : null}
      {hasMenu ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button icon={<DotsThree className="h-4 w-4" weight="bold" />} iconVisible aria-label={t("header.moreActions")} variant="command" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[13rem]">
            {canCreate ? (
              <>
                <DropdownMenuItem onSelect={onImport} className={MENU_ITEM}>
                  <UploadSimple className="h-4 w-4 shrink-0" weight="bold" aria-hidden="true" />
                  <span className="text-sm">{t("import.action")}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onDownloadTemplate} className={MENU_ITEM}>
                  <DownloadSimple className="h-4 w-4 shrink-0" weight="bold" aria-hidden="true" />
                  <span className="text-sm">{t("import.template")}</span>
                </DropdownMenuItem>
              </>
            ) : null}
            {canCreate && canManageFields ? <DropdownMenuSeparator /> : null}
            {canManageFields ? (
              <DropdownMenuItem onSelect={onManageFields} className={MENU_ITEM}>
                <Sliders className="h-4 w-4 shrink-0" weight="bold" aria-hidden="true" />
                <span className="text-sm">{t("header.fields")}</span>
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
