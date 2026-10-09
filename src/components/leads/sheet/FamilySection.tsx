"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { ArrowCounterClockwise, Family, Link as LinkIcon, Plus, X } from "@/components/icons";
import { SectionState } from "@/components/dashboard/attendance/section-state";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { Checkbox } from "@/components/elevated-design/elevated-checkbox";
import { RelativeLines } from "@/components/leads/RelativeLines";
import type { LeadLookupMatch } from "@/app/actions/leads";
import { useLeadLookup } from "@/hooks/use-lead-lookup";
import { useLeadRelatives } from "@/hooks/use-lead-records";
import { relativeFromText, type LeadSheetDraft, type RelativeDraft } from "@/lib/leads/sheet";
import { LEAD_FAMILY_KINDS, LEAD_REFERRAL_KINDS, type LeadRelationKind } from "@/lib/leads/types";

import { SheetHint, SheetIconButton, SheetLinkButton, SheetSection } from "./SheetSection";

let relativeSequence = 0;
function relativeKey(): string {
  relativeSequence += 1;
  return `relative-${relativeSequence}`;
}

export interface FamilySectionProps {
  leadId: string | null;
  draft: LeadSheetDraft;
  onUpdate: (update: (draft: LeadSheetDraft) => LeadSheetDraft) => void;
  canLink: boolean;
  canCreateRelative: boolean;
  hasPrimaryAddress: boolean;
}

