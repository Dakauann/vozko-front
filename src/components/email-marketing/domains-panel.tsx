"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { isActionError } from "@/app/actions/action-result";
import { recheckEmailDomainAction, removeEmailDomainAction } from "@/app/actions/email-marketing";
import { ChangeSubdomainSheet } from "@/components/email-marketing/change-subdomain-sheet";
import { DnsRecordsTable } from "@/components/email-marketing/dns-records-table";
import { DomainSetupNotice } from "@/components/email-marketing/domain-setup-notice";
import { RepliesPausedChip } from "@/components/email-marketing/replies-paused-notice";
import { useEmailError } from "@/components/email-marketing/use-email-error";
import Button from "@/components/elevated-design/button";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { ArrowsClockwise, Check, ShieldCheck, Trash, WarningCircle } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Notice } from "@/components/ui/notice";
import { domainStatusTone } from "@/lib/email-marketing/ladder";
import type { EmailDomain, EmailDomainStatus, EmailSetup, EmailSubdomain } from "@/lib/email-marketing/types";
import { cn } from "@/lib/utils";

const PROGRESS_STEPS = ["records", "check", "ready"] as const;

function progressIndex(status: EmailDomainStatus): number {
  if (status === "verified") return 3;
  if (status === "verifying" || status === "failed") return 1;
  return 0;
}

function VerificationProgress({ status }: { status: EmailDomainStatus }) {
  const t = useTranslations("emailMarketing.domains.progress");
  const reached = progressIndex(status);
  return (
    <ol aria-label={t("label")} className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {PROGRESS_STEPS.map((step, index) => {
        const done = index < reached;
        const current = index === reached;
        const failed = current && status === "failed";
        return (
          <li key={step} className="flex items-center gap-2" aria-current={current ? "step" : undefined}>
            <span
              aria-hidden="true"
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-[3px] border-2",
                done && "border-healthy bg-healthy text-healthy-foreground",
                current && !failed && "border-primary-edge bg-primary text-primary-foreground",
                failed && "border-destructive bg-destructive text-destructive-foreground",
                !done && !current && "border-control-edge bg-card",
              )}
            >
              {done ? <Check className="h-2.5 w-2.5" weight="bold" /> : failed ? <WarningCircle className="h-2.5 w-2.5" weight="bold" /> : null}
            </span>
            <span className={cn("text-xs", done || current ? "text-foreground" : "text-muted-foreground")}>{t(step)}</span>
            {index < PROGRESS_STEPS.length - 1 ? <span aria-hidden="true" className="h-px w-5 bg-border-strong" /> : null}
          </li>
        );
      })}
    </ol>
  );
}

function SharedSubdomainControl({ subdomain, canConfigure, onChanged }: { subdomain: EmailSubdomain; canConfigure: boolean; onChanged: () => void }) {
  const t = useTranslations("emailMarketing.subdomain");
  const [changing, setChanging] = useState(false);
  if (subdomain.locked) return <p className="max-w-[72ch] text-xs leading-relaxed text-muted-foreground">{t("locked")}</p>;
  if (!canConfigure) return null;
  return (
    <>
      <Button size="sm" variant="outline" title={t("change")} onClick={() => setChanging(true)} />
      {changing ? <ChangeSubdomainSheet subdomain={subdomain} onClose={() => setChanging(false)} onChanged={onChanged} /> : null}
    </>
  );
}

