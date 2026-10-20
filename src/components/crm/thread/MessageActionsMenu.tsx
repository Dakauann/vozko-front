"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  ArrowBendUpLeft,
  ArrowClockwise,
  Copy,
  PencilSimple,
  Plus,
  Trash,
} from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import type { MessageMenuItem } from "@/lib/conversations/message-menu";
import { QUICK_REACTIONS } from "@/lib/conversations/reactions";
import type { ConversationMessage } from "@/lib/conversations/types";
import { cn } from "@/lib/utils";

import { EmojiPickerPanel } from "../EmojiPickerPanel";

export interface MenuAnchor {
  x: number;
  y: number;
  restoreFocus: HTMLElement | null;
}

export interface MessageActionHandlers {
  onReply: () => void;
  onReact: (emoji: string) => void;
  onEdit: () => void;
  onResend: () => void;
  onDelete: () => void;
}

interface MessageActionsMenuProps {
  message: ConversationMessage;
  items: readonly MessageMenuItem[];
  anchor: MenuAnchor | null;
  onClose: () => void;
  handlers: MessageActionHandlers;
}

const ITEM = "gap-2 text-xs";

function ownReaction(message: ConversationMessage): string | null {
  return message.reactions?.find((reaction) => reaction.direction === "outbound")?.emoji ?? null;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function MessageActionsMenu({ message, items, anchor, onClose, handlers }: MessageActionsMenuProps) {
  const t = useTranslations("crmMessage");
  const [pickerAt, setPickerAt] = useState<MenuAnchor | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const placed = anchor ?? pickerAt;
  const chosen = ownReaction(message);
  const offers = (item: MessageMenuItem) => items.includes(item);

  const copy = async () => {
    const copied = await copyText(message.text);
    if (copied) toast.success(t("actions.copied"));
    else toast.error(t("actions.copyFailed"));
  };

  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute h-0 w-0"
        style={placed ? { left: placed.x, top: placed.y } : { left: 0, top: 0 }}
      >
        <DropdownMenu open={anchor !== null} onOpenChange={(open) => !open && onClose()} modal={false}>
          <DropdownMenuTrigger asChild>
            <span className="block h-0 w-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            aria-label={t("actions.menu")}
            className="w-56"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              anchor?.restoreFocus?.focus({ preventScroll: true });
            }}
          >
            {offers("react") ? (
              <>
                <div role="group" aria-label={t("actions.react")} className="flex items-center justify-between gap-0.5 pb-1">
                  {QUICK_REACTIONS.map((emoji) => (
                    <DropdownMenuItem
                      key={emoji}
                      aria-label={emoji === chosen ? t("actions.removeReaction", { emoji }) : t("actions.reactWith", { emoji })}
                      onSelect={() => handlers.onReact(emoji)}
                      className={cn("h-8 w-8 justify-center p-0 text-lg", emoji === chosen && "bg-muted")}
                    >
                      {emoji}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem
                    aria-label={t("actions.moreReactions")}
                    onSelect={() => setPickerAt(anchor)}
                    className="h-8 w-8 justify-center p-0"
                  >
                    <Plus weight="bold" className="h-4 w-4" aria-hidden />
                  </DropdownMenuItem>
                </div>
                {items.length > 1 ? <DropdownMenuSeparator /> : null}
              </>
            ) : null}
            {offers("reply") ? (
              <DropdownMenuItem className={ITEM} onSelect={handlers.onReply}>
                <ArrowBendUpLeft weight="bold" className="h-4 w-4" aria-hidden />
                {t("actions.reply")}
              </DropdownMenuItem>
            ) : null}
            {offers("copy") ? (
              <DropdownMenuItem className={ITEM} onSelect={() => void copy()}>
                <Copy weight="bold" className="h-4 w-4" aria-hidden />
                {t("actions.copy")}
              </DropdownMenuItem>
            ) : null}
            {offers("edit") ? (
              <DropdownMenuItem className={ITEM} onSelect={handlers.onEdit}>
                <PencilSimple weight="bold" className="h-4 w-4" aria-hidden />
                {t("actions.edit")}
              </DropdownMenuItem>
            ) : null}
            {offers("resend") ? (
              <DropdownMenuItem className={ITEM} onSelect={handlers.onResend}>
                <ArrowClockwise weight="bold" className="h-4 w-4" aria-hidden />
                {t("actions.resend")}
              </DropdownMenuItem>
            ) : null}
            {offers("delete") ? (
              <DropdownMenuItem className={cn(ITEM, "text-destructive-ink")} onSelect={() => setConfirmingDelete(true)}>
                <Trash weight="bold" className="h-4 w-4" aria-hidden />
                {t("actions.delete")}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>

        <Popover open={pickerAt !== null} onOpenChange={(open) => !open && setPickerAt(null)}>
          <PopoverAnchor asChild>
            <span className="block h-0 w-0" />
          </PopoverAnchor>
          <PopoverContent
            align="start"
            className="w-[19rem] p-0"
            aria-label={t("actions.moreReactions")}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              pickerAt?.restoreFocus?.focus({ preventScroll: true });
            }}
          >
            <EmojiPickerPanel
              onPick={(emoji) => {
                handlers.onReact(emoji);
                setPickerAt(null);
              }}
            />
          </PopoverContent>
        </Popover>
      </span>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={t("delete.title")}
        description={t("delete.description")}
        confirmLabel={t("delete.confirm")}
        onConfirm={handlers.onDelete}
      />
    </>
  );
}
