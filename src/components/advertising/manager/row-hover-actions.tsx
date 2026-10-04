"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { ChartLine, Copy, PaperPlaneTilt, PencilSimple } from "@/components/icons";
import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import type { TableRow } from "@/lib/advertising/manager-drafts";
import {
  duplicateState,
  editState,
  forRow,
  insightsState,
  isOffered,
  publishState,
  type ActionState,
  type ToolbarContext,
} from "@/lib/advertising/manager-toolbar";

import type { RowAction } from "../row-actions-menu";
import type { BlockerText } from "./use-blocker-text";

function HoverAction({
  state,
  icon,
  label,
  blockerText,
  onClick,
}: {
  state: ActionState;
  icon: ReactNode;
  label: string;
  blockerText: BlockerText;
  onClick: () => void;
}) {
  if (!isOffered(state)) return null;
  const reason = blockerText(state);
  return (
    <TooltipWrapper content={reason ?? ""} enabled={!!reason}>
      <button
        type="button"
        disabled={!state.enabled}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        className="inline-flex h-6 items-center gap-1 rounded-[--radius] px-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
      >
        {icon}
        {label}
      </button>
    </TooltipWrapper>
  );
}

export function RowHoverActions({
  row,
  context,
  blockerText,
  onAction,
  menu,
}: {
  row: TableRow;
  context: ToolbarContext;
  blockerText: BlockerText;
  onAction: (action: RowAction, row: TableRow) => void;
  menu: ReactNode;
}) {
  const t = useTranslations("adsManager.rowActions");
  const single = forRow(context, row);
  return (
    <>
      {row.draft ? (
        <HoverAction
          state={publishState(single)}
          icon={<PaperPlaneTilt className="h-3.5 w-3.5" aria-hidden />}
          label={t("publish")}
          blockerText={blockerText}
          onClick={() => onAction("publish", row)}
        />
      ) : null}
      <HoverAction
        state={insightsState(single)}
        icon={<ChartLine className="h-3.5 w-3.5" aria-hidden />}
        label={t("insights")}
        blockerText={blockerText}
        onClick={() => onAction("insights", row)}
      />
      <HoverAction
        state={editState(single)}
        icon={<PencilSimple className="h-3.5 w-3.5" aria-hidden />}
        label={t("edit")}
        blockerText={blockerText}
        onClick={() => onAction("edit", row)}
      />
      <HoverAction
        state={duplicateState(single)}
        icon={<Copy className="h-3.5 w-3.5" aria-hidden />}
        label={t("duplicate")}
        blockerText={blockerText}
        onClick={() => onAction("duplicate", row)}
      />
      {menu}
    </>
  );
}
