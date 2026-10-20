"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { addGroupNumbersAction } from "@/app/actions/unofficial-whatsapp-groups";
import Button from "@/components/elevated-design/button";
import {
  ElevatedSheet,
  ElevatedSheetContent,
  ElevatedSheetDescription,
  ElevatedSheetFooter,
  ElevatedSheetHeader,
  ElevatedSheetTitle,
} from "@/components/elevated-design/elevated-sheet";
import { CircleNotch, UserPlus } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import { groupErrorKey } from "@/lib/unofficial-whatsapp-groups/group-errors";
import { JOIN_SPACING_MINUTES, type GroupDetail } from "@/lib/unofficial-whatsapp-groups/types";

import { JoinNumbersFields, useJoinNumbers } from "../join-numbers";

interface AddNumbersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: GroupDetail;
  onAdded: () => void;
}

export function AddNumbersSheet({ open, onOpenChange, detail, onAdded }: AddNumbersSheetProps) {
  return (
    <ElevatedSheet open={open} onOpenChange={onOpenChange}>
      <ElevatedSheetContent side="right" className="w-full sm:max-w-[560px]">
        {open ? <AddNumbersForm detail={detail} onClose={() => onOpenChange(false)} onAdded={onAdded} /> : null}
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}

function AddNumbersForm({ detail, onClose, onAdded }: { detail: GroupDetail; onClose: () => void; onAdded: () => void }) {
  const t = useTranslations("unofficialGroups.detail.settings.addNumbers");
  const tJoin = useTranslations("unofficialGroups.join");
  const tErrors = useTranslations("unofficialGroups.list.errors");
  const { group } = detail;
  const alreadyIn = useMemo(() => detail.numbers.map((seat) => seat.instanceId), [detail.numbers]);
  const join = useJoinNumbers(alreadyIn);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, startSubmitting] = useTransition();

  const submit = () => {
    if (join.selected.length === 0) return;
    setSubmitError(null);
    startSubmitting(async () => {
      const result = await addGroupNumbersAction(group.id, join.selected);
      if (result.error || !result.data) {
        const key = groupErrorKey(result.error);
        const message = key ? tErrors(key) : tErrors("joinFailed");
        setSubmitError(message);
        toast.error(t("failed"), { description: message });
        return;
      }
      const tasks = result.data.tasks;
      const firstJoined = tasks[0]?.status === "done";
      toast(tJoin("planned"), {
        description: !firstJoined
          ? tJoin("queued", { subject: group.subject })
          : tasks.length > 1
            ? tJoin("plannedMany", { subject: group.subject, later: tasks.length - 1, minutes: JOIN_SPACING_MINUTES })
            : tJoin("plannedOne", { subject: group.subject }),
      });
      onAdded();
      onClose();
    });
  };

  return (
    <>
      <ElevatedSheetHeader>
        <div className="flex items-start gap-3 pr-10">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[--radius] bg-muted text-primary-ink">
            <UserPlus className="h-5 w-5" weight="bold" />
          </span>
          <div className="min-w-0">
            <ElevatedSheetTitle>{t("title")}</ElevatedSheetTitle>
            <ElevatedSheetDescription>{t("subtitle", { subject: group.subject })}</ElevatedSheetDescription>
          </div>
        </div>
      </ElevatedSheetHeader>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 pb-6">
        <p className="text-xs text-muted-foreground">{t("linkHint")}</p>
        <JoinNumbersFields join={join} />
        {submitError ? <Notice tone="fault" title={t("failed")}>{submitError}</Notice> : null}
      </div>

      <ElevatedSheetFooter className="flex-row justify-end border-t border-border">
        <Button variant="secondary" title={tJoin("cancel")} onClick={onClose} />
        <Button
          variant="primary"
          title={join.selected.length > 1 ? t("submitMany", { count: join.selected.length }) : t("submit")}
          disabled={join.selected.length === 0 || submitting}
          onClick={submit}
          icon={submitting ? <CircleNotch className="h-4 w-4 animate-spin" weight="bold" /> : undefined}
          iconVisible={submitting}
        />
      </ElevatedSheetFooter>
    </>
  );
}
