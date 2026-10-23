"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

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

export function PasteListDialog({
  open,
  contact,
  saving,
  error,
  onSubmit,
  onClose,
}: {
  open: boolean;
  contact: "phone" | "email";
  saving: boolean;
  error: string | null;
  onSubmit: (text: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("campaignAudience.step.list.pasteDialog");
  const [text, setText] = useState("");
  return (
    <ElevatedDialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <ElevatedDialogContent className="sm:max-w-[640px]">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
          <ElevatedDialogDescription>{t(contact === "email" ? "descriptionEmail" : "descriptionPhone")}</ElevatedDialogDescription>
        </ElevatedDialogHeader>
        <ElevatedDialogBody className="space-y-2">
          <ElevatedTextarea label={t("label")} rows={10} value={text} onChange={(event) => setText(event.target.value)} className="font-mono" />
          {error ? (
            <p role="alert" className="text-xs font-semibold text-destructive-ink">
              {error}
            </p>
          ) : null}
        </ElevatedDialogBody>
        <ElevatedDialogFooter>
          <Button type="button" variant="ghost" title={t("cancel")} onClick={onClose} />
          <Button type="button" title={t("submit")} disabled={saving || text.trim() === ""} onClick={() => onSubmit(text)} />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
