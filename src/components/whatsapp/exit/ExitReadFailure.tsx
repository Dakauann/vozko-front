"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { Notice } from "@/components/ui/notice";
import { codedErrorMessage, type CodedError } from "@/lib/api/coded-error";

export function ExitReadFailure({ error, fallback, onRetry }: { error: CodedError; fallback: string; onRetry: () => void }) {
  const t = useTranslations("templateExit");
  return (
    <Notice tone="fault">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>{codedErrorMessage(t, error, fallback)}</p>
        <Button type="button" variant="secondary" size="sm" title={t("verdict.retry")} onClick={onRetry} />
      </div>
    </Notice>
  );
}
