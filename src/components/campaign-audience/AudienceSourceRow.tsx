"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { FileCsv, UserPlus, Users } from "@/components/icons";
import { LeadSheet } from "@/components/leads/sheet/LeadSheet";
import type { AudienceSource } from "@/lib/campaign-audience/types";
import { emptyLeadDraft } from "@/lib/leads/sheet";
import type { LeadRecord } from "@/lib/leads/types";

const SOURCE_ICONS: Record<AudienceSource, typeof Users> = { leads: Users, list: FileCsv };

function NewLeadButton({ onSaved, disabled }: { onSaved: (lead: LeadRecord) => void; disabled: boolean }) {
  const t = useTranslations("campaignAudience.step");
  const tSheet = useTranslations("leadSheet");
  const tLeads = useTranslations("leadsPage.header");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        title={tLeads("newLead")}
        icon={<UserPlus className="h-4 w-4" />}
        iconVisible
        iconSide="left"
        disabled={disabled}
        onClick={() => setOpen(true)}
      />
      {open ? (
        <LeadSheet
          open={open}
          onOpenChange={setOpen}
          seed={{ draft: emptyLeadDraft(), title: tSheet("titleNew"), description: t("newLeadHint", { rule: tSheet("description") }) }}
          onSaved={(lead) => {
            onSaved(lead);
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

export function AudienceSourceRow({
  sources,
  value,
  onChange,
  onLeadSaved,
  readOnly = false,
}: {
  sources: readonly AudienceSource[];
  value: AudienceSource;
  onChange: (source: AudienceSource) => void;
  onLeadSaved: (lead: LeadRecord) => void;
  readOnly?: boolean;
}) {
  const t = useTranslations("campaignAudience.step");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="legend">{t("sourceLabel")}</span>
      {sources.length > 1 ? (
        <ElevatedPillToggle<AudienceSource>
          aria-label={t("sourceLabel")}
          size="md"
          value={value}
          onChange={onChange}
          options={sources.map((source) => {
            const Icon = SOURCE_ICONS[source];
            return { value: source, label: t(`sources.${source}`), icon: <Icon className="h-4 w-4" />, disabled: readOnly };
          })}
        />
      ) : null}
      <span className="text-xs text-muted-foreground">{t(`sourceHints.${value}`)}</span>
      {value === "leads" ? (
        <span className="ml-auto">
          <NewLeadButton onSaved={onLeadSaved} disabled={readOnly} />
        </span>
      ) : null}
    </div>
  );
}
