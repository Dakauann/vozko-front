"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { updateCallListAction } from "@/app/actions/call-lists";
import Button from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogBody,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import { useCallListCache } from "@/hooks/use-call-lists";
import type { CodedError } from "@/lib/api/coded-error";
import type { CallList } from "@/lib/call-lists/types";

import { CallListAssigneePicker } from "./CallListAssigneePicker";
import { useCallListError } from "./CallListBits";

export function CallListAssigneesDialog({ list, onClose }: { list: CallList; onClose: () => void }) {
  const t = useTranslations("callLists.assignees");
  const errorText = useCallListError();
  const { store } = useCallListCache();
  const [assigneeIds, setAssigneeIds] = useState<string[]>(list.assigneeIds);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<CodedError | null>(null);

  const save = async () => {
    setBusy(true);
    setFailure(null);
    const answer = await updateCallListAction(list.id, { assigneeIds });
    setBusy(false);
    if (answer.error) {
      setFailure(answer.error);
      return;
    }
    store(answer.data);
    toast.success(t("saved"));
    onClose();
  };

  return (
    <ElevatedDialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <ElevatedDialogContent className="max-w-lg">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
          <ElevatedDialogDescription>{t("description")}</ElevatedDialogDescription>
        </ElevatedDialogHeader>
        <ElevatedDialogBody className="space-y-3">
          <CallListAssigneePicker
            assigneeIds={assigneeIds}
            onChange={(next) => {
              setAssigneeIds(next);
              setFailure(null);
            }}
            disabled={busy}
          />
          {failure ? (
            <p role="alert" className="text-sm text-destructive-ink">
              {errorText(failure)}
            </p>
          ) : null}
        </ElevatedDialogBody>
        <ElevatedDialogFooter>
          <Button variant="secondary" title={t("cancel")} onClick={onClose} disabled={busy} />
          <Button variant="primary" title={busy ? t("saving") : t("save")} onClick={() => void save()} disabled={busy || assigneeIds.length === 0} />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
