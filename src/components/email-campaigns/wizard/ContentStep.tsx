"use client";

import { useTranslations } from "next-intl";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { createEmailDesignAction, isEmailActionError } from "@/app/actions/email-campaigns";
import { EmailEditor } from "@/components/email-editor";
import type { EnvelopePort } from "@/components/email-editor/agent/email-agent";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { ArrowsClockwise, FloppyDisk, UserCircle } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Notice } from "@/components/ui/notice";
import { useEmailSenders } from "@/hooks/use-email-campaigns";
import { MAX_PREHEADER_RUNES, MAX_SUBJECT_RUNES } from "@/lib/email-design/limits";
import type { Envelope } from "@/lib/email-design/agent/steps";
import type { CustomField } from "@/lib/email-design/merge-tags";
import type { Document, Hint, Issue } from "@/lib/email-design/types";
import type { CampaignDraft } from "@/lib/email-campaigns/draft";
import { envelopeOfDraft, undoneEnvelope } from "@/lib/email-campaigns/envelope";
import type { Sender } from "@/lib/email-campaigns/types";

import { DocumentPicker } from "../designs/DocumentPicker";
import { useEmailErrorMessage, useEmailPermission } from "../shared";
import { AbTestFields } from "./AbTestFields";
import { CharacterCount, SubjectField } from "./SubjectField";
import { TestSendPanel } from "./TestSendPanel";
import type { useEmailPreview } from "./use-preview";

const NAME_LIMIT = 120;

function senderLabel(sender: Sender): string {
  return sender.display_name ? `${sender.display_name} <${sender.address}>` : sender.address;
}

function InboxRow({ sender, subject, preheader }: { sender: string; subject: string; preheader: string }) {
  const t = useTranslations("emailCampaigns.content.inbox");
  return (
    <div className="rounded-lg border border-border bg-card" aria-label={t("label")} role="group">
      <p className="legend border-b border-border px-3 py-1.5">{t("label")}</p>
      <div className="flex items-start gap-3 px-3 py-2.5">
        <UserCircle className="mt-0.5 h-8 w-8 shrink-0 text-muted-foreground" weight="fill" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{sender || t("noSender")}</p>
          <p className="truncate text-sm text-foreground">{subject || <span className="text-muted-foreground">{t("noSubject")}</span>}</p>
          <p className="truncate text-xs text-muted-foreground">{preheader || t("noPreheader")}</p>
        </div>
      </div>
    </div>
  );
}

function useEnvelopePort(draft: CampaignDraft, onDraftChange: (patch: Partial<CampaignDraft>) => void): EnvelopePort {
  const t = useTranslations("emailCampaigns.content.agent");
  const latest = useRef({ draft, onDraftChange, t });

  useLayoutEffect(() => {
    latest.current = { draft, onDraftChange, t };
  });

  return useMemo<EnvelopePort>(() => {
    const change = (next: Envelope) => {
      latest.current.draft = { ...latest.current.draft, ...next };
      latest.current.onDraftChange(next);
    };
    return {
      read: () => envelopeOfDraft(latest.current.draft),
      apply: (next, previous) => {
        change(next);
        toast(latest.current.t("envelopeChanged"), {
          action: { label: latest.current.t("undo"), onClick: () => change(undoneEnvelope(next, envelopeOfDraft(latest.current.draft), previous)) },
        });
      },
    };
  }, []);
}

