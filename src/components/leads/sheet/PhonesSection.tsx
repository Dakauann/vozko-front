"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { Plus, Trash, WhatsappLogo } from "@/components/icons";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { SharedNumberHolders } from "@/components/leads/SharedNumberHolders";
import { sharedNumberOfShown, type LeadDetailSummary } from "@/lib/leads/detail-summary";
import { addPhone, type LeadSheetDraft, type PhoneDraft } from "@/lib/leads/sheet";
import { LEAD_PHONE_LABELS, type LeadPhoneLabel, type LeadRecord } from "@/lib/leads/types";

import { SheetHint, SheetIconButton, SheetLinkButton, SheetSection } from "./SheetSection";

export interface IdentityRefusal {
  kind: "taken" | "in_use";
  holderId?: string;
}

function SharedHolders({ summary, stored, shown }: { summary: LeadDetailSummary | undefined; stored: string | undefined; shown: string }) {
  const shared = sharedNumberOfShown(summary, stored, shown);
  if (!shared) return null;
  return (
    <SheetHint>
      <SharedNumberHolders shared={shared} variant="sheet" />
    </SheetHint>
  );
}

export function PhonesSection({
  draft,
  errors,
  identityRefusal,
  onUpdate,
  onMoveNumberToContacts,
  summary,
  stored,
}: {
  draft: LeadSheetDraft;
  errors: Record<string, string>;
  identityRefusal: IdentityRefusal | null;
  onUpdate: (update: (draft: LeadSheetDraft) => LeadSheetDraft) => void;
  onMoveNumberToContacts: () => void;
  summary?: LeadDetailSummary;
  stored?: Pick<LeadRecord, "number" | "phones">;
}) {
  const t = useTranslations("leadSheet.phones");

  const updatePhone = (key: string, patch: Partial<PhoneDraft>) =>
    onUpdate((current) => ({
      ...current,
      phones: current.phones.map((phone) => (phone.key === key ? { ...phone, ...patch } : phone)),
    }));

  const removePhone = (key: string) =>
    onUpdate((current) => ({ ...current, phones: current.phones.filter((phone) => phone.key !== key) }));

  return (
    <SheetSection icon={<WhatsappLogo />} title={t("title")}>
      <div className="space-y-1.5">
        <ElevatedInput
          id="lead-sheet-number"
          label={t("whatsapp")}
          variant="outline"
          controlSize="sm"
          inputMode="tel"
          autoComplete="tel"
          inputClassName="font-mono"
          value={draft.number}
          error={errors.number}
          onChange={(event) => {
            const number = event.target.value;
            onUpdate((current) => ({ ...current, number }));
          }}
        />
        {identityRefusal?.kind === "taken" && identityRefusal.holderId ? (
          <Link
            href={`/dashboard/leads/${identityRefusal.holderId}`}
            className="inline-flex min-h-[34px] items-center pl-1 text-sm font-medium text-primary-ink hover:underline sm:min-h-0"
          >
            {t("openHolder")}
          </Link>
        ) : null}
        {identityRefusal?.kind === "in_use" ? (
          <SheetLinkButton onClick={onMoveNumberToContacts}>
            {t("addAsContact")}
          </SheetLinkButton>
        ) : null}
        <SharedHolders summary={summary} stored={stored?.number} shown={draft.number} />
        {!errors.number ? <SheetHint>{t("whatsappHint")}</SheetHint> : null}
      </div>

      {draft.phones.map((phone, index) => (
        <div key={phone.key} className="space-y-1">
          <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-start gap-2">
            <ElevatedSelect
              label={t("label")}
              value={phone.label}
              onValueChange={(label) => updatePhone(phone.key, { label: label as LeadPhoneLabel })}
              className="w-full"
            >
              {LEAD_PHONE_LABELS.map((label) => (
                <ElevatedSelectItem key={label} value={label}>
                  {t(`labels.${label}`)}
                </ElevatedSelectItem>
              ))}
            </ElevatedSelect>
            <ElevatedInput
              id={`lead-sheet-phone-${phone.key}`}
              label={t("number")}
              variant="outline"
              controlSize="sm"
              inputMode="tel"
              inputClassName="font-mono"
              value={phone.number}
              error={errors[`phones.${index}`]}
              onChange={(event) => updatePhone(phone.key, { number: event.target.value })}
            />
            <SheetIconButton label={t("remove")} onClick={() => removePhone(phone.key)}>
              <Trash />
            </SheetIconButton>
          </div>
          <SharedHolders summary={summary} stored={stored?.phones?.find((candidate) => candidate.id === phone.id)?.number} shown={phone.number} />
        </div>
      ))}

      {errors.phones ? <SheetHint tone="error">{errors.phones}</SheetHint> : null}
      {draft.phones.length > 0 ? <SheetHint>{t("sharedHint")}</SheetHint> : null}

      <SheetLinkButton icon={<Plus />} onClick={() => onUpdate(addPhone)}>
        {t("add")}
      </SheetLinkButton>
    </SheetSection>
  );
}
