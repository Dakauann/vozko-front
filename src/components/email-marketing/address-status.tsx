"use client";

import { useFormatter, useTranslations } from "next-intl";

import { useWorkspace } from "@/contexts/workspace-context";
import { useEmailAddressStatus } from "@/hooks/use-email-marketing";
import type { EmailAddressStatus, EmailAddressVerdict } from "@/lib/email-marketing/types";
import { cn } from "@/lib/utils";

const VERDICT_MARK: Record<EmailAddressVerdict, string> = {
  valid: "bg-healthy",
  typo: "bg-warning",
  role: "bg-warning",
  inactive: "bg-warning",
  domain_unknown: "bg-warning",
  domain_pending: "bg-warning",
  suppressed: "bg-destructive",
  bad_address: "bg-destructive",
  no_mail_domain: "bg-destructive",
  disposable: "bg-destructive",
};

export function EmailAddressStatusHint({ address }: { address: string | undefined }) {
  const { can } = useWorkspace();
  const allowed = can("email_marketing", "read");
  const status = useEmailAddressStatus(address ?? "", allowed && !!address);
  if (!allowed || !address || !status.data) return null;
  return <EmailAddressStatusLine status={status.data} />;
}

export function EmailAddressStatusLine({ status }: { status: EmailAddressStatus }) {
  const t = useTranslations("emailMarketing.addressStatus");
  const format = useFormatter();
  const details: string[] = [];
  if (status.suppression) {
    details.push(status.suppression.scope === "shared" ? t("sharedBounce") : t("suppressedBecause", { reason: t(`reasons.${status.suppression.reason}`) }));
  }
  if (status.verdict === "typo" && status.suggested_address) details.push(t("didYouMean", { address: status.suggested_address }));
  if (status.soft_bounces > 0 && !status.suppression) details.push(t("softBounces", { count: status.soft_bounces }));
  if (status.last_engaged_at) details.push(t("lastEngaged", { date: format.dateTime(new Date(status.last_engaged_at), { dateStyle: "short" }) }));
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-muted-foreground" role="status">
      <span className="inline-flex items-center gap-1.5 text-foreground">
        <span className={cn("size-2 shrink-0 rounded-full", VERDICT_MARK[status.verdict])} aria-hidden />
        {t(`verdicts.${status.verdict}`)}
      </span>
      {details.map((detail) => (
        <span key={detail}>{detail}</span>
      ))}
    </span>
  );
}
