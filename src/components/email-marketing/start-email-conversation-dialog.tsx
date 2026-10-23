"use client";

import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";

import { startEmailConversationAction } from "@/app/actions/email-outreach";
import { useEmailFormat } from "@/components/email-campaigns/shared";
import { TextField } from "@/components/email-editor/fields";
import { ElevatedCommandSelect, type ElevatedCommandOption } from "@/components/elevated-design/elevated-command-select";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { OutreachSendFooter } from "@/components/outreach/outreach-send-footer";
import { Notice } from "@/components/ui/notice";
import { useEmailDesigns } from "@/hooks/use-email-campaigns";
import { useEmailMergeFields, useEmailOutreachAvailability, useEmailOutreachQuote } from "@/hooks/use-email-outreach";
import { codedErrorMessage, type CodedError } from "@/lib/api/coded-error";
import { newIdempotencyKey } from "@/lib/api/idempotency-key";
import { preferredSender } from "@/lib/email-marketing/ladder";
import type { EmailSender } from "@/lib/email-marketing/types";
import {
  emailConversationPayload,
  isComposable,
  missingBalanceMicros,
  type EmailBodyMode,
  type EmailOutreachError,
  type EmailRecipient,
} from "@/lib/email-outreach/types";

export type EmailOutreachTarget = { kind: "lead"; leadId: string; name: string; email: string } | { kind: "address" };

export const EMAIL_ADDRESS_TARGET: EmailOutreachTarget = { kind: "address" };

const SAVED_DESIGNS_SHOWN = 100;

function senderOption(sender: EmailSender): ElevatedCommandOption {
  return {
    value: sender.id,
    label: sender.display_name || sender.address,
    description: sender.display_name ? sender.address : undefined,
    keywords: [sender.address],
  };
}

function LeadRecipient({ label, name, email }: { label: string; name: string; email: string }) {
  return (
    <div className="space-y-1.5">
      <span className="legend">{label}</span>
      <div className="rounded-lg border border-border bg-card px-3 py-2.5">
        <p className="truncate text-sm font-medium text-foreground">{name || <EmptyValue />}</p>
        <p className="readout truncate text-xs text-muted-foreground">{email}</p>
      </div>
    </div>
  );
}

interface ComposerProps {
  onOpenChange: (open: boolean) => void;
  target: EmailOutreachTarget;
  onStarted: (conversationId: string, entryType: string) => void;
}

