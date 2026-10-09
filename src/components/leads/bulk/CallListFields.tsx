"use client";

import { useTranslations } from "next-intl";

import { CallListAssigneePicker } from "@/components/call-lists/CallListAssigneePicker";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import type { CallListPhoneSource } from "@/lib/call-lists/types";
import type { CallListDraft } from "@/lib/leads/bulk-selection";
import { LEAD_PHONE_LABELS, type LeadPhoneLabel } from "@/lib/leads/types";

export function CallListFields({ draft, onChange }: { draft: CallListDraft; onChange: (next: CallListDraft) => void }) {
  const t = useTranslations("leadsPage.bulk.dialog.callList");
  const tLabels = useTranslations("leadSheet.phones.labels");
  const update = (next: Partial<CallListDraft>) => onChange({ ...draft, ...next });

  return (
    <div className="space-y-3">
      <ElevatedInput label={t("name")} placeholder=" " maxLength={120} value={draft.name} onChange={(event) => update({ name: event.target.value })} />
      <CallListAssigneePicker assigneeIds={draft.assigneeIds} onChange={(assigneeIds) => update({ assigneeIds })} />
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{t("phone")}</p>
        <ElevatedPillToggle<CallListPhoneSource>
          aria-label={t("phone")}
          value={draft.phoneSource}
          onChange={(phoneSource) => update({ phoneSource })}
          options={[
            { value: "identity", label: t("identity") },
            { value: "contact", label: t("contact") },
          ]}
        />
        {draft.phoneSource === "contact" ? (
          <ElevatedSelect label={t("label")} aria-label={t("label")} value={draft.phoneLabel} onValueChange={(label) => update({ phoneLabel: label as LeadPhoneLabel })}>
            {LEAD_PHONE_LABELS.map((label) => (
              <ElevatedSelectItem key={label} value={label}>
                {tLabels(label)}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{t("hint")}</p>
    </div>
  );
}
