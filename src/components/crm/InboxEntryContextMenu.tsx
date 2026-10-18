"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { AssignableMember } from "@/app/actions/workspace";
import { usePortfolioCommands } from "@/components/customer-portfolio/use-portfolio-commands";
import {
  ArrowSquareOut,
  ChatCircleDots,
  Copy,
  DotsThree,
  IdentificationBadge,
  Tag as TagIcon,
  UserCheck,
  UserMinus,
  UserPlus,
  UsersThree,
} from "@/components/icons";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useConversationHolding, usePortfolioAccess } from "@/hooks/use-customer-portfolio";
import { memberDisplayName } from "@/hooks/use-assignable-members";
import type { InboxEntry, InboxEntryStage, Label } from "@/lib/conversations/types";
import { holdingState } from "@/lib/customer-portfolio/portfolio";
import { formatPhoneForDisplay } from "@/lib/phone/display";

const ITEM = "gap-2 text-xs";
const SUB_CONTENT = "max-h-72 w-56 overflow-y-auto";

export interface InboxEntryMenuActions {
  onOpen: () => void;
  onOpenInWindow?: () => void;
  onOpenLead?: () => void;
  members?: AssignableMember[];
  onlineUserIds?: ReadonlySet<string>;
  onAssignTo?: (userId: string) => void;
  onMoveStage?: (stageId: string) => void;
  labels?: Label[];
  onToggleLabel?: (labelId: string, assigned: boolean) => void;
}

function Swatch({ color }: { color: string }) {
  return <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/5" style={{ backgroundColor: color }} />;
}

function AssignItems({ entry, members, onlineUserIds, onAssignTo }: { entry: InboxEntry; members: AssignableMember[]; onlineUserIds?: ReadonlySet<string>; onAssignTo: (userId: string) => void }) {
  const t = useTranslations("inboxMenu");
  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger className={ITEM}>
        <UsersThree className="h-4 w-4" aria-hidden />
        {t("assign")}
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className={SUB_CONTENT}>
        {members.length === 0 ? (
          <ContextMenuItem disabled className={ITEM}>
            {t("assignEmpty")}
          </ContextMenuItem>
        ) : (
          <ContextMenuRadioGroup value={entry.assigned_user_id ?? ""} onValueChange={(userId) => userId !== entry.assigned_user_id && onAssignTo(userId)}>
            {members.map((member) => (
              <ContextMenuRadioItem key={member.userId} value={member.userId} className={ITEM}>
                <span className="min-w-0 flex-1 truncate">{memberDisplayName(member)}</span>
                {onlineUserIds?.has(member.userId) ? (
                  <span aria-label={t("online")} title={t("online")} className="h-2 w-2 shrink-0 rounded-full bg-healthy" />
                ) : null}
              </ContextMenuRadioItem>
            ))}
          </ContextMenuRadioGroup>
        )}
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}

function StageItems({ entry, stages, onMoveStage }: { entry: InboxEntry; stages: InboxEntryStage[]; onMoveStage: (stageId: string) => void }) {
  const t = useTranslations("inboxMenu");
  const current = entry.stage?.stage_id ?? "";
  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger className={ITEM}>
        <TagIcon className="h-4 w-4" aria-hidden />
        {t("stage")}
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className={SUB_CONTENT}>
        <ContextMenuRadioGroup value={current} onValueChange={(stageId) => stageId !== current && onMoveStage(stageId)}>
          {stages.map((stage) => (
            <ContextMenuRadioItem key={stage.stage_id} value={stage.stage_id} className={ITEM}>
              <Swatch color={stage.color} />
              <span className="min-w-0 flex-1 truncate">{stage.name}</span>
            </ContextMenuRadioItem>
          ))}
        </ContextMenuRadioGroup>
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}

function LabelItems({ entry, labels, onToggleLabel }: { entry: InboxEntry; labels: Label[]; onToggleLabel: (labelId: string, assigned: boolean) => void }) {
  const t = useTranslations("inboxMenu");
  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger className={ITEM}>
        <TagIcon weight="fill" className="h-4 w-4" aria-hidden />
        {t("labels")}
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className={SUB_CONTENT}>
        {labels.map((label) => {
          const assigned = entry.labels?.some((held) => held.label_id === label.id) ?? false;
          return (
            <ContextMenuCheckboxItem
              key={label.id}
              checked={assigned}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={() => onToggleLabel(label.id, assigned)}
              className={ITEM}
            >
              <Swatch color={label.color} />
              <span className="min-w-0 flex-1 truncate">{label.name}</span>
            </ContextMenuCheckboxItem>
          );
        })}
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}