export function ContentStep({
  draft,
  onDraftChange,
  customFields,
  campaignId,
  readOnly,
  prepare,
  preview,
  reviewIssues,
  reviewHints,
}: {
  draft: CampaignDraft;
  onDraftChange: (patch: Partial<CampaignDraft>) => void;
  customFields: readonly CustomField[];
  campaignId: string | null;
  readOnly: boolean;
  prepare: () => Promise<boolean>;
  preview: ReturnType<typeof useEmailPreview>;
  reviewIssues: readonly Issue[];
  reviewHints: readonly Hint[];
}) {
  const t = useTranslations("emailCampaigns.content");
  const allowed = useEmailPermission();
  const errorMessage = useEmailErrorMessage();
  const senders = useEmailSenders();
  const [replacing, setReplacing] = useState(false);
  const [savingDesign, setSavingDesign] = useState(false);
  const envelope = useEnvelopePort(draft, onDraftChange);

  const senderList = useMemo(() => senders.data ?? [], [senders.data]);
  const chosenSender = senderList.find((sender) => sender.id === draft.senderId) ?? senderList.find((sender) => sender.is_default);
  const issues = preview.issues.length > 0 ? preview.issues : reviewIssues;
  const hints = preview.hints.length > 0 ? preview.hints : reviewHints;
  const docPreheader = draft.document?.settings.preheader ?? "";

  const pick = (document: Document) => onDraftChange({ document });

  const saveAsDesign = async () => {
    if (!draft.document) return;
    setSavingDesign(true);
    const result = await createEmailDesignAction({ name: draft.name.trim() || t("designFallbackName"), kind: "template", document: draft.document });
    setSavingDesign(false);
    if (isEmailActionError(result)) {
      toast.error(t("saveDesign.failed"), { description: errorMessage(result) });
      return;
    }
    toast.success(t("saveDesign.done", { name: result.data.name }));
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]" aria-label={t("envelope")}>
        <div className="space-y-4">
          <ElevatedInput
            label={t("name")}
            value={draft.name}
            disabled={readOnly}
            maxLength={NAME_LIMIT}
            onChange={(event) => onDraftChange({ name: event.target.value })}
          />
          <p className="-mt-2 px-1 text-2xs text-muted-foreground">{t("nameHint")}</p>

          {senders.isSuccess && senderList.length === 0 ? (
            <Notice tone="warning" title={t("noSenders")}>
              <p>{t("noSendersHint")}</p>
              <Button variant="secondary" size="sm" title={t("goToSenders")} link="/dashboard/email/senders" newTab={false} />
            </Notice>
          ) : (
            <ElevatedSelect
              label={t("sender")}
              value={chosenSender?.id ?? ""}
              disabled={readOnly || senders.isPending}
              onValueChange={(senderId) => onDraftChange({ senderId })}
            >
              {senderList.map((sender) => (
                <ElevatedSelectItem key={sender.id} value={sender.id}>
                  {sender.is_default ? t("senderDefault", { sender: senderLabel(sender) }) : senderLabel(sender)}
                </ElevatedSelectItem>
              ))}
            </ElevatedSelect>
          )}

          <SubjectField
            label={t("subject")}
            value={draft.subject}
            onChange={(subject) => onDraftChange({ subject })}
            limit={MAX_SUBJECT_RUNES}
            customFields={customFields}
            disabled={readOnly}
          />

          <div>
            <ElevatedInput
              label={t("preheader")}
              value={draft.preheader}
              disabled={readOnly}
              onChange={(event) => onDraftChange({ preheader: event.target.value })}
            />
            <div className="mt-1 flex items-center justify-between gap-2 px-1">
              <span className="truncate text-2xs text-muted-foreground">{docPreheader && !draft.preheader ? t("preheaderFromDesign", { text: docPreheader }) : t("preheaderHint")}</span>
              <CharacterCount value={draft.preheader} limit={MAX_PREHEADER_RUNES} />
            </div>
          </div>

          <AbTestFields value={draft.ab} onChange={(ab) => onDraftChange({ ab })} customFields={customFields} disabled={readOnly} />
        </div>

        <div className="space-y-3">
          <InboxRow sender={chosenSender ? chosenSender.display_name || chosenSender.address : ""} subject={preview.subject ?? draft.subject} preheader={draft.preheader || docPreheader} />
          {draft.ab.enabled ? (
            <InboxRow sender={chosenSender ? chosenSender.display_name || chosenSender.address : ""} subject={draft.ab.variantBSubject} preheader={draft.preheader || docPreheader} />
          ) : null}
          <p className="px-1 text-2xs leading-relaxed text-muted-foreground">{t("inbox.sample")}</p>
        </div>
      </section>

      <section aria-label={t("design")} className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-foreground">{t("design")}</h3>
            <p className="text-sm text-muted-foreground">{draft.document ? t("designHint") : t("designPick")}</p>
          </div>
          {draft.document ? (
            <div className="flex flex-wrap items-center gap-2">
              {!readOnly ? (
                <Button variant="ghost" size="sm" title={t("replace")} icon={<ArrowsClockwise className="h-4 w-4" />} iconVisible iconSide="left" onClick={() => setReplacing(true)} />
              ) : null}
              {allowed("create") ? (
                <Button
                  variant="ghost"
                  size="sm"
                  title={savingDesign ? t("saveDesign.saving") : t("saveDesign.action")}
                  icon={<FloppyDisk className="h-4 w-4" />}
                  iconVisible
                  iconSide="left"
                  disabled={savingDesign}
                  onClick={() => void saveAsDesign()}
                />
              ) : null}
              <TestSendPanel campaignId={campaignId} prepare={prepare} disabled={!draft.name.trim()} />
            </div>
          ) : null}
        </div>

        {draft.document ? (
          <EmailEditor
            value={draft.document}
            onChange={(document) => onDraftChange({ document })}
            issues={issues}
            hints={hints}
            customFields={customFields}
            onRequestPreview={() => void preview.request()}
            previewHtml={preview.html}
            previewLoading={preview.loading}
            readOnly={readOnly}
            agent={campaignId ? { surface: "email_campaign", projectId: campaignId, name: draft.name.trim() || t("designFallbackName"), envelope } : undefined}
            className="h-[calc(100vh-12rem)] min-h-[640px]"
          />
        ) : readOnly ? (
          <Notice tone="info" title={t("noDesign")} />
        ) : (
          <DocumentPicker onPick={pick} />
        )}
      </section>

      <ConfirmDialog
        open={replacing}
        onOpenChange={setReplacing}
        tone="default"
        title={t("replaceConfirm.title")}
        description={t("replaceConfirm.body")}
        confirmLabel={t("replaceConfirm.action")}
        onConfirm={() => {
          onDraftChange({ document: null });
          setReplacing(false);
        }}
      />
    </div>
  );
}