function DomainRow({ domain, subdomain, canConfigure, onChanged }: { domain: EmailDomain; subdomain: EmailSubdomain; canConfigure: boolean; onChanged: () => void }) {
  const t = useTranslations("emailMarketing");
  const format = useFormatter();
  const describe = useEmailError();
  const [rechecking, setRechecking] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const own = domain.kind === "own";
  const setUp = domain.setup.state === "done";

  const recheck = async () => {
    setRechecking(true);
    const result = await recheckEmailDomainAction(domain.id);
    setRechecking(false);
    if (isActionError(result)) {
      toast.error(describe(result));
      return;
    }
    toast.success(t("domains.rechecked", { domain: domain.domain, status: t(`domainStatus.${result.data.status}`) }));
    onChanged();
  };

  const remove = async () => {
    const result = await removeEmailDomainAction(domain.id);
    if (isActionError(result)) {
      toast.error(describe(result));
      return false;
    }
    toast.success(t("domains.removed", { domain: domain.domain }));
    onChanged();
    return true;
  };

  return (
    <li className="space-y-3 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{domain.domain}</p>
            <StatusChip tone="outline" label={t(`domainKinds.${domain.kind}`)} />
            <StatusChip tone={domainStatusTone(domain.status)} label={t(`domainStatus.${domain.status}`)} />
            <RepliesPausedChip domain={domain} />
          </div>
          <p className="text-xs text-muted-foreground">
            {domain.verified_at
              ? t("domains.verifiedAt", { date: format.dateTime(new Date(domain.verified_at), { dateStyle: "short", timeStyle: "short" }) })
              : domain.last_checked_at
                ? t("domains.checkedAt", { date: format.relativeTime(new Date(domain.last_checked_at)) })
                : t("domains.neverChecked")}
          </p>
        </div>
        {canConfigure && (domain.actions.recheck || domain.actions.remove) ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {domain.actions.recheck ? (
              <Button
                size="sm"
                variant="outline"
                icon={<ArrowsClockwise className={cn("h-3.5 w-3.5", rechecking && "animate-spin")} weight="bold" />}
                iconVisible
                title={t("domains.recheck")}
                disabled={rechecking}
                onClick={() => void recheck()}
              />
            ) : null}
            {domain.actions.remove ? (
              <Button size="sm" variant="ghost" icon={<Trash className="h-3.5 w-3.5" weight="bold" />} iconVisible aria-label={t("domains.remove", { domain: domain.domain })} onClick={() => setConfirmRemove(true)} />
            ) : null}
          </div>
        ) : null}
      </div>

      <DomainSetupNotice domain={domain} onRetry={canConfigure && domain.actions.recheck ? recheck : undefined} />

      {setUp && domain.failure_reason ? (
        <Notice tone="fault" title={t("domains.failedTitle")}>
          <p className="text-foreground">{domain.failure_reason}</p>
          <p>{t("domains.failedHelp")}</p>
        </Notice>
      ) : null}

      {own && setUp ? (
        <div className="space-y-3">
          <VerificationProgress status={domain.status} />
          {domain.status === "verified" ? (
            <details className="group">
              <summary className="w-fit cursor-pointer rounded-sm text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {t("domains.showRecords")}
              </summary>
              <div className="mt-3">
                <DnsRecordsTable records={domain.records} domain={domain.domain} />
              </div>
            </details>
          ) : (
            <>
              <p className="max-w-[72ch] text-xs leading-relaxed text-muted-foreground">{t("domains.recordsHelp")}</p>
              <DnsRecordsTable records={domain.records} domain={domain.domain} />
            </>
          )}
        </div>
      ) : own ? null : (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" weight="fill" />
            {t("domains.sharedManaged")}
          </p>
          <SharedSubdomainControl subdomain={subdomain} canConfigure={canConfigure} onChanged={onChanged} />
        </div>
      )}

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={t("domains.removeTitle", { domain: domain.domain })}
        description={t("domains.removeText")}
        confirmLabel={t("domains.removeConfirm")}
        cancelLabel={t("common.cancel")}
        tone="danger"
        onConfirm={remove}
      />
    </li>
  );
}

function ReleasingDomainRow({ domain }: { domain: EmailDomain }) {
  const t = useTranslations("emailMarketing");
  return (
    <li className="space-y-1.5 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="truncate text-sm font-semibold text-foreground">{domain.domain}</p>
        <StatusChip tone="outline" label={t(`domainKinds.${domain.kind}`)} />
        <StatusChip tone="neutral" label={t("domains.releasingChip")} />
      </div>
      <p className="max-w-[72ch] text-xs leading-relaxed text-muted-foreground">{t("domains.releasingText")}</p>
    </li>
  );
}

export function DomainsPanelList({ setup, canConfigure, onChanged }: { setup: EmailSetup; canConfigure: boolean; onChanged: () => void }) {
  const t = useTranslations("emailMarketing.domains");
  if (setup.domains.length === 0) return <p className="text-sm text-muted-foreground">{t("none")}</p>;
  return (
    <ul className="divide-y divide-border">
      {setup.domains.map((domain) =>
        domain.lifecycle === "releasing" ? (
          <ReleasingDomainRow key={domain.id} domain={domain} />
        ) : (
          <DomainRow key={domain.id} domain={domain} subdomain={setup.subdomain} canConfigure={canConfigure} onChanged={onChanged} />
        ),
      )}
    </ul>
  );
}
