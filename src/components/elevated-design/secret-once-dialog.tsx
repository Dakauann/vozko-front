"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { CopyableCode } from "@/components/elevated-design/copyable-code";
import {
  ElevatedDialog,
  ElevatedDialogBody,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import { Notice } from "@/components/ui/notice";

export function SecretOnceDialog({
  secret,
  title,
  description,
  onClose,
}: {
  secret: string | null;
  title: string;
  description: string;
  onClose: () => void;
}) {
  const t = useTranslations("secretOnce");
  return (
    <ElevatedDialog open={secret !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <ElevatedDialogContent className="sm:max-w-[560px]">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{title}</ElevatedDialogTitle>
          <ElevatedDialogDescription>{description}</ElevatedDialogDescription>
        </ElevatedDialogHeader>
        <ElevatedDialogBody className="space-y-4">
          <CopyableCode code={secret ?? ""} copyLabel={t("copy")} copiedLabel={t("copied")} failedLabel={t("copyFailed")} wrap />
          <Notice tone="warning" title={t("onceTitle")}>
            <p>{t("onceText")}</p>
          </Notice>
        </ElevatedDialogBody>
        <ElevatedDialogFooter>
          <Button title={t("done")} onClick={onClose} />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
