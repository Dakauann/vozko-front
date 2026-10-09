"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { CurrencyDollar, Trash, TrendUp } from "@/components/icons";
import OpportunityLinkedConversations from "@/components/crm/OpportunityLinkedConversations";

import {
  ElevatedSheet,
  ElevatedSheetContent,
  ElevatedSheetHeader,
  ElevatedSheetTitle,
  ElevatedSheetDescription,
} from "@/components/elevated-design/elevated-sheet";
import ElevatedButton from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";

import {
  createOpportunityAction,
  updateOpportunityAction,
  deleteOpportunityAction,
  listOpportunityConversationsAction,
  unlinkOpportunityConversationAction,
} from "@/app/actions/opportunities";
import type { OpportunityConversationLink } from "@/lib/crm/opportunities";
import { useAssignableMembers } from "@/hooks/use-assignable-members";
import { useDealActorLabels } from "@/hooks/use-deal-actor-labels";
import {
  dealActorName,
  formatValueCents,
  parseBRLToCents,
  type DealActorLabels,
  type Opportunity,
  type OpportunityColumn,
} from "@/lib/crm/opportunities";
import OpportunityHistory from "@/components/crm/OpportunityHistory";
import CustomFieldInput from "@/components/crm/CustomFieldInput";
import type { CustomFieldDefinition } from "@/lib/crm/custom-fields";
import { useAuth } from "@/contexts/auth-context";
import { useWorkspace } from "@/contexts/workspace-context";

interface OpportunityDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity: Opportunity | null;
  pipelineId: string;
  columns: OpportunityColumn[];
  customFields: CustomFieldDefinition[];
  workspaceId?: string;
  defaultStageId?: string;
  defaultTitle?: string;
  heading?: string;
  leadId?: string;
  linkEntryId?: string;
  linkEntryType?: string;
  createdNotice?: OpportunityCreatedNotice;
  onSaved?: () => void;
}

export interface OpportunityCreatedNotice {
  message: string;
  action?: { label: string; onClick: () => void };
}

interface LinksOfDeal {
  opportunityId: string;
  links: OpportunityConversationLink[];
}

