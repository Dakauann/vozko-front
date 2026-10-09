"use client";

import { useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { startLeadActionAction } from "@/app/actions/lead-actions";
import { AccountPicker } from "@/components/advertising/account-picker";
import { HashingNote } from "@/components/advertising/audiences/hashing-note";
import CustomFieldInput from "@/components/crm/CustomFieldInput";
import Button from "@/components/elevated-design/button";
import { Checkbox } from "@/components/elevated-design/elevated-checkbox";
import {
  ElevatedDialog,
  ElevatedDialogBody,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { LeadOwnerPicker } from "@/components/leads/LeadOwnerPicker";
import { useAdAccounts, type AdAccountsState } from "@/hooks/use-ad-accounts";
import type { CustomFieldDefinition } from "@/lib/crm/custom-fields";
import type { CodedError } from "@/lib/api/coded-error";
import { newIdempotencyKey } from "@/lib/api/idempotency-key";
import {
  leadActionErrorMessage,
  type LeadActionKind,
  type LeadActionPreview,
  type LeadActionPreviewProgress,
  type LeadActionRequest,
  type LeadActionStart,
  type LeadSelection,
} from "@/lib/leads/actions";
import {
  EMPTY_LEAD_ACTION_DRAFT,
  confirmedSelection,
  leadActionParams,
  typedCountMatches,
  type LeadActionDraft,
} from "@/lib/leads/bulk-selection";
import { SELECTION_CHANGED } from "@/lib/selection/errors";

import { PreviewStateBox, TypedCountConfirm } from "./PreviewStateBox";
import { CallListFields } from "./CallListFields";
import { LeadActionCountRows } from "./LeadActionCounts";
import { useLeadActionPreview } from "./use-lead-action-preview";

export interface LeadActionDialogProps {
  action: LeadActionKind;
  selection: LeadSelection;
  size: number;
  fields: readonly CustomFieldDefinition[];
  defaultField?: string;
  readsAddresses: boolean;
  readsSensitive: boolean;
  onClose: () => void;
  onStarted: (start: LeadActionStart) => void;
}

export function LeadActionDialog({
  action,
  selection,
  size,
  fields,
  defaultField,
  readsAddresses,
  readsSensitive,
  onClose,
  onStarted,
}: LeadActionDialogProps) {
  const t = useTranslations("leadsPage.bulk");
  const tLeads = useTranslations("leadsPage");
  const tFields = useTranslations("customFields");
  const tSelection = useTranslations("selection");
  const tCallLists = useTranslations("callLists");
  const format = useFormatter();
  const translators = [t, tLeads, tFields, tCallLists, tSelection];

  const [draft, setDraft] = useState<LeadActionDraft>(() => ({
    ...EMPTY_LEAD_ACTION_DRAFT,
    key: defaultField ?? fields[0]?.key ?? "",
    callList: { ...EMPTY_LEAD_ACTION_DRAFT.callList, name: t("dialog.callList.defaultName", { date: format.dateTime(new Date(), { dateStyle: "short" }) }) },
  }));
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<CodedError | null>(null);
  const [changedFrom, setChangedFrom] = useState<number | null>(null);
  const keys = useRef(new Map<string, string>());
  const accounts = useAdAccounts({ enabled: action === "meta_audience" });

  const params = leadActionParams(action, action === "meta_audience" ? { ...draft, adAccountId: accounts.selected?.id ?? "" } : draft);
  const request: LeadActionRequest | null = params ? { action, params, selection } : null;
  const { preview, refusal, loading, progress, refetch } = useLeadActionPreview(request);

  const everyone = selection.mode === "everyone";
  const confirmable = preview !== null && preview.result.expectedCount > 0;
  const typedOk = !everyone || (preview !== null && typedCountMatches(typed, preview.result.expectedCount));
  const ready = request !== null && confirmable && typedOk && !loading && !busy;

  const change = (next: Partial<LeadActionDraft>) => {
    setDraft((current) => ({ ...current, ...next }));
    setFailure(null);
    setChangedFrom(null);
  };

  const keyFor = (current: LeadActionPreview) => {
    const known = keys.current.get(current.id);
    if (known) return known;
    const fresh = newIdempotencyKey();
    keys.current.set(current.id, fresh);
    return fresh;
  };

  const apply = async () => {
    if (!request || !preview) return;
    setBusy(true);
    setFailure(null);
    const confirmed: LeadActionRequest = {
      ...request,
      selection: confirmedSelection(request.selection, preview.result),
    };
    const answer = await startLeadActionAction(confirmed, keyFor(preview));
    setBusy(false);
    if (answer.error) {
      if (answer.error.code === SELECTION_CHANGED) {
        setChangedFrom(preview.result.expectedCount);
        setTyped("");
        void refetch();
        return;
      }
      setFailure(answer.error);
      return;
    }
    onStarted(answer.data);
    onClose();
  };

  const field = fields.find((candidate) => candidate.key === draft.key);

  return (
    <ElevatedDialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <ElevatedDialogContent className="max-w-lg">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t(`dialog.title.${action}`)}</ElevatedDialogTitle>
          <ElevatedDialogDescription>{t(`dialog.selection.${selection.mode}`, { count: size })}</ElevatedDialogDescription>
        </ElevatedDialogHeader>
        <ElevatedDialogBody className="space-y-4">
          {action === "classify" ? (
            <div className="space-y-3">
              <ElevatedSelect
                label={t("dialog.classify.field")}
                value={draft.key}
                onValueChange={(key) => change({ key, value: undefined })}
              >
                {fields.map((candidate) => (
                  <ElevatedSelectItem key={candidate.key} value={candidate.key}>
                    {candidate.label}
                  </ElevatedSelectItem>
                ))}
              </ElevatedSelect>
              <ElevatedPillToggle<"set" | "clear">
                aria-label={t("dialog.classify.mode")}
                value={draft.clear ? "clear" : "set"}
                onChange={(mode) => change({ clear: mode === "clear" })}
                options={[
                  { value: "set", label: t("dialog.classify.set") },
                  { value: "clear", label: t("dialog.classify.clear") },
                ]}
              />
              {field && !draft.clear ? (
                <CustomFieldInput field={field} value={draft.value} onChange={(value) => change({ value })} />
              ) : null}
            </div>
          ) : null}

          {action === "assign_owner" ? (
            <LeadOwnerPicker ownerId={draft.ownerId} onChange={(ownerId) => change({ ownerId })} />
          ) : null}

          {action === "block" ? (
            <ElevatedPillToggle<"block" | "unblock">
              aria-label={t("dialog.block.mode")}
              value={draft.blocked ? "block" : "unblock"}
              onChange={(mode) => change({ blocked: mode === "block" })}
              options={[
                { value: "block", label: t("dialog.block.block") },
                { value: "unblock", label: t("dialog.block.unblock") },
              ]}
            />
          ) : null}

          {action === "export" ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t("dialog.export.hint")}</p>
              {readsAddresses ? (
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <Checkbox checked={draft.addresses} onCheckedChange={(checked) => change({ addresses: checked === true })} />
                  {t("dialog.export.addresses")}
                </label>
              ) : null}
              {readsSensitive ? (
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <Checkbox checked={draft.sensitive} onCheckedChange={(checked) => change({ sensitive: checked === true })} />
                  {t("dialog.export.sensitive")}
                </label>
              ) : null}
            </div>
          ) : null}

          {action === "meta_audience" ? (
            <AudienceFields
              accounts={accounts}
              draft={draft}
              onChange={change}
              onAccount={(id) => {
                accounts.select(id);
                setFailure(null);
                setChangedFrom(null);
              }}
            />
          ) : null}

          {action === "call_list" ? <CallListFields draft={draft.callList} onChange={(callList) => change({ callList })} /> : null}

          <PreviewBox
            action={action}
            preview={preview}
            loading={loading}
            progress={progress}
            refusal={refusal ? leadActionErrorMessage(translators, refusal) : null}
            onRetry={() => void refetch()}
          />

          {changedFrom !== null && preview && !loading ? (
            <p role="status" className="text-sm font-medium text-foreground">
              {t("dialog.changed", { previous: changedFrom, count: preview.result.expectedCount })}
            </p>
          ) : null}

          {everyone && preview ? (
            <TypedCountConfirm count={preview.result.expectedCount} value={typed} onChange={setTyped} />
          ) : null}

          {failure ? (
            <p role="alert" className="text-sm text-destructive-ink">
              {leadActionErrorMessage(translators, failure)}
            </p>
          ) : null}
        </ElevatedDialogBody>
        <ElevatedDialogFooter>
          <Button variant="secondary" title={t("dialog.cancel")} onClick={onClose} disabled={busy} />
          <Button
            variant="primary"
            title={busy ? t("dialog.applying") : t(`dialog.apply.${action}`)}
            onClick={() => void apply()}
            disabled={!ready}
          />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}

