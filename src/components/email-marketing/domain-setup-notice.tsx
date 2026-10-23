"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { useEmailError } from "@/components/email-marketing/use-email-error";
import Button from "@/components/elevated-design/button";
import { ArrowsClockwise, Spinner } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import type { EmailDomain } from "@/lib/email-marketing/types";
import { cn } from "@/lib/utils";

export function DomainSetupNotice({ domain, onRetry }: { domain: EmailDomain; onRetry?: () => Promise<unknown> }) {
  const t = useTranslations("emailMarketing.setup");
  const describe = useEmailError();
  const [retrying, setRetrying] = useState(false);

  if (domain.setup.state === "done") return null;

  if (domain.setup.state === "in_progress") {
    return (
      <Notice tone="info" title={t("inProgressTitle")} icon={<Spinner className="animate-spin" weight="bold" />}>
        <p>{t("inProgressText", { domain: domain.domain })}</p>
      </Notice>
    );
  }

  const retry = async () => {
    if (!onRetry) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <Notice tone="fault" title={t("failedTitle", { domain: domain.domain })}>
      <p className="text-foreground">{describe({ code: domain.setup.error_code })}</p>
      {onRetry ? (
        <Button
          variant="outline"
          size="sm"
          icon={<ArrowsClockwise className={cn("h-3.5 w-3.5", retrying && "animate-spin")} weight="bold" />}
          iconVisible
          title={retrying ? t("retrying") : t("retry")}
          disabled={retrying}
          onClick={() => void retry()}
        />
      ) : null}
    </Notice>
  );
}
