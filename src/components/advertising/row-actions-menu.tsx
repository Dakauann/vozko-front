"use client";

import { useTranslations } from "next-intl";

import { Archive, Copy, DotsThreeVertical, PencilSimple, PlusCircle, Trash } from "@/components/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/routing";
import { wizardHref } from "@/lib/advertising/connect";
import type { AdRow } from "@/lib/advertising/types";

export interface RowActionPermissions {
  canUpdate: boolean;
  canCreate: boolean;
  canDelete: boolean;
}

export type RowAction = "edit" | "duplicate" | "archive" | "delete";

function isRemoved(row: AdRow): boolean {
  return row.status === "DELETED" || row.effectiveStatus === "DELETED";
}

function isArchived(row: AdRow): boolean {
  return row.status === "ARCHIVED" || row.effectiveStatus === "ARCHIVED" || isRemoved(row);
}

export function RowActionsMenu({
  row,
  accountId,
  permissions,
  busy,
  onAction,
}: {
  row: AdRow;
  accountId: string;
  permissions: RowActionPermissions;
  busy: boolean;
  onAction: (action: RowAction, row: AdRow) => void;
}) {
  const t = useTranslations("adsManager.rowActions");
  const { canUpdate, canCreate, canDelete } = permissions;
  const childHref =
    row.level === "campaign"
      ? wizardHref({ accountId, campaignId: row.metaId })
      : row.level === "adset"
        ? wizardHref({ accountId, adSetId: row.metaId })
        : null;

  if (!canUpdate && !canCreate && !canDelete) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(event) => event.stopPropagation()}
          disabled={busy}
          aria-label={t("open", { name: row.name })}
          className="inline-flex h-8 w-8 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <DotsThreeVertical className="h-4 w-4" weight="bold" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52" onClick={(event) => event.stopPropagation()}>
        {canUpdate ? (
          <DropdownMenuItem disabled={isArchived(row)} onSelect={() => onAction("edit", row)}>
            <PencilSimple className="mr-2 h-4 w-4" aria-hidden />
            {t("edit")}
          </DropdownMenuItem>
        ) : null}
        {canCreate ? (
          <DropdownMenuItem disabled={isRemoved(row)} onSelect={() => onAction("duplicate", row)}>
            <Copy className="mr-2 h-4 w-4" aria-hidden />
            {t("duplicate")}
          </DropdownMenuItem>
        ) : null}
        {canCreate && childHref && !isArchived(row) ? (
          <DropdownMenuItem asChild>
            <Link href={childHref}>
              <PlusCircle className="mr-2 h-4 w-4" aria-hidden />
              {t(row.level === "campaign" ? "addAdSet" : "addAd")}
            </Link>
          </DropdownMenuItem>
        ) : null}
        {canUpdate || canDelete ? <DropdownMenuSeparator /> : null}
        {canUpdate ? (
          <DropdownMenuItem disabled={isArchived(row)} onSelect={() => onAction("archive", row)}>
            <Archive className="mr-2 h-4 w-4" aria-hidden />
            {t("archive")}
          </DropdownMenuItem>
        ) : null}
        {canDelete ? (
          <DropdownMenuItem disabled={isRemoved(row)} onSelect={() => onAction("delete", row)} className="text-destructive-ink focus:text-destructive-ink">
            <Trash className="mr-2 h-4 w-4" aria-hidden />
            {t("delete")}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
