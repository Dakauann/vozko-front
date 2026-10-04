"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import {
  Archive,
  ClockCounterClockwise,
  Copy,
  DotsThree,
  Image as ImageGlyph,
  PaperPlaneTilt,
  PencilSimple,
  PlusCircle,
  Trash,
} from "@/components/icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/routing";
import { objectEditorHref } from "@/lib/advertising/connect";
import type { TableRow } from "@/lib/advertising/manager-drafts";
import {
  addChildState,
  archiveState,
  deleteState,
  duplicateState,
  editState,
  forRow,
  isOffered,
  publishState,
  type ActionState,
  type ToolbarContext,
} from "@/lib/advertising/manager-toolbar";

import type { BlockerText } from "./manager/use-blocker-text";

export type RowAction = "insights" | "edit" | "duplicate" | "archive" | "delete" | "addChild" | "publish" | "jobs";

function MenuEntry({
  state,
  icon,
  label,
  danger,
  blockerText,
  onSelect,
}: {
  state: ActionState;
  icon: ReactNode;
  label: string;
  danger?: boolean;
  blockerText: BlockerText;
  onSelect: () => void;
}) {
  if (!isOffered(state)) return null;
  const reason = blockerText(state);
  return (
    <DropdownMenuItem
      disabled={!state.enabled}
      onSelect={onSelect}
      className={danger ? "items-start text-destructive-ink focus:text-destructive-ink" : "items-start"}
    >
      <span className="mr-2 mt-0.5 shrink-0">{icon}</span>
      <span className="flex min-w-0 flex-col">
        {label}
        {reason ? <span className="text-2xs font-normal text-muted-foreground">{reason}</span> : null}
      </span>
    </DropdownMenuItem>
  );
}

export function RowActionsMenu({
  row,
  accountId,
  context,
  busy,
  blockerText,
  onAction,
}: {
  row: TableRow;
  accountId: string;
  context: ToolbarContext;
  busy: boolean;
  blockerText: BlockerText;
  onAction: (action: RowAction, row: TableRow) => void;
}) {
  const t = useTranslations("adsManager.rowActions");
  const single = forRow(context, row);
  const edit = editState(single);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(event) => event.stopPropagation()}
          disabled={busy}
          aria-label={t("open", { name: row.name })}
          className="inline-flex h-7 w-7 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <DotsThree className="h-4 w-4" weight="bold" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60" onClick={(event) => event.stopPropagation()}>
        {row.draft ? (
          <MenuEntry
            state={publishState(single)}
            icon={<PaperPlaneTilt className="h-4 w-4" aria-hidden />}
            label={t("publish")}
            blockerText={blockerText}
            onSelect={() => onAction("publish", row)}
          />
        ) : null}
        <MenuEntry
          state={edit}
          icon={<PencilSimple className="h-4 w-4" aria-hidden />}
          label={t("edit")}
          blockerText={blockerText}
          onSelect={() => onAction("edit", row)}
        />
        {!row.draft && row.level === "ad" && edit.enabled ? (
          <DropdownMenuItem asChild>
            <Link href={objectEditorHref(accountId, row.metaId)}>
              <ImageGlyph className="mr-2 h-4 w-4" aria-hidden />
              {t("swapCreative")}
            </Link>
          </DropdownMenuItem>
        ) : null}
        <MenuEntry
          state={duplicateState(single)}
          icon={<Copy className="h-4 w-4" aria-hidden />}
          label={t("duplicate")}
          blockerText={blockerText}
          onSelect={() => onAction("duplicate", row)}
        />
        <MenuEntry
          state={addChildState(single)}
          icon={<PlusCircle className="h-4 w-4" aria-hidden />}
          label={t(row.level === "campaign" ? "addAdSet" : "addAd")}
          blockerText={blockerText}
          onSelect={() => onAction("addChild", row)}
        />
        <DropdownMenuItem onSelect={() => onAction("jobs", row)}>
          <ClockCounterClockwise className="mr-2 h-4 w-4" aria-hidden />
          {t("history")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <MenuEntry
          state={archiveState(single)}
          icon={<Archive className="h-4 w-4" aria-hidden />}
          label={t("archive")}
          blockerText={blockerText}
          onSelect={() => onAction("archive", row)}
        />
        <MenuEntry
          state={deleteState(single)}
          icon={<Trash className="h-4 w-4" aria-hidden />}
          label={row.draft ? t("deleteDraft") : t("delete")}
          danger
          blockerText={blockerText}
          onSelect={() => onAction("delete", row)}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