function PreviewBox({
  action,
  preview,
  loading,
  progress,
  refusal,
  onRetry,
}: {
  action: LeadActionKind;
  preview: LeadActionPreview | null;
  loading: boolean;
  progress: LeadActionPreviewProgress | null;
  refusal: string | null;
  onRetry: () => void;
}) {
  const t = useTranslations("leadsPage.bulk");
  if (refusal && !loading) return <PreviewStateBox refusal={refusal} onRetry={onRetry} />;
  if (loading && progress) return <PreviewStateBox pending={t("dialog.previewProgress", { done: progress.done, total: progress.total })} />;
  if (loading || !preview) return <PreviewStateBox pending={loading ? t("dialog.previewing") : t("dialog.previewWaiting")} />;
  return (
    <dl role="status" className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-[--radius] border border-border bg-muted px-3 py-2.5 text-sm">
      <LeadActionCountRows action={action} selected={preview.result.selected} eligible={preview.result.eligible} skipped={preview.result.skipped} />
    </dl>
  );
}

function AudienceFields({
  accounts,
  draft,
  onChange,
  onAccount,
}: {
  accounts: AdAccountsState;
  draft: LeadActionDraft;
  onChange: (next: Partial<LeadActionDraft>) => void;
  onAccount: (id: string) => void;
}) {
  const t = useTranslations("leadsPage.bulk.dialog.audience");
  const tCrm = useTranslations("adsAudiences.crm");
  const tAccount = useTranslations("adsManager.account");

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{tAccount("label")}</p>
        {accounts.loading ? (
          <p className="text-sm text-muted-foreground">{t("loadingAccounts")}</p>
        ) : accounts.error ? (
          <p className="text-xs text-destructive-ink">{t("accountsFailed")}</p>
        ) : accounts.selected ? (
          <AccountPicker className="w-full" accounts={accounts.accounts} value={accounts.selected.id} onChange={onAccount} />
        ) : (
          <p className="text-xs text-muted-foreground">{t("noAccounts")}</p>
        )}
      </div>
      <ElevatedInput label={tCrm("name")} placeholder=" " value={draft.name} onChange={(event) => onChange({ name: event.target.value })} />
      <ElevatedInput
        label={tCrm("descriptionLabel")}
        placeholder=" "
        value={draft.description}
        onChange={(event) => onChange({ description: event.target.value })}
      />
      <HashingNote />
    </div>
  );
}
