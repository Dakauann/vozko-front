"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Check, IdentificationCard, UserPlus, WarningCircle } from "@/components/icons";
import {
  ElevatedSheet,
  ElevatedSheetContent,
  ElevatedSheetDescription,
  ElevatedSheetHeader,
  ElevatedSheetTitle,
} from "@/components/elevated-design/elevated-sheet";
import ElevatedButton from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedDatePicker } from "@/components/elevated-design/elevated-date-picker";
import { ScreenLoader } from "@/components/brand/screen-loader";
import {
  addLeadRelativeAction,
  createLeadAction,
  getLeadByIdAction,
  linkLeadRelationAction,
  removeLeadRelationAction,
  setLeadOwnerAction,
  updateLeadAction,
} from "@/app/actions/leads";
import { useWorkspace } from "@/contexts/workspace-context";
import { refreshLeadQueries, useLeadSummary } from "@/hooks/use-lead-records";
import { useLeadPresentation } from "@/hooks/use-lead-presentation";
import { codedErrorMessage, type CodedRefusal } from "@/lib/api/coded-error";
import { readableFields } from "@/lib/crm/custom-fields";
import { translatedLabel } from "@/lib/format/translated-label";
import { leadFieldLabel } from "@/lib/leads/field-label";
import {
  draftFromRecord,
  emptyLeadDraft,
  leadConflict,
  moveNumberToContacts,
  rebaseDraft,
  refusalShownOnField,
  type LeadConflict,
  type LeadSheetDraft,
} from "@/lib/leads/sheet";
import { saveLeadSheet, type FollowUpFailure, type LeadSheetActions, type LinkOffer } from "@/lib/leads/sheet-save";
import { addressPositions } from "@/lib/leads/map-view";
import type { LeadDuplicate, LeadRecord } from "@/lib/leads/types";

import { AddressesSection } from "./AddressesSection";
import { ConflictBanner } from "./ConflictBanner";
import { ConsentSection } from "./ConsentSection";
import { CustomFieldsSection } from "./CustomFieldsSection";
import { FamilySection } from "./FamilySection";
import { LinkOfferList } from "./LinkOfferList";
import { OwnerSection } from "./OwnerSection";
import { PhonesSection, type IdentityRefusal } from "./PhonesSection";
import { SheetHint, SheetSection } from "./SheetSection";

const LEAD_SHEET_ACTIONS: LeadSheetActions = {
  create: createLeadAction,
  update: updateLeadAction,
  setOwner: setLeadOwnerAction,
  addRelative: addLeadRelativeAction,
  linkRelation: linkLeadRelationAction,
  removeRelation: removeLeadRelationAction,
};

export interface LeadSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId?: string | null;
  onSaved?: (lead: LeadRecord) => void;
  onManageFields?: () => void;
}

export function LeadSheet({ open, onOpenChange, leadId = null, onSaved, onManageFields }: LeadSheetProps) {
  const t = useTranslations("leadSheet");
  const editing = !!leadId;
  return (
    <ElevatedSheet open={open} onOpenChange={onOpenChange}>
      <ElevatedSheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 max-sm:max-w-none max-sm:rounded-none sm:max-w-xl"
      >
        <ElevatedSheetHeader className="border-b border-border px-4 pb-4 pt-6 sm:px-6">
          <div className="flex items-center gap-3 pr-10">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[--radius] bg-muted text-foreground">
              <UserPlus className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <ElevatedSheetTitle className="text-lg">{editing ? t("titleEdit") : t("titleNew")}</ElevatedSheetTitle>
              <ElevatedSheetDescription className="text-xs">{t("description")}</ElevatedSheetDescription>
            </div>
          </div>
        </ElevatedSheetHeader>
        {leadId ? (
          <EditLoader key={leadId} leadId={leadId} onClose={() => onOpenChange(false)} onSaved={onSaved} onManageFields={onManageFields} />
        ) : (
          <LeadSheetForm initialBase={null} onClose={() => onOpenChange(false)} onSaved={onSaved} onManageFields={onManageFields} />
        )}
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}

type LoadState = { status: "ready"; lead: LeadRecord } | { status: "failed" };

function EditLoader({
  leadId,
  onClose,
  onSaved,
  onManageFields,
}: {
  leadId: string;
  onClose: () => void;
  onSaved?: (lead: LeadRecord) => void;
  onManageFields?: () => void;
}) {
  const t = useTranslations("leadSheet");
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ attempt: number; state: LoadState } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getLeadByIdAction(leadId).then((result) => {
      if (cancelled) return;
      setLoaded({ attempt, state: result.lead ? { status: "ready", lead: result.lead } : { status: "failed" } });
    });
    return () => {
      cancelled = true;
    };
  }, [leadId, attempt]);

  if (!loaded || loaded.attempt !== attempt) {
    return (
      <div className="relative flex-1">
        <ScreenLoader fit="fill" label={t("loading")} />
      </div>
    );
  }
  if (loaded.state.status === "failed") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-foreground">{t("loadFailed")}</p>
        <ElevatedButton variant="outline-subtle" size="sm" title={t("retry")} onClick={() => setAttempt((value) => value + 1)} />
      </div>
    );
  }
  return <LeadSheetForm initialBase={loaded.state.lead} onClose={onClose} onSaved={onSaved} onManageFields={onManageFields} />;
}

