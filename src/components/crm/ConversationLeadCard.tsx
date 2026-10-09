"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { ArrowRight, BellSlash, Family, PencilSimple } from "@/components/icons";
import { SectionState } from "@/components/dashboard/attendance/section-state";
import ElevatedButton from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { LeadOptOutDialog } from "@/components/leads/LeadOptOutDialog";
import { LeadOwnerPicker } from "@/components/leads/LeadOwnerPicker";
import { OwnerChip } from "@/components/leads/OwnerChip";
import { rowsNeedMemberDirectory } from "@/components/leads/use-lead-columns";
import { useOptOutLine } from "@/components/leads/use-opt-out-line";
import { setLeadDistrictAction, setLeadOwnerAction } from "@/app/actions/leads";
import { useWorkspace } from "@/contexts/workspace-context";
import { useEntryLeadCard } from "@/hooks/use-lead-records";
import { useLeadPresentation } from "@/hooks/use-lead-presentation";
import { codedErrorMessage, type CodedError } from "@/lib/api/coded-error";
import type { LeadPatch } from "@/lib/conversations/lead-patch";
import type { EntryType } from "@/lib/conversations/types";
import { areaLine, leadDetailHref } from "@/lib/leads/detail";
import type { LeadCard } from "@/lib/leads/types";

import { CustomFieldValue } from "./CustomFieldValue";
import { ContactInfoRow } from "./ContactInfoRow";

export interface ConversationLeadCardProps {
  entryId: string;
  entryType: EntryType;
  leadId: string;
  leadVersion: number | undefined;
  active: boolean;
  onLeadPatched: (leadId: string, patch: LeadPatch) => void;
}

function useConversationLeadCard({ entryId, entryType, leadId, leadVersion, active }: ConversationLeadCardProps) {
  const { can } = useWorkspace();
  const enabled = active && leadId !== "";
  const query = useEntryLeadCard({ entryId, entryType, leadVersion, enabled });
  const { classification, ownerName } = useLeadPresentation(enabled, { directory: rowsNeedMemberDirectory(query.data ? [query.data] : []) });
  return {
    query,
    classification,
    ownerName,
    permissions: { update: can("leads", "update"), assign: can("leads", "assign"), open: can("leads", "read") },
  };
}

function useCommandRefusal() {
  const tErrors = useTranslations("leads");
  return (title: string, error: CodedError) =>
    toast.error(title, { description: codedErrorMessage(tErrors, error, "") || undefined });
}

