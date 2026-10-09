"use client";

import { useCallback, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import {
  ChatText,
  DotsThree,
  DownloadSimple,
  PaperPlaneTilt,
  PhoneOutgoing,
  Prohibit,
  Tag,
  Target,
  UserCheck,
  X,
} from "@/components/icons";
import { BULK_CONTROL, BulkActionButton } from "@/components/selection/GuardedAction";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ActionState } from "@/lib/selection/action-state";
import type { LeadActionKind } from "@/lib/leads/actions";
import type { LeadBulkAction, LeadBulkActionStates, LeadBulkBlocker } from "@/lib/leads/bulk-selection";

const ICON = "h-3.5 w-3.5";

const ICONS: Record<LeadBulkAction, ReactNode> = {
  send_template: <PaperPlaneTilt className={ICON} aria-hidden />,
  send_message: <ChatText className={ICON} aria-hidden />,
  call_list: <PhoneOutgoing className={ICON} aria-hidden />,
  classify: <Tag className={ICON} aria-hidden />,
  assign_owner: <UserCheck className={ICON} aria-hidden />,
  export: <DownloadSimple className={ICON} aria-hidden />,
  meta_audience: <Target className={ICON} aria-hidden />,
  block: <Prohibit className={ICON} aria-hidden />,
};

const BAR: readonly LeadBulkAction[] = ["send_template", "send_message", "call_list", "classify", "assign_owner"];
const MORE: readonly LeadBulkAction[] = ["export", "meta_audience", "block"];
const ALL: readonly LeadBulkAction[] = [...BAR, ...MORE];

const RUNNABLE: Partial<Record<LeadBulkAction, LeadActionKind>> = {
  send_template: "send_template",
  send_message: "send_unofficial",
  call_list: "call_list",
  classify: "classify",
  assign_owner: "assign_owner",
  export: "export",
  meta_audience: "meta_audience",
  block: "block",
};

function useLeadBulkReason() {
  const t = useTranslations("leadsPage.bulk.blockers");
  return useCallback((state: ActionState<LeadBulkBlocker>) => (state.enabled ? null : t(state.reason)), [t]);
}

export function LeadBulkBar({
  states,
  onAction,
  onClear,
}: {
  states: LeadBulkActionStates;
  onAction: (action: LeadActionKind) => void;
  onClear?: () => void;
}) {
  const t = useTranslations("leadsPage.bulk");
  const reasonText = useLeadBulkReason();

  const run = (action: LeadBulkAction) => {
    const kind = RUNNABLE[action];
    if (kind && states[action].enabled) onAction(kind);
  };

  const menuItems = (actions: readonly LeadBulkAction[]) =>
    actions.map((action) => {
      const reason = reasonText(states[action]);
      return (
        <DropdownMenuItem key={action} disabled={!states[action].enabled} onSelect={() => run(action)}>
          <span className="mr-2 inline-flex text-muted-foreground">{ICONS[action]}</span>
          <span className="flex flex-col">
            {t(`actions.${action}`)}
            {reason ? <span className="text-2xs text-muted-foreground">{reason}</span> : null}
          </span>
        </DropdownMenuItem>
      );
    });

  return (
    <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
      <div className="hidden flex-wrap items-center gap-1.5 sm:flex">
        {BAR.map((action) => (
          <BulkActionButton
            key={action}
            state={states[action]}
            reasonText={reasonText}
            icon={ICONS[action]}
            label={t(`actions.${action}`)}
            onClick={() => run(action)}
          />
        ))}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={BULK_CONTROL}>
              <DotsThree className={ICON} weight="bold" aria-hidden />
              <span>{t("more")}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {menuItems(MORE)}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="sm:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={BULK_CONTROL}>
              <DotsThree className={ICON} weight="bold" aria-hidden />
              <span>{t("actionsMenu")}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {menuItems(ALL)}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {onClear ? (
        <button
          type="button"
          onClick={onClear}
          title={t("clear")}
          className="inline-flex size-8 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-3 w-3" weight="bold" aria-hidden />
          <span className="sr-only">{t("clear")}</span>
        </button>
      ) : null}
    </div>
  );
}