interface Conflict extends LeadConflict {
  current: LeadRecord;
}

interface Finished {
  lead: LeadRecord;
  duplicates: LeadDuplicate[];
  linkOffers: LinkOffer[];
}

function LeadSheetForm({
  initialBase,
  onClose,
  onSaved,
  onManageFields,
}: {
  initialBase: LeadRecord | null;
  onClose: () => void;
  onSaved?: (lead: LeadRecord) => void;
  onManageFields?: () => void;
}) {
  const t = useTranslations("leadSheet");
  const tLeads = useTranslations("leads");
  const { can, currentWorkspace } = useWorkspace();
  const client = useQueryClient();
  const [base, setBase] = useState<LeadRecord | null>(initialBase);
  const [draft, setDraft] = useState<LeadSheetDraft>(() => (initialBase ? draftFromRecord(initialBase) : emptyLeadDraft()));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [identityRefusal, setIdentityRefusal] = useState<IdentityRefusal | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [keepMine, setKeepMine] = useState<ReadonlySet<string>>(new Set());
  const [rebased, setRebased] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState<Finished | null>(null);

  const readsAddresses = can("leads", "read_addresses");
  const canAssign = can("leads", "assign");
  const canLink = can("leads", "update");
  const canCreateRelative = canLink && can("leads", "create");
  const { fields, ownerName } = useLeadPresentation();
  const summary = useLeadSummary(base?.id ?? "", !!base && can("leads", "read"));
  const addressesEditable = !base || readsAddresses;
  const readableFieldKeys = useMemo(() => new Set(readableFields(fields.definitions).map((field) => field.key)), [fields.definitions]);

  const update = (change: (current: LeadSheetDraft) => LeadSheetDraft) => setDraft(change);

  const issueMessage = (path: string) => {
    if (path.startsWith("phones.")) return t("issues.phone");
    if (path.startsWith("addresses.")) return t("issues.address");
    return t("issues.generic");
  };

  const refusalMessage = (error: CodedRefusal) => codedErrorMessage(tLeads, error, t("failed"));

  const followUpMessage = (failure: FollowUpFailure) => {
    const reason = refusalMessage(failure.error);
    if (failure.step === "owner") return t("followUp.owner", { reason });
    if (failure.step === "unlink") return t("followUp.unlink", { reason });
    return t("followUp.relative", { name: failure.label ?? "", reason });
  };

  const fieldLabel = (field: string) => leadFieldLabel(t, field, fields.definitions);

  const refreshLead = (leadId: string) => {
    refreshLeadQueries(client, currentWorkspace?.id ?? "", leadId);
  };

  const save = async () => {
    setSaving(true);
    setErrors({});
    setIdentityRefusal(null);
    const outcome = await saveLeadSheet({
      base,
      draft,
      access: { addresses: addressesEditable, assign: canAssign },
      actions: LEAD_SHEET_ACTIONS,
    });
    setSaving(false);

    if (outcome.kind === "invalid") {
      setErrors(Object.fromEntries(outcome.issues.map((path) => [path, issueMessage(path)])));
      toast.error(t("reviewFields"));
      return;
    }
    if (outcome.kind === "refused") {
      const message = refusalMessage(outcome.error);
      const path = outcome.path;
      const onField = path !== null && refusalShownOnField(path, { addressesEditable, readableFieldKeys });
      if (onField) setErrors({ [path]: message });
      if (outcome.error.code === "lead_identity_taken") setIdentityRefusal({ kind: "taken", holderId: outcome.error.expected?.leadId });
      if (outcome.error.code === "lead_identity_in_use") setIdentityRefusal({ kind: "in_use" });
      toast.error(onField ? t("reviewFields") : message);
      return;
    }
    if (outcome.kind === "conflict") {
      if (base) setConflict({ current: outcome.current, ...leadConflict(base, outcome.current, draft) });
      setKeepMine(new Set());
      setRebased(false);
      return;
    }

    for (const failure of outcome.followUpFailures) toast.warning(followUpMessage(failure));
    refreshLead(outcome.lead.id);
    onSaved?.(outcome.lead);
    if (outcome.duplicates.length > 0 || outcome.linkOffers.length > 0) {
      setFinished({ lead: outcome.lead, duplicates: outcome.duplicates, linkOffers: outcome.linkOffers });
      return;
    }
    toast.success(base ? t("updated") : t("created"));
    onClose();
  };

  const reapply = () => {
    if (!base || !conflict) return;
    setDraft(rebaseDraft(base, conflict.current, draft, keepMine));
    setBase(conflict.current);
    setConflict(null);
    setRebased(true);
  };

  const discardMine = () => {
    if (!conflict) return;
    setDraft(draftFromRecord(conflict.current));
    setBase(conflict.current);
    setConflict(null);
    setRebased(false);
  };

  if (finished) {
    return (
      <>
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Check className="h-4 w-4 text-healthy-ink" aria-hidden />
            {base ? t("updated") : t("created")}
          </div>
          {finished.linkOffers.length > 0 ? (
            <LinkOfferList leadId={finished.lead.id} offers={finished.linkOffers} onLinked={() => refreshLead(finished.lead.id)} />
          ) : null}
          {finished.duplicates.length > 0 ? <DuplicateList duplicates={finished.duplicates} /> : null}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-4 sm:px-6">
          <ElevatedButton variant="primary" size="sm" title={t("duplicates.done")} onClick={onClose} />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        {conflict ? (
          <ConflictBanner
            current={conflict.current}
            conflict={conflict}
            mine={draft}
            keepMine={keepMine}
            definitions={fields.definitions}
            ownerName={ownerName}
            fieldLabel={fieldLabel}
            onToggleKeep={(field, keep) =>
              setKeepMine((previous) => {
                const next = new Set(previous);
                if (keep) next.add(field);
                else next.delete(field);
                return next;
              })
            }
            onReapply={reapply}
            onDiscard={discardMine}
          />
        ) : null}
        {rebased ? (
          <div role="status" className="mx-4 mt-4 rounded-[--radius] border border-border bg-muted p-3 text-xs text-foreground sm:mx-6">
            {t("conflict.rebased")}
          </div>
        ) : null}

        <SheetSection icon={<IdentificationCard />} title={t("identity.title")}>
          <ElevatedInput
            id="lead-sheet-name"
            label={t("identity.name")}
            variant="outline"
            controlSize="sm"
            autoComplete="name"
            value={draft.name}
            error={errors.name}
            onChange={(event) => {
              const name = event.target.value;
              update((current) => ({ ...current, name }));
            }}
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <ElevatedInput
              id="lead-sheet-nickname"
              label={t("identity.nickname")}
              variant="outline"
              controlSize="sm"
              value={draft.nickname}
              error={errors.nickname}
              onChange={(event) => {
                const nickname = event.target.value;
                update((current) => ({ ...current, nickname }));
              }}
            />
            <div className="space-y-1">
              <ElevatedDatePicker
                id="lead-sheet-birth-date"
                label={t("identity.birthDate")}
                value={draft.birthDate}
                hasError={!!errors.birthDate}
                maxDate={new Date()}
                onChange={(birthDate: string) => update((current) => ({ ...current, birthDate }))}
              />
              {errors.birthDate ? <SheetHint tone="error">{errors.birthDate}</SheetHint> : null}
            </div>
            <ElevatedInput
              id="lead-sheet-email"
              label={t("identity.email")}
              variant="outline"
              controlSize="sm"
              type="email"
              autoComplete="email"
              value={draft.email}
              error={errors.email}
              onChange={(event) => {
                const email = event.target.value;
                update((current) => ({ ...current, email }));
              }}
            />
          </div>
        </SheetSection>

        <PhonesSection
          draft={draft}
          errors={errors}
          summary={summary.data}
          stored={base ?? undefined}
          identityRefusal={identityRefusal}
          onUpdate={update}
          onMoveNumberToContacts={() => {
            if (!base) return;
            update((current) => moveNumberToContacts(current, base));
            setIdentityRefusal(null);
            setErrors((previous) => {
              const next = { ...previous };
              delete next.number;
              return next;
            });
          }}
        />

        <AddressesSection
          draft={draft}
          base={base}
          errors={errors}
          editable={addressesEditable}
          onUpdate={update}
          pin={
            readsAddresses && (!base || canLink)
              ? { leadId: base?.id ?? null, canPlace: canLink, positions: base ? addressPositions(base.addresses) : {}, onPinned: setBase }
              : undefined
          }
        />

        <FamilySection
          leadId={base?.id ?? null}
          draft={draft}
          onUpdate={update}
          canLink={canLink}
          canCreateRelative={canCreateRelative}
          hasPrimaryAddress={draft.addresses.some((address) => address.primary)}
        />

        <OwnerSection
          ownerId={draft.ownerId}
          canAssign={canAssign}
          ownerName={ownerName}
          onChange={(ownerId) => update((current) => ({ ...current, ownerId }))}
        />

        <CustomFieldsSection
          definitions={fields.definitions}
          loading={fields.loading}
          failed={fields.failed}
          draft={draft}
          errors={errors}
          onUpdate={update}
          onManageFields={onManageFields}
        />

        <ConsentSection
          optIn={draft.whatsappOptIn}
          recorded={base?.whatsappOptIn ?? null}
          optedOutAt={base?.optedOutAt ?? null}
          onChange={(whatsappOptIn) => update((current) => ({ ...current, whatsappOptIn }))}
        />
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-4 sm:px-6">
        <ElevatedButton variant="outline-subtle" size="sm" title={t("cancel")} onClick={onClose} />
        <ElevatedButton
          variant="primary"
          size="sm"
          title={saving ? t("saving") : t("save")}
          icon={<Check className="h-3.5 w-3.5" />}
          iconVisible
          disabled={saving || !!conflict}
          onClick={() => void save()}
        />
      </div>
    </>
  );
}

function DuplicateList({ duplicates }: { duplicates: LeadDuplicate[] }) {
  const t = useTranslations("leadSheet.duplicates");
  return (
    <div role="status" className="space-y-2 rounded-[--radius] border border-border bg-muted p-3">
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <WarningCircle className="h-4 w-4 text-info-ink" aria-hidden />
        {t("title")}
      </p>
      <ul className="space-y-1.5">
        {duplicates.map((duplicate) => (
          <li key={duplicate.leadId} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
            <span className="font-medium text-foreground">{duplicate.name || t("unnamed")}</span>
            <span className="text-xs text-muted-foreground">
              {duplicate.reasons.map((reason) => translatedLabel(t, `reasons.${reason}`, "reasons.other")).join(", ")}
            </span>
            <Link
              href={`/dashboard/leads/${duplicate.leadId}`}
              className="ml-auto inline-flex min-h-[34px] items-center text-sm font-medium text-primary-ink hover:underline sm:min-h-0"
            >
              {t("open")}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
