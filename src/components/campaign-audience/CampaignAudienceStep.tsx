"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Notice } from "@/components/ui/notice";
import { sourcesOf, withNewLead, withVariableChoice } from "@/lib/campaign-audience/draft";
import type { AudienceCount, VariableCount } from "@/lib/campaign-audience/types";

import { AudienceArrives } from "./AudienceArrives";
import { AudienceCountPanel } from "./AudienceCountPanel";
import { AudienceLeadsSheet, type AudienceLeadFocus } from "./AudienceLeadsSheet";
import { AudienceListSection } from "./AudienceListSection";
import { AudienceSourceRow } from "./AudienceSourceRow";
import { AudienceVariablesPanel } from "./AudienceVariablesPanel";
import { LeadsPicker } from "./LeadsPicker";
import { useAudienceErrorText, useSlotLabel } from "./use-audience-copy";
import { useAudienceFields } from "./use-audience-queries";
import type { CampaignAudience } from "./use-campaign-audience";

const NO_VARIABLES: readonly VariableCount[] = [];

function LeadsMetadataNotice({ count, onOpen }: { count: AudienceCount; onOpen: (focus: AudienceLeadFocus) => void }) {
  const t = useTranslations("campaignAudience.step.leadsMetadata");
  if (count.source !== "leads" || !count.blockers.includes("leads_metadata_unavailable")) return null;
  return (
    <Notice tone="warning" title={t("title")}>
      <p>{t("body", { keys: count.metadataMissing.map((gap) => gap.key).join(", ") })}</p>
      <p className="flex flex-wrap gap-x-3 gap-y-1">
        {count.metadataMissing.map((gap) => (
          <button key={gap.key} type="button" className="text-left underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onOpen({ metadataKey: gap.key })}>
            <span className="font-mono">{gap.key}</span> · {gap.missing.toLocaleString()}
          </button>
        ))}
      </p>
    </Notice>
  );
}

export function CampaignAudienceStep({
  audience,
  message = "",
  notice,
  readOnly = false,
}: {
  audience: CampaignAudience;
  message?: string;
  notice?: ReactNode;
  readOnly?: boolean;
}) {
  const { channel, draft, update, count } = audience;
  const fields = useAudienceFields(channel).data ?? [];
  const errorText = useAudienceErrorText();
  const [focus, setFocus] = useState<AudienceLeadFocus | null>(null);
  const variables = count?.source === "leads" ? count.variables : [];

  return (
    <div className="space-y-4">
      <AudienceSourceRow
        sources={sourcesOf(channel)}
        value={draft.source}
        onChange={(source) => update((current) => ({ ...current, source }))}
        onLeadSaved={(lead) => {
          update((current) => withNewLead(current, lead.id));
          audience.recount();
        }}
        readOnly={readOnly}
      />

      {draft.source === "list" ? (
        <AudienceListSection audience={audience} fields={fields} readOnly={readOnly} onOpen={setFocus} />
      ) : (
        <>
          {count ? <LeadsMetadataNotice count={count} onOpen={setFocus} /> : null}
          <LeadsPicker value={draft} onChange={(patch) => update((current) => ({ ...current, ...patch }))} readOnly={readOnly} />
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
            <div className="grid min-w-0 gap-5">
              <AudienceVariablesPanel
                channel={channel}
                variables={variables}
                choices={draft.variables}
                fields={fields}
                onChoice={(key, patch) => update((current) => withVariableChoice(current, key, patch))}
                onOpen={setFocus}
                readOnly={readOnly}
              />
              {channel === "email" ? null : <AudienceArrives channel={channel} message={message} variables={variables} choices={draft.variables} fields={fields} />}
            </div>
            <AudienceCountPanel audience={audience} fields={fields} errorText={audience.countError ? errorText(audience.countError) : null} onOpen={setFocus} />
          </div>
        </>
      )}

      {notice}
      <AudienceLeadsSheet audience={audience} focus={focus} onClose={() => setFocus(null)} />
    </div>
  );
}

export function useCreateBlockedText(audience: CampaignAudience): string | null {
  const t = useTranslations("campaignAudience.step.blocked");
  const label = useSlotLabel(audience.count?.variables ?? NO_VARIABLES);
  const state = audience.createState;
  if (state.ready) return null;
  return t(state.reason, { slot: state.slot ? label(state.slot) : "" });
}

export function AudienceCreateHint({ audience }: { audience: CampaignAudience }) {
  const text = useCreateBlockedText(audience);
  if (text === null) return null;
  return (
    <span role="status" className="text-xs text-muted-foreground">
      {text}
    </span>
  );
}
