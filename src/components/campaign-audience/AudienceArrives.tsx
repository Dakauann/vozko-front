"use client";

import { Fragment, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { PanelSection } from "@/components/dashboard/PanelSection";
import { OutgoingBubble } from "@/components/leads/sends/OutgoingBubble";
import type { VariableChoice } from "@/lib/campaign-audience/draft";
import { LITERAL_AUDIENCE_SOURCE, type AudienceChannel, type BindableField, type VariableCount } from "@/lib/campaign-audience/types";

import { slotTag, useAudienceSourceLabel, useMissingFieldText, useSlotName } from "./use-audience-copy";

const SLOT = /\{\{\s*([^{}\s]+)\s*\}\}/g;

function Highlight({ children }: { children: ReactNode }) {
  return <span className="rounded-[4px] bg-muted px-1 font-semibold">{children}</span>;
}

function filled(message: string, valueOf: (key: string) => ReactNode): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of message.matchAll(SLOT)) {
    const at = match.index ?? 0;
    parts.push(message.slice(last, at));
    parts.push(<Fragment key={`${match[1]}-${at}`}>{valueOf(match[1])}</Fragment>);
    last = at + match[0].length;
  }
  parts.push(message.slice(last));
  return parts;
}

export function AudienceArrives({
  channel,
  message,
  variables,
  choices,
  fields,
}: {
  channel: AudienceChannel;
  message: string;
  variables: readonly VariableCount[];
  choices: Record<string, VariableChoice>;
  fields: readonly BindableField[];
}) {
  const t = useTranslations("campaignAudience.step.arrives");
  const labelOf = useAudienceSourceLabel(channel, fields);
  const missingText = useMissingFieldText(channel, fields);
  const slotName = useSlotName();
  const examples = variables.filter((variable) => variable.missing > 0 && (choices[variable.key]?.missing ?? variable.policy) === "text");
  if (!message.trim() || examples.length === 0) return null;

  const sourceOf = (variable: VariableCount) => choices[variable.key]?.source ?? variable.source;
  const valueFor = (example: VariableCount, name: string): ReactNode => {
    const variable = variables.find((candidate) => !candidate.header && candidate.name === name);
    if (!variable) return slotTag({ name });
    const key = variable.key;
    if (variable.key === example.key) return <Highlight>{choices[key]?.text ?? variable.text ?? ""}</Highlight>;
    const source = sourceOf(variable);
    if (source === LITERAL_AUDIENCE_SOURCE) return choices[key]?.value ?? variable.value ?? "";
    return `[${labelOf(key, source)}]`;
  };

  return (
    <PanelSection boxed title={t("title")} legend={t("legend")}>
      <div className="grid gap-3.5">
        {examples.map((example) => (
          <div key={example.key} className="grid gap-1.5">
            <span className="legend">{t("withText", { field: missingText(example.key, sourceOf(example)), slot: slotName(example) })}</span>
            <OutgoingBubble text={message} emptyLabel="">
              {filled(message, (key) => valueFor(example, key))}
            </OutgoingBubble>
          </div>
        ))}
      </div>
    </PanelSection>
  );
}
