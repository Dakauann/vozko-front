"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { isActionError } from "@/app/actions/action-result";
import { connectEmailDomainAction, recheckEmailDomainAction } from "@/app/actions/email-marketing";
import { DnsRecordsTable } from "@/components/email-marketing/dns-records-table";
import { DomainSetupNotice } from "@/components/email-marketing/domain-setup-notice";
import { useEmailError } from "@/components/email-marketing/use-email-error";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSheet, ElevatedSheetContent, ElevatedSheetDescription, ElevatedSheetFooter, ElevatedSheetHeader, ElevatedSheetTitle } from "@/components/elevated-design/elevated-sheet";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { Check, Globe, Minus, Plus } from "@/components/icons";
import { useEmailSetup } from "@/hooks/use-email-marketing";
import { domainStatusTone } from "@/lib/email-marketing/ladder";
import type { EmailDomain } from "@/lib/email-marketing/types";

const ADDED = ["dkim", "bounce", "reply", "dmarc"] as const;
const KEPT = ["mailbox", "website", "others"] as const;

export function ConnectDomainSheet({ open, onOpenChange, onChanged }: { open: boolean; onOpenChange: (open: boolean) => void; onChanged: () => void }) {
  const t = useTranslations("emailMarketing.connect");
  const tm = useTranslations("emailMarketing");
  const describe = useEmailError();
  const [domainInput, setDomainInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<EmailDomain | null>(null);
  const [checking, setChecking] = useState(false);
  const setup = useEmailSetup({ enabled: open });
  const shown = connected ? (setup.data?.domains.find((domain) => domain.id === connected.id) ?? connected) : null;

  const reset = () => {
    setDomainInput("");
    setError(null);
    setConnected(null);
  };

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  const recheck = async (domain: EmailDomain) => {
    setChecking(true);
    const result = await recheckEmailDomainAction(domain.id);
    setChecking(false);
    if (isActionError(result)) {
      toast.error(describe(result));
      return;
    }
    setConnected(result.data);
    onChanged();
  };

  const connect = async (domain: string) => {
    const result = await connectEmailDomainAction(domain);
    if (isActionError(result)) return describe(result);
    setConnected(result.data);
    onChanged();
    return null;
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const refusal = await connect(domainInput.trim());
    setSubmitting(false);
    setError(refusal);
  };

  const retry = async (domain: EmailDomain) => {
    const refusal = await connect(domain.domain);
    if (refusal) toast.error(refusal);
  };

  return (
    <ElevatedSheet open={open} onOpenChange={close}>
      <ElevatedSheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <ElevatedSheetHeader>
          <ElevatedSheetTitle className="text-xl">{t("title")}</ElevatedSheetTitle>
          <ElevatedSheetDescription>{t("description")}</ElevatedSheetDescription>
        </ElevatedSheetHeader>

        {shown ? (
          <div className="space-y-4 px-6">
            <div className="flex flex-wrap items-center gap-2">
              <Globe aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">{shown.domain}</p>
              <StatusChip tone={domainStatusTone(shown.status)} label={tm(`domainStatus.${shown.status}`)} />
            </div>
            {shown.setup.state === "done" ? (
              <>
                <p className="text-sm leading-relaxed text-muted-foreground">{t("afterConnect")}</p>
                <DnsRecordsTable records={shown.records} domain={shown.domain} />
              </>
            ) : (
              <DomainSetupNotice domain={shown} onRetry={() => retry(shown)} />
            )}
          </div>
        ) : (
          <form
            id="email-connect-domain"
            className="space-y-5 px-6"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <ElevatedInput
              label={t("domainLabel")}
              placeholder=" "
              value={domainInput}
              onChange={(event) => setDomainInput(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              required
              error={error ?? undefined}
            />
            <p className="-mt-3 text-xs text-muted-foreground">{t("domainHelp")}</p>

            <section aria-labelledby="email-connect-mailbox" className="rounded-[--radius] border border-border">
              <h3 id="email-connect-mailbox" className="border-b border-border px-4 py-2.5 text-sm font-semibold text-foreground">
                {t("mailbox.title")}
              </h3>
              <div className="grid gap-px bg-border sm:grid-cols-2">
                <div className="bg-card px-4 py-3">
                  <p className="legend mb-2">{t("mailbox.addedLegend")}</p>
                  <ul className="space-y-1.5">
                    {ADDED.map((key) => (
                      <li key={key} className="flex gap-2 text-xs leading-snug text-foreground">
                        <Plus aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" weight="bold" />
                        {t(`mailbox.added.${key}`)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-card px-4 py-3">
                  <p className="legend mb-2">{t("mailbox.keptLegend")}</p>
                  <ul className="space-y-1.5">
                    {KEPT.map((key) => (
                      <li key={key} className="flex gap-2 text-xs leading-snug text-foreground">
                        <Check aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 text-healthy-ink" weight="bold" />
                        {t(`mailbox.kept.${key}`)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <p className="flex gap-2 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
                <Minus aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0" weight="bold" />
                {t("mailbox.note")}
              </p>
            </section>
          </form>
        )}

        <ElevatedSheetFooter className="flex-row flex-wrap justify-end gap-2 border-t border-border">
          {shown ? (
            <>
              <Button variant="outline" title={checking ? t("checking") : t("checkNow")} disabled={checking || shown.setup.state !== "done"} onClick={() => void recheck(shown)} />
              <Button title={t("done")} onClick={() => close(false)} />
            </>
          ) : (
            <>
              <Button variant="outline" title={tm("common.cancel")} onClick={() => close(false)} />
              <Button type="submit" form="email-connect-domain" title={submitting ? t("connecting") : t("submit")} disabled={submitting || domainInput.trim() === ""} />
            </>
          )}
        </ElevatedSheetFooter>
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}