export function StartEmailConversationDialog({ open, ...composer }: ComposerProps & { open: boolean }) {
  return (
    <ElevatedDialog open={open} onOpenChange={composer.onOpenChange}>
      <ElevatedDialogContent className="max-h-[min(88vh,820px)] overflow-hidden sm:max-w-[640px]">
        <EmailComposer {...composer} />
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}

function EmailComposer({ onOpenChange, target, onStarted }: ComposerProps) {
  const t = useTranslations("emailMarketing");
  const { unitBrl, money } = useEmailFormat();
  const { senders, loading: sendersLoading } = useEmailOutreachAvailability();
  const quote = useEmailOutreachQuote();
  const mergeFields = useEmailMergeFields();
  const [idempotencyKey] = useState(newIdempotencyKey);

  const [pickedSenderId, setSenderId] = useState("");
  const [address, setAddress] = useState("");
  const [subject, setSubject] = useState("");
  const [mode, setMode] = useState<EmailBodyMode>("text");
  const [text, setText] = useState("");
  const [designId, setDesignId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<EmailOutreachError | null>(null);
  const [sentUnrecorded, setSentUnrecorded] = useState(false);

  const designs = useEmailDesigns({ kind: "template", pageSize: SAVED_DESIGNS_SHOWN }, mode === "design");

  const coded = useCallback((failure: CodedError) => codedErrorMessage(t, failure, t("errors.default")), [t]);

  const senderId = pickedSenderId || (preferredSender(senders)?.id ?? "");

  const recipient: EmailRecipient = target.kind === "lead" ? { kind: "lead", leadId: target.leadId } : { kind: "address", address };
  const composition = { senderId, subject, mode, text, designId };
  const hasSenders = senders.length > 0;
  const canSubmit = hasSenders && isComposable(recipient, composition) && !busy && !sentUnrecorded;

  const senderOptions = useMemo(() => senders.map(senderOption), [senders]);
  const designOptions = useMemo<ElevatedCommandOption[]>(
    () => (designs.data?.items ?? []).map((design) => ({ value: design.id, label: design.name })),
    [designs.data],
  );

  const submit = async () => {
    setBusy(true);
    setError(null);
    const { conversation, error: refusal } = await startEmailConversationAction(
      emailConversationPayload(recipient, composition, idempotencyKey),
    );
    setBusy(false);
    if (refusal || !conversation) {
      setError(refusal ?? { code: "email_send_failed", message: "" });
      return;
    }
    if (conversation.recorded && conversation.conversation_id) {
      onStarted(conversation.conversation_id, conversation.entry_type);
      onOpenChange(false);
      return;
    }
    setSentUnrecorded(true);
  };

  const price = quote.data ? unitBrl(quote.data.unit_brl) : null;
  const missingMicros = missingBalanceMicros(error);
  const missing = missingMicros !== null && quote.data ? money(missingMicros, quote.data.exchange_rate) : null;

  return (
    <>
      <ElevatedDialogHeader>
        <ElevatedDialogTitle>{t("outreach.title")}</ElevatedDialogTitle>
        <ElevatedDialogDescription>{t("outreach.description")}</ElevatedDialogDescription>
      </ElevatedDialogHeader>

      <div className="-mx-7 min-h-0 flex-1 overflow-y-auto px-7">
        {!hasSenders && !sendersLoading ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            {t("outreach.noSenders")}
          </p>
        ) : (
          <div className="space-y-5">
            <ElevatedCommandSelect
              label={t("outreach.fromLabel")}
              value={senderId}
              onValueChange={setSenderId}
              options={senderOptions}
              isLoading={sendersLoading}
              searchPlaceholder={t("outreach.senderSearch")}
              emptyMessage={t("outreach.senderEmpty")}
              contentClassName="z-[200]"
              fullWidth
            />

            {target.kind === "lead" ? (
              <LeadRecipient label={t("outreach.toLabel")} name={target.name} email={target.email} />
            ) : (
              <ElevatedInput
                label={t("outreach.addressLabel")}
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder={t("outreach.addressPlaceholder")}
                type="email"
                inputMode="email"
                autoComplete="off"
                className="w-full"
              />
            )}

            <TextField label={t("outreach.subjectLabel")} value={subject} onChange={setSubject} fieldKey="outreach-subject" mergeTags={mergeFields} />

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="legend">{t("outreach.contentLabel")}</span>
                <ElevatedPillToggle<EmailBodyMode>
                  aria-label={t("outreach.contentLabel")}
                  value={mode}
                  onChange={setMode}
                  size="md"
                  options={[
                    { value: "text", label: t("outreach.modes.text") },
                    { value: "design", label: t("outreach.modes.design") },
                  ]}
                />
              </div>

              {mode === "text" ? (
                <div className="space-y-1">
                  <TextField label={t("outreach.textLabel")} value={text} onChange={setText} fieldKey="outreach-text" multiline rows={8} mergeTags={mergeFields} />
                  <p className="text-2xs leading-relaxed text-muted-foreground">{t("outreach.mergeHint")}</p>
                </div>
              ) : (
                <ElevatedCommandSelect
                  label={t("outreach.designLabel")}
                  value={designId}
                  onValueChange={setDesignId}
                  options={designOptions}
                  isLoading={designs.isPending}
                  searchPlaceholder={t("outreach.designSearch")}
                  emptyMessage={t("outreach.designEmpty")}
                  contentClassName="z-[200]"
                  fullWidth
                />
              )}
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-xs">
              <span className="text-muted-foreground">{t("outreach.priceLabel")}</span>
              <span className="readout font-medium text-foreground">{price ?? <EmptyValue />}</span>
            </div>

            {quote.error ? (
              <Notice tone="warning">
                <p>{coded(quote.error)}</p>
              </Notice>
            ) : null}

            {error ? (
              <Notice tone="fault">
                <p>{coded(error)}</p>
                {missing ? <p>{t("outreach.missingBalance", { missing })}</p> : null}
              </Notice>
            ) : null}

            {sentUnrecorded ? (
              <Notice tone="healthy" title={t("outreach.sentNotRecordedTitle")}>
                <p>{t("outreach.sentNotRecorded")}</p>
              </Notice>
            ) : null}
          </div>
        )}
      </div>

      <OutreachSendFooter
        labels={{ cancel: sentUnrecorded ? t("outreach.close") : t("outreach.cancel"), submit: t("outreach.submit"), sending: t("outreach.sending") }}
        busy={busy}
        canSubmit={canSubmit}
        showSubmit={hasSenders && !sentUnrecorded}
        onCancel={() => onOpenChange(false)}
        onSubmit={() => void submit()}
      />
    </>
  );
}
