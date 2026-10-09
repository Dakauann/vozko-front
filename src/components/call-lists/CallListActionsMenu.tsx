"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { deleteCallListAction, updateCallListAction } from "@/app/actions/call-lists";
import Button from "@/components/elevated-design/button";
import { Archive, ArrowCounterClockwise, DotsThree, Pause, Play, Trash, UsersThree } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCallListCache } from "@/hooks/use-call-lists";
import type { CallList, CallListChange } from "@/lib/call-lists/types";

import { CallListAssigneesDialog } from "./CallListAssigneesDialog";
import { useCallListError } from "./CallListBits";

type Confirming = "delete" | "archive" | null;

export function CallListActionsMenu({
  list,
  onDeleted,
  showAssignees = true,
}: {
  list: CallList;
  onDeleted?: () => void;
  showAssignees?: boolean;
}) {
  const t = useTranslations("callLists");
  const errorText = useCallListError();
  const { store, forget } = useCallListCache();
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [editingAssignees, setEditingAssignees] = useState(false);

  const change = async (next: CallListChange): Promise<boolean> => {
    const answer = await updateCallListAction(list.id, next);
    if (answer.error) {
      toast.error(errorText(answer.error));
      return false;
    }
    store(answer.data);
    toast.success(t("actions.updated"));
    return true;
  };

  const remove = async (): Promise<boolean> => {
    const answer = await deleteCallListAction(list.id);
    if (answer.error) {
      toast.error(errorText(answer.error));
      return false;
    }
    forget(list.id);
    toast.success(t("actions.deleted"));
    onDeleted?.();
    return true;
  };

  const moves = list.statusMoves;

  return (
    <span className="contents" onClick={(event) => event.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("actions.menu", { name: list.name })}
            icon={<DotsThree className="h-4 w-4" weight="bold" />}
            iconVisible
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {moves.includes("paused") ? (
            <DropdownMenuItem onSelect={() => void change({ status: "paused" })}>
              <Pause className="h-4 w-4" aria-hidden />
              {t("actions.pause")}
            </DropdownMenuItem>
          ) : null}
          {moves.includes("active") ? (
            <DropdownMenuItem onSelect={() => void change({ status: "active" })}>
              {list.status === "archived" ? <ArrowCounterClockwise className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
              {list.status === "archived" ? t("actions.restore") : t("actions.resume")}
            </DropdownMenuItem>
          ) : null}
          {showAssignees && list.acceptsOutcomes ? (
            <DropdownMenuItem onSelect={() => setEditingAssignees(true)}>
              <UsersThree className="h-4 w-4" aria-hidden />
              {t("assignees.title")}
            </DropdownMenuItem>
          ) : null}
          {moves.includes("archived") ? (
            <DropdownMenuItem onSelect={() => setConfirming("archive")}>
              <Archive className="h-4 w-4" aria-hidden />
              {t("actions.archive")}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setConfirming("delete")} className="text-destructive-ink">
            <Trash className="h-4 w-4" aria-hidden />
            {t("actions.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirming === "delete"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={t("confirm.deleteTitle", { name: list.name })}
        description={t("confirm.deleteDescription")}
        confirmLabel={t("confirm.deleteConfirm")}
        cancelLabel={t("confirm.cancel")}
        onConfirm={remove}
      />
      <ConfirmDialog
        open={confirming === "archive"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={t("confirm.archiveTitle", { name: list.name })}
        description={t("confirm.archiveDescription")}
        confirmLabel={t("confirm.archiveConfirm")}
        cancelLabel={t("confirm.cancel")}
        tone="default"
        onConfirm={() => change({ status: "archived" })}
      />
      {editingAssignees ? <CallListAssigneesDialog list={list} onClose={() => setEditingAssignees(false)} /> : null}
    </span>
  );
}