function PortfolioItem({ entry }: { entry: InboxEntry }) {
  const t = useTranslations("customerPortfolio");
  const { uses, userId } = usePortfolioAccess();
  const holding = useConversationHolding(entry.entry_type, entry.entry_id, true);
  const { busy, placeConversation, remove } = usePortfolioCommands();
  const current = holding.data;

  if (!current) {
    return (
      <ContextMenuItem disabled className={ITEM}>
        <UserCheck className="h-4 w-4" aria-hidden />
        {holding.isError ? t("errors.failed") : "…"}
      </ContextMenuItem>
    );
  }
  const state = holdingState(current, userId);
  const entryId = current.entry?.id;
  if (state === "free" && uses) {
    return (
      <ContextMenuItem disabled={busy} onSelect={() => void placeConversation(entry.entry_type, entry.entry_id)} className={ITEM}>
        <UserPlus className="h-4 w-4" aria-hidden />
        {t("conversation.add")}
      </ContextMenuItem>
    );
  }
  if (state === "mine" && uses && entryId) {
    return (
      <ContextMenuItem disabled={busy} onSelect={() => void remove(entryId)} className={ITEM}>
        <UserMinus className="h-4 w-4" aria-hidden />
        {t("conversation.remove")}
      </ContextMenuItem>
    );
  }
  if (state === "other") {
    return (
      <ContextMenuItem disabled className={ITEM}>
        <UserCheck className="h-4 w-4" aria-hidden />
        {t("conversation.other", { name: current.entry?.holderName || t("page.unknownMember") })}
      </ContextMenuItem>
    );
  }
  return null;
}

export function InboxEntryContextMenu({ entry, actions, children }: { entry: InboxEntry; actions: InboxEntryMenuActions; children: ReactNode }) {
  const t = useTranslations("inboxMenu");
  const { views } = usePortfolioAccess();
  const person = !entry.is_group;
  const contact = person ? entry.lead_number?.trim() ?? "" : "";

  const copyContact = async () => {
    try {
      await navigator.clipboard.writeText(formatPhoneForDisplay(contact));
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  const { onAssignTo, members, onMoveStage, onToggleLabel, labels } = actions;
  const stages = entry.available_stages ?? [];
  const offersStages = Boolean(onMoveStage) && stages.length > 0;
  const offersLabels = Boolean(onToggleLabel && labels?.length);
  const organizes = Boolean(onAssignTo && members) || offersStages || offersLabels || (views && person);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-60">
        <ContextMenuLabel className="truncate text-2xs font-semibold text-muted-foreground">{entry.lead_name || formatPhoneForDisplay(entry.lead_number)}</ContextMenuLabel>
        <ContextMenuItem onSelect={actions.onOpen} className={ITEM}>
          <ChatCircleDots className="h-4 w-4" aria-hidden />
          {t("open")}
        </ContextMenuItem>
        {actions.onOpenInWindow ? (
          <ContextMenuItem onSelect={actions.onOpenInWindow} className={ITEM}>
            <ArrowSquareOut className="h-4 w-4" aria-hidden />
            {t("openInWindow")}
          </ContextMenuItem>
        ) : null}
        {organizes ? <ContextMenuSeparator /> : null}
        {onAssignTo && members ? <AssignItems entry={entry} members={members} onlineUserIds={actions.onlineUserIds} onAssignTo={onAssignTo} /> : null}
        {offersStages && onMoveStage ? <StageItems entry={entry} stages={stages} onMoveStage={onMoveStage} /> : null}
        {offersLabels && onToggleLabel && labels ? <LabelItems entry={entry} labels={labels} onToggleLabel={onToggleLabel} /> : null}
        {views && person ? <PortfolioItem entry={entry} /> : null}
        {(actions.onOpenLead && entry.lead_id) || contact ? <ContextMenuSeparator /> : null}
        {actions.onOpenLead && entry.lead_id ? (
          <ContextMenuItem onSelect={actions.onOpenLead} className={ITEM}>
            <IdentificationBadge className="h-4 w-4" aria-hidden />
            {t("openLead")}
          </ContextMenuItem>
        ) : null}
        {contact ? (
          <ContextMenuItem onSelect={() => void copyContact()} className={ITEM}>
            <Copy className="h-4 w-4" aria-hidden />
            {t("copyContact")}
          </ContextMenuItem>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function InboxEntryMenuButton() {
  const t = useTranslations("inboxMenu");
  return (
    <button
      type="button"
      aria-haspopup="menu"
      aria-label={t("more")}
      title={t("moreHint")}
      onClick={(event) => {
        event.stopPropagation();
        const anchor = event.currentTarget.getBoundingClientRect();
        event.currentTarget.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: anchor.left, clientY: anchor.bottom }));
      }}
      onKeyDown={(event) => event.stopPropagation()}
      className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-[--radius] text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
    >
      <DotsThree size={14} weight="bold" />
    </button>
  );
}