export function FamilySection({ leadId, draft, onUpdate, canLink, canCreateRelative, hasPrimaryAddress }: FamilySectionProps) {
  const t = useTranslations("leadSheet.family");
  const [kind, setKind] = useState<LeadRelationKind>("spouse");
  const [text, setText] = useState("");
  const [sameAddress, setSameAddress] = useState(false);
  const relatives = useLeadRelatives(leadId ?? "", !!leadId);
  const lookup = useLeadLookup(text, canLink);
  const existing = useMemo(() => relatives.data?.pages.flatMap((page) => page.items) ?? [], [relatives.data]);

  const kindLabel = (value: LeadRelationKind) => t(`kinds.${value}`);

  const taken = useMemo(() => {
    const ids = new Set<string>();
    if (leadId) ids.add(leadId);
    for (const relative of existing) ids.add(relative.leadId);
    for (const pending of draft.relatives) if (pending.existingLeadId) ids.add(pending.existingLeadId);
    return ids;
  }, [leadId, existing, draft.relatives]);

  const matches = lookup.matches.filter((item) => !taken.has(item.id));
  const typed = relativeFromText(text);

  const addPending = (relative: Omit<RelativeDraft, "key">) => {
    onUpdate((current) => ({ ...current, relatives: [...current.relatives, { ...relative, key: relativeKey() }] }));
    setText("");
    setSameAddress(false);
  };

  const linkExisting = (item: LeadLookupMatch) =>
    addPending({ kind, existingLeadId: item.id, name: item.realName ?? "", number: item.number, copyPrimaryAddress: false });

  const createNew = () => addPending({ kind, name: typed.name, number: typed.number, copyPrimaryAddress: sameAddress && hasPrimaryAddress });

  const toggleRemoved = (relationId: string) =>
    onUpdate((current) => ({
      ...current,
      removedRelationIds: current.removedRelationIds.includes(relationId)
        ? current.removedRelationIds.filter((id) => id !== relationId)
        : [...current.removedRelationIds, relationId],
    }));

  const loadingExisting = !!leadId && relatives.isPending;
  const emptyExisting = !leadId || (relatives.isSuccess && existing.length === 0);

  return (
    <SheetSection icon={<Family />} title={t("title")}>
      {loadingExisting ? <SheetHint>{t("loading")}</SheetHint> : null}
      {leadId ? (
        <SectionState query={relatives} message={t("loadFailed")}>
          {null}
        </SectionState>
      ) : null}
      {emptyExisting && draft.relatives.length === 0 ? <SheetHint>{t("empty")}</SheetHint> : null}

      {existing.length > 0 ? (
        <ul className="divide-y divide-border rounded-[--radius] border border-border">
          {existing.map((relative) => {
            const removed = draft.removedRelationIds.includes(relative.relationId);
            return (
              <RelativeRow
                key={relative.relationId}
                name={relative.name}
                number={relative.number}
                kind={kindLabel(relative.kind)}
                note={removed ? t("willUnlink") : undefined}
                struck={removed}
                action={
                  canLink ? (
                    <SheetIconButton label={removed ? t("undo") : t("unlink")} onClick={() => toggleRemoved(relative.relationId)}>
                      {removed ? <ArrowCounterClockwise /> : <X />}
                    </SheetIconButton>
                  ) : null
                }
              />
            );
          })}
        </ul>
      ) : null}
      {relatives.hasNextPage ? (
        <SheetLinkButton onClick={() => void relatives.fetchNextPage()} disabled={relatives.isFetchingNextPage}>
          {relatives.isFetchingNextPage ? t("loading") : t("loadMore")}
        </SheetLinkButton>
      ) : null}

      {draft.relatives.length > 0 ? (
        <ul className="divide-y divide-border rounded-[--radius] border border-dashed border-border">
          {draft.relatives.map((relative) => (
            <RelativeRow
              key={relative.key}
              name={relative.name}
              number={relative.number}
              kind={kindLabel(relative.kind)}
              note={relative.existingLeadId ? t("willLink") : relative.copyPrimaryAddress ? t("willCreateSameAddress") : t("willCreate")}
              action={
                <SheetIconButton
                  label={t("remove")}
                  onClick={() => onUpdate((current) => ({ ...current, relatives: current.relatives.filter((item) => item.key !== relative.key) }))}
                >
                  <X />
                </SheetIconButton>
              }
            />
          ))}
        </ul>
      ) : null}

      {canLink ? (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <ElevatedSelect label={t("kind")} value={kind} onValueChange={(value) => setKind(value as LeadRelationKind)} className="w-full">
              {LEAD_FAMILY_KINDS.map((value) => (
                <ElevatedSelectItem key={value} value={value}>
                  {kindLabel(value)}
                </ElevatedSelectItem>
              ))}
              {LEAD_REFERRAL_KINDS.map((value) => (
                <ElevatedSelectItem key={value} value={value}>
                  {kindLabel(value)}
                </ElevatedSelectItem>
              ))}
            </ElevatedSelect>
            <ElevatedInput
              id="lead-sheet-relative"
              label={t("search")}
              variant="outline"
              controlSize="sm"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </div>

          {lookup.searching ? <SheetHint>{t("searching")}</SheetHint> : null}
          {lookup.failed ? <SheetHint tone="error">{t("searchFailed")}</SheetHint> : null}
          {lookup.settled && matches.length > 0 ? (
            <div className="space-y-1">
              <SheetHint tone="info">{lookup.byNumber ? t("numberHeld") : t("matches")}</SheetHint>
              <ul className="divide-y divide-border rounded-[--radius] border border-border">
                {matches.map((item) => (
                  <RelativeRow
                    key={item.id}
                    name={item.realName}
                    number={item.number}
                    action={
                      <SheetLinkButton icon={<LinkIcon />} onClick={() => linkExisting(item)}>
                        {t("linkAs", { kind: kindLabel(kind) })}
                      </SheetLinkButton>
                    }
                  />
                ))}
              </ul>
            </div>
          ) : null}

          {text.trim().length > 0 ? (
            canCreateRelative ? (
              <div className="flex flex-wrap items-center gap-3">
                <SheetLinkButton icon={<Plus />} onClick={createNew}>
                  {t("createNew", { text: text.trim() })}
                </SheetLinkButton>
                <label className="flex min-h-[34px] items-center gap-2 text-sm text-foreground sm:min-h-0">
                  <Checkbox
                    checked={sameAddress && hasPrimaryAddress}
                    disabled={!hasPrimaryAddress}
                    onCheckedChange={(checked) => setSameAddress(checked === true)}
                  />
                  {t("sameAddress")}
                </label>
                {!hasPrimaryAddress ? <SheetHint>{t("sameAddressUnavailable")}</SheetHint> : null}
              </div>
            ) : (
              <SheetHint>{t("createForbidden")}</SheetHint>
            )
          ) : null}
        </div>
      ) : (
        <SheetHint>{t("linkForbidden")}</SheetHint>
      )}
    </SheetSection>
  );
}

function RelativeRow({
  name,
  number,
  kind,
  note,
  struck = false,
  action,
}: {
  name?: string;
  number?: string;
  kind?: string;
  note?: string;
  struck?: boolean;
  action?: ReactNode;
}) {
  return (
    <li className="flex items-center gap-2 px-3 py-2">
      <div className={struck ? "min-w-0 flex-1 line-through opacity-60" : "min-w-0 flex-1"}>
        <RelativeLines name={name} number={number} leading={kind} trailing={note} />
      </div>
      {action}
    </li>
  );
}