export function ConversationLeadSummary(props: ConversationLeadCardProps) {
  const t = useTranslations("crmContactPanel.lead");
  const refused = useCommandRefusal();
  const { query, classification, ownerName, permissions } = useConversationLeadCard(props);
  const [editingOwner, setEditingOwner] = useState(false);
  const [saving, setSaving] = useState(false);
  const card = query.data;
  if (!card) return null;

  const owner = ownerName(card.owner, card.ownerName);
  const classificationValue = classification ? card.customFields?.[classification.key] : undefined;

  const changeOwner = async (ownerId: string) => {
    if (ownerId === (card.owner ?? "")) {
      setEditingOwner(false);
      return;
    }
    setSaving(true);
    try {
      const result = await setLeadOwnerAction(card.leadId, ownerId);
      if (result.error) {
        refused(t("ownerFailed"), result.error);
        return;
      }
      props.onLeadPatched(card.leadId, { lead_version: result.lead.version });
      setEditingOwner(false);
      toast.success(t("ownerSaved"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-1.5 space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {classification && classificationValue !== undefined ? <CustomFieldValue field={classification} value={classificationValue} /> : null}
        <span className="inline-flex items-center text-2xs font-medium text-muted-foreground">
          {owner ? <OwnerChip name={owner} className="text-foreground" /> : t("noOwner")}
        </span>
        {permissions.assign ? (
          <button
            type="button"
            onClick={() => setEditingOwner((value) => !value)}
            aria-label={t("editOwner")}
            title={t("editOwner")}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <PencilSimple className="h-3 w-3" weight="bold" />
          </button>
        ) : null}
      </div>
      {editingOwner ? <LeadOwnerPicker ownerId={card.owner ?? ""} onChange={(ownerId) => void changeOwner(ownerId)} disabled={saving} /> : null}
    </div>
  );
}

function PanelGroup({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={className ?? "bg-card px-4 py-2.5"}>
      <dt className="sr-only">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function AreaForm({ card, onDone, onSaved }: { card: LeadCard; onDone: () => void; onSaved: (version: number) => void }) {
  const t = useTranslations("crmContactPanel.lead");
  const refused = useCommandRefusal();
  const [district, setDistrict] = useState(card.area?.district ?? "");
  const [city, setCity] = useState(card.area?.city ?? "");
  const [state, setState] = useState(card.area?.state ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const sameCity = city.trim() === (card.area?.city ?? "") && state.trim() === (card.area?.state ?? "");
    setSaving(true);
    try {
      const result = await setLeadDistrictAction(card.leadId, {
        district: district.trim(),
        city: city.trim(),
        state: state.trim(),
        ...(sameCity && card.area?.cityCode ? { cityCode: card.area.cityCode } : {}),
      });
      if (result.error) {
        refused(t("areaFailed"), result.error);
        return;
      }
      toast.success(t("areaSaved"));
      onSaved(result.lead.version);
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <PanelGroup label={t("district")} className="bg-card px-4 py-3">
      <form aria-label={t("editArea")} onSubmit={(event) => void submit(event)} className="space-y-2">
        <ElevatedInput label={t("district")} placeholder=" " value={district} onChange={(event) => setDistrict(event.target.value)} controlSize="sm" />
        <div className="grid grid-cols-[1fr_5rem] gap-2">
          <ElevatedInput label={t("city")} placeholder=" " value={city} onChange={(event) => setCity(event.target.value)} controlSize="sm" />
          <ElevatedInput label={t("state")} placeholder=" " value={state} maxLength={2} onChange={(event) => setState(event.target.value.toUpperCase())} controlSize="sm" />
        </div>
        <div className="flex justify-end gap-2">
          <ElevatedButton type="button" variant="outline-subtle" size="sm" title={t("cancel")} onClick={onDone} disabled={saving} />
          <ElevatedButton type="submit" variant="primary" size="sm" title={t("save")} disabled={saving} />
        </div>
      </form>
    </PanelGroup>
  );
}

export function ConversationLeadRows(props: ConversationLeadCardProps) {
  const t = useTranslations("crmContactPanel.lead");
  const tActions = useTranslations("leadDetail.actions");
  const { query, permissions } = useConversationLeadCard(props);
  const [editingArea, setEditingArea] = useState(false);
  const [optingOut, setOptingOut] = useState(false);
  const [optedOut, setOptedOut] = useState<string | null>(null);
  const optOutLine = useOptOutLine(query.data?.optedOutAt, query.data?.optOutSource);

  if (query.isError) {
    return (
      <PanelGroup label={t("record")}>
        <SectionState query={query} message={t("loadFailed")}>
          {null}
        </SectionState>
      </PanelGroup>
    );
  }
  const card = query.data;
  if (!card) return null;

  const area = areaLine(card.area);
  const familyText = t("familyCount", { count: card.relativesCount });
  const leadPath = leadDetailHref(card.leadId);
  const isOptedOut = !!optOutLine || optedOut === card.leadId;

  return (
    <>
      {editingArea ? (
        <AreaForm
          card={card}
          onDone={() => setEditingArea(false)}
          onSaved={(version) => props.onLeadPatched(card.leadId, { lead_version: version })}
        />
      ) : (
        <ContactInfoRow label={t("district")}>
          <span className="inline-flex items-center gap-1.5 text-foreground">
            {area || <EmptyValue />}
            {permissions.update ? (
              <button
                type="button"
                onClick={() => setEditingArea(true)}
                aria-label={t("editArea")}
                title={t("editArea")}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <PencilSimple className="h-3 w-3" weight="bold" />
              </button>
            ) : null}
          </span>
        </ContactInfoRow>
      )}
      <ContactInfoRow label={t("family")}>
        <span className="inline-flex flex-col items-end gap-0.5 text-foreground">
          <span className="inline-flex items-center gap-1">
            <Family className="h-3 w-3 text-muted-foreground" aria-hidden />
            {permissions.open && card.relativesCount > 0 ? (
              <Link href={`${leadPath}?tab=family`} className="hover:underline">
                {familyText}
              </Link>
            ) : (
              familyText
            )}
          </span>
          {card.referredCount > 0 ? <span className="text-muted-foreground">{t("referredCount", { count: card.referredCount })}</span> : null}
        </span>
      </ContactInfoRow>
      {isOptedOut || permissions.update ? (
        <ContactInfoRow label={t("messages")}>
          {isOptedOut ? (
            <span className="inline-flex flex-col items-end gap-0.5">
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <BellSlash className="h-3 w-3" aria-hidden />
                {t("optedOut")}
              </span>
              {optOutLine ? <span className="text-muted-foreground">{optOutLine}</span> : null}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setOptingOut(true)}
              className="inline-flex items-center gap-1 rounded-[--radius] text-xs font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <BellSlash className="h-3 w-3 text-muted-foreground" aria-hidden />
              {tActions("optOut")}
            </button>
          )}
        </ContactInfoRow>
      ) : null}
      {optingOut ? (
        <LeadOptOutDialog
          leadId={card.leadId}
          onOpenChange={setOptingOut}
          onRecorded={(record) => {
            setOptedOut(card.leadId);
            props.onLeadPatched(card.leadId, { lead_version: record.version });
          }}
        />
      ) : null}
      {permissions.open ? (
        <PanelGroup label={t("record")}>
          <Link href={leadPath} className="inline-flex items-center gap-1 text-xs font-medium text-primary-ink hover:underline">
            {t("openRecord")}
            <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </PanelGroup>
      ) : null}
    </>
  );
}