export default function OpportunityDrawer({
  open,
  onOpenChange,
  opportunity,
  pipelineId,
  columns,
  customFields,
  workspaceId,
  defaultStageId,
  defaultTitle,
  heading,
  leadId,
  linkEntryId,
  linkEntryType,
  createdNotice,
  onSaved,
}: OpportunityDrawerProps) {
  const isEdit = !!opportunity;
  const t = useTranslations("opportunityDrawer");
  const actorLabels = useDealActorLabels();
  const { user } = useAuth();
  const { can } = useWorkspace();
  const currentUserId = user?.id ?? "";
  const canAssignOthers = can("conversations", "assign");

  const [title, setTitle] = useState("");
  const [valueInput, setValueInput] = useState("");
  const [stageId, setStageId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [source, setSource] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [custom, setCustom] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [linksOfDeal, setLinksOfDeal] = useState<LinksOfDeal | null>(null);
  const [draftSeed, setDraftSeed] = useState<string | null>(null);

  const seed = open
    ? JSON.stringify([opportunity?.id ?? "", opportunity?.version ?? 0, opportunity?.updatedAt ?? "", defaultTitle ?? "", defaultStageId ?? "", columns[0]?.id ?? "", currentUserId])
    : null;
  if (seed !== draftSeed) {
    setDraftSeed(seed);
    if (seed !== null) {
      setTitle(opportunity?.title ?? defaultTitle ?? "");
      setValueInput(opportunity ? String((opportunity.valueCents ?? 0) / 100).replace(".", ",") : "");
      setStageId(opportunity?.stageId ?? defaultStageId ?? columns[0]?.id ?? "");
      setOwnerId(opportunity?.ownerId ?? currentUserId);
      setSource(opportunity?.source ?? "");
      setLostReason(opportunity?.lostReasonId ?? "");
      setCustom({ ...(opportunity?.customFields ?? {}) });
    }
  }

  const { members, names: memberNames } = useAssignableMembers(open && !!workspaceId);

  const linkedDealId = open ? (opportunity?.id ?? null) : null;
  const links = linkedDealId && linksOfDeal?.opportunityId === linkedDealId ? linksOfDeal.links : [];

  useEffect(() => {
    if (!linkedDealId) return;
    let cancelled = false;
    void listOpportunityConversationsAction(linkedDealId).then(({ links: read }) => {
      if (!cancelled) setLinksOfDeal({ opportunityId: linkedDealId, links: read });
    });
    return () => {
      cancelled = true;
    };
  }, [linkedDealId]);

  const reloadLinks = useCallback(async (opportunityId: string) => {
    const { links: read } = await listOpportunityConversationsAction(opportunityId);
    setLinksOfDeal({ opportunityId, links: read });
  }, []);

  const handleUnlink = useCallback(
    async (entryId: string, entryType: string) => {
      if (!opportunity) return;
      const { success, error } = await unlinkOpportunityConversationAction(
        opportunity.id,
        entryId,
        entryType,
      );
      if (!success) {
        toast.error(error ?? t("unlinkFailed"));
        return;
      }
      await reloadLinks(opportunity.id);
    },
    [opportunity, reloadLinks, t],
  );

  const selectedColumn = useMemo(
    () => columns.find((c) => c.id === stageId),
    [columns, stageId],
  );
  const needsLostReason = !!selectedColumn?.isLost;
  const needsValue = !!selectedColumn?.isWon;

  const stageNames = useMemo(() => new Map(columns.map((c) => [c.id, c.name])), [columns]);

  const memberOptions = useMemo(() => {
    const options = members.map((m) => ({ value: m.userId, label: memberNames.get(m.userId) ?? m.userId }));
    if (ownerId && !memberNames.has(ownerId)) {
      const resolved = ownerId === opportunity?.ownerId ? opportunity?.ownerName : undefined;
      options.unshift({ value: ownerId, label: dealActorName(ownerId, memberNames, actorLabels, resolved) ?? ownerId });
    }
    return options;
  }, [members, memberNames, ownerId, opportunity?.ownerId, opportunity?.ownerName, actorLabels]);

  const setCustomValue = useCallback((key: string, value: unknown) => {
    setCustom((prev) => {
      const next = { ...prev };
      if (value === "" || value === undefined || value === null) delete next[key];
      else next[key] = value;
      return next;
    });
  }, []);

  const canSave =
    !!stageId && (title.trim().length > 0 || !!opportunity?.leadId || (!isEdit && !!leadId)) && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    if (needsLostReason && !lostReason.trim()) {
      toast.error(t("lostReasonMissing"));
      return;
    }
    const valueCents = parseBRLToCents(valueInput);
    if (needsValue && valueCents <= 0) {
      toast.error(t("wonValueMissing"));
      return;
    }
    setSaving(true);

    if (isEdit && opportunity) {
      const { opportunity: updated, error, conflict } = await updateOpportunityAction(opportunity.id, {
        title: title.trim(),
        valueCents,
        ownerId,
        source: source.trim(),
        customFields: custom,
        stageId,
        lostReasonId: needsLostReason ? lostReason.trim() : "",
        version: opportunity.version,
      });
      setSaving(false);
      if (conflict) {
        toast.error(error ?? t("conflict"));
        onOpenChange(false);
        onSaved?.();
        return;
      }
      if (error || !updated) {
        toast.error(error ?? t("saveFailed"));
        return;
      }
      toast.success(t("updated"));
    } else {
      const { opportunity: created, error } = await createOpportunityAction({
        pipelineId,
        stageId,
        title: title.trim(),
        valueCents,
        ownerId: ownerId || undefined,
        source: source.trim() || undefined,
        customFields: Object.keys(custom).length ? custom : undefined,
        leadId: leadId || undefined,
        linkEntryId: linkEntryId || undefined,
        linkEntryType: linkEntryType || undefined,
      });
      setSaving(false);
      if (error || !created) {
        toast.error(error ?? t("createFailed"));
        return;
      }
      if (createdNotice?.action) toast.success(createdNotice.message, { action: createdNotice.action });
      else toast.success(createdNotice?.message ?? t("created"));
    }
    onOpenChange(false);
    onSaved?.();
  };

  const handleDelete = async () => {
    if (!opportunity) return;
    setDeleting(true);
    const { success, error } = await deleteOpportunityAction(opportunity.id);
    setDeleting(false);
    if (!success) {
      toast.error(error ?? t("deleteFailed"));
      return;
    }
    toast.success(t("deleted"));
    onOpenChange(false);
    onSaved?.();
  };

  const previewValue = formatValueCents(parseBRLToCents(valueInput));

  return (
    <ElevatedSheet open={open} onOpenChange={onOpenChange}>
      <ElevatedSheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <ElevatedSheetHeader className="border-b border-border px-6 pb-4 pt-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <TrendUp weight="bold" className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <ElevatedSheetTitle className="text-lg">
                {isEdit ? t("editTitle") : (heading ?? t("createTitle"))}
              </ElevatedSheetTitle>
              <ElevatedSheetDescription className="text-xs">
                {isEdit ? t("editDescription") : t("createDescription")}
              </ElevatedSheetDescription>
            </div>
          </div>
        </ElevatedSheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <ElevatedInput
            id="opp-title"
            label={t("title")}
            variant="outline"
            controlSize="sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("titlePlaceholder")}
          />

          <div>
            <ElevatedInput
              id="opp-value"
              label={t("value")}
              variant="outline"
              controlSize="sm"
              value={valueInput}
              onChange={(e) => setValueInput(e.target.value)}
              placeholder={t("valuePlaceholder")}
              inputMode="decimal"
              error={needsValue && parseBRLToCents(valueInput) <= 0 ? t("valueRequired") : undefined}
            />
            {valueInput ? (
              <p className="mt-1 flex items-center gap-1 pl-1 text-xs text-muted-foreground">
                <CurrencyDollar weight="bold" className="h-3 w-3" />
                {previewValue}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label className="pl-1 text-sm font-medium text-foreground">{t("stage")}</label>
            <ElevatedSelect value={stageId} onValueChange={setStageId} className="w-full">
              {columns.map((c) => (
                <ElevatedSelectItem key={c.id} value={c.id}>
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 flex-shrink-0 rounded-full ring-1 ring-black/5"
                      style={{ backgroundColor: c.color || "#94a3b8" }}
                    />
                    {c.name}
                    {c.isWon ? ` • ${t("stageWon")}` : c.isLost ? ` • ${t("stageLost")}` : ""}
                  </span>
                </ElevatedSelectItem>
              ))}
            </ElevatedSelect>
          </div>

          {needsLostReason ? (
            <ElevatedInput
              id="opp-lost-reason"
              label={t("lostReason")}
              variant="outline"
              controlSize="sm"
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              placeholder={t("lostReasonPlaceholder")}
              error={needsLostReason && !lostReason.trim() ? t("required") : undefined}
            />
          ) : null}

          <div className="space-y-1.5">
            {canAssignOthers ? (
              <ElevatedCommandSelect
                label={t("owner")}
                options={memberOptions}
                value={ownerId || null}
                onValueChange={(v) => setOwnerId(v)}
                searchPlaceholder={t("ownerSearch")}
                emptyMessage={t("ownerEmpty")}
                fullWidth
              />
            ) : (
              <div>
                <label className="pl-1 text-sm font-medium text-foreground">{t("owner")}</label>
                <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-muted text-2xs font-semibold uppercase text-foreground">
                    {(memberOptions.find((m) => m.value === ownerId)?.label ?? "?").charAt(0)}
                  </span>
                  <span className="truncate">
                    {memberOptions.find((m) => m.value === ownerId)?.label ?? t("ownerYou")}
                  </span>
                </div>
              </div>
            )}
          </div>

          <ElevatedInput
            id="opp-source"
            label={t("source")}
            variant="outline"
            controlSize="sm"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder={t("sourcePlaceholder")}
          />

          {customFields.length > 0 ? (
            <div className="space-y-4 border-t border-border pt-4">
              <p className="text-2xs font-semibold text-muted-foreground">
                {t("customFields")}
              </p>
              {customFields.map((f) => (
                <CustomFieldInput
                  key={f.id}
                  field={f}
                  value={custom[f.key]}
                  onChange={(v) => setCustomValue(f.key, v)}
                />
              ))}
            </div>
          ) : null}

          {opportunity ? <DealAuthorship opportunity={opportunity} members={memberNames} actorLabels={actorLabels} /> : null}

          {isEdit ? <OpportunityLinkedConversations links={links} onUnlink={handleUnlink} /> : null}

          {opportunity ? (
            <OpportunityHistory
              opportunityId={opportunity.id}
              updatedAt={opportunity.updatedAt}
              members={memberNames}
              stageNames={stageNames}
              actorLabels={actorLabels}
            />
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-6 py-4">
          {isEdit ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
            >
              <Trash weight="bold" className="h-3.5 w-3.5" />
              {deleting ? t("deleting") : t("delete")}
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <ElevatedButton
              variant="outline-subtle"
              size="sm"
              title={t("cancel")}
              onClick={() => onOpenChange(false)}
            />
            <ElevatedButton
              variant="primary"
              size="sm"
              title={saving ? t("saving") : isEdit ? t("save") : t("create")}
              onClick={handleSave}
              disabled={!canSave}
            />
          </div>
        </div>
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}

function DealAuthorship({
  opportunity,
  members,
  actorLabels,
}: {
  opportunity: Opportunity;
  members: ReadonlyMap<string, string>;
  actorLabels: DealActorLabels;
}) {
  const t = useTranslations("opportunityDrawer");
  const format = useFormatter();
  const createdBy = dealActorName(opportunity.createdBy, members, actorLabels, opportunity.createdByName);
  const closedBy = dealActorName(opportunity.closedBy, members, actorLabels, opportunity.closedByName);
  const closedAt =
    opportunity.status !== "open" && opportunity.closeDate
      ? format.dateTime(new Date(opportunity.closeDate), { day: "2-digit", month: "short", year: "numeric" })
      : null;
  if (!createdBy && !closedAt) return null;

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-border pt-4 text-xs">
      {createdBy ? (
        <>
          <dt className="text-muted-foreground">{t("createdBy")}</dt>
          <dd className="text-foreground">{createdBy}</dd>
        </>
      ) : null}
      {closedAt ? (
        <>
          <dt className="text-muted-foreground">{opportunity.status === "won" ? t("wonAt") : t("lostAt")}</dt>
          <dd className="text-foreground">{closedBy ? t("closedBy", { date: closedAt, name: closedBy }) : closedAt}</dd>
        </>
      ) : null}
    </dl>
  );
}
