"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { manageGroupMembersAction } from "@/app/actions/unofficial-whatsapp-groups";
import { Chip } from "@/components/audience/shared";
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
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { Notice } from "@/components/ui/notice";

import { NoAdminSeatNotice } from "../kit/notices";
import { isAdminRefusal, parsePhoneList } from "./detail-model";

export function AddParticipantsDialog({
  groupId,
  open,
  onOpenChange,
  onDone,
  onRefused,
}: {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  onRefused?: () => void;
}) {
  const t = useTranslations("unofficialGroups.detail.addParticipants");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const parsed = parsePhoneList(text);

  const close = (next: boolean) => {
    if (saving) return;
    if (!next) {
      setText("");
      setRefused(false);
      setFailure(null);
    }
    onOpenChange(next);
  };

  const submit = async () => {
    if (parsed.valid.length === 0) return;
    setSaving(true);
    setFailure(null);
    const result = await manageGroupMembersAction(groupId, "add", parsed.valid);
    setSaving(false);
    if (result.error) {
      if (isAdminRefusal(result.error)) {
        setRefused(true);
        onRefused?.();
      } else {
        setFailure(result.error);
      }
      return;
    }
    toast(t("done", { count: parsed.valid.length }));
    setText("");
    onDone();
  };

  return (
    <ElevatedDialog open={open} onOpenChange={close}>
      <ElevatedDialogContent className="max-w-lg">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
          <ElevatedDialogDescription>{t("description")}</ElevatedDialogDescription>
        </ElevatedDialogHeader>
        <ElevatedDialogBody className="space-y-3">
          {refused ? <NoAdminSeatNotice action="manage" /> : null}
          {failure ? (
            <Notice tone="fault" title={t("failed")}>
              <p className="break-words">{failure}</p>
            </Notice>
          ) : null}
          <ElevatedTextarea
            label={t("label")}
            value={text}
            onChange={(event) => setText(event.target.value)}
            autoResize
            maxHeight={260}
            rows={6}
            disabled={saving}
          />
          <p className="px-1 text-2xs text-muted-foreground">{t("hint")}</p>
          {parsed.valid.length > 0 || parsed.invalid.length > 0 ? (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip dot="hsl(var(--healthy))">{t("valid", { count: parsed.valid.length })}</Chip>
                {parsed.invalid.length > 0 ? <Chip dot="hsl(var(--destructive))">{t("invalid", { count: parsed.invalid.length })}</Chip> : null}
              </div>
              {parsed.invalid.length > 0 ? (
                <p className="break-words text-2xs text-muted-foreground">{t("invalidList", { list: parsed.invalid.join(", ") })}</p>
              ) : null}
            </div>
          ) : null}
        </ElevatedDialogBody>
        <ElevatedDialogFooter>
          <Button variant="ghost" size="sm" title={t("cancel")} onClick={() => close(false)} disabled={saving} />
          <Button
            variant="primary"
            size="sm"
            title={saving ? t("adding") : t("submit", { count: parsed.valid.length })}
            onClick={() => void submit()}
            disabled={saving || parsed.valid.length === 0 || refused}
          />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
