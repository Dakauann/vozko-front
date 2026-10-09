"use client";

import { useCallback, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import ElevatedInput from "@/components/elevated-design/elevated-input";
import type { FilterFieldConfig } from "@/components/filters/advanced-filter-panel";
import { MagnifyingGlass, X } from "@/components/icons";
import type { LeadLookupMatch } from "@/app/actions/leads";
import { useLeadLookup } from "@/hooks/use-lead-lookup";
import { formatCep } from "@/lib/address/cep";
import { readSet, withSet } from "@/lib/filters/controls";
import { leadNameLines } from "@/lib/leads/display";
import type { LeadFilterChoice } from "@/lib/leads/filter-options";
import {
  LEAD_FILTER_FIELD,
  LEAD_REFERRER_FILTER_MAX,
  LEAD_ZIP_FILTER_MAX,
  zipFilterEntries,
  type LeadFilter,
  type LeadFilterEntry,
} from "@/lib/leads/filters";
import { cn } from "@/lib/utils";

import { useLeadNames } from "./use-lead-names";

const TOKEN_CLASS =
  "inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-2xs font-medium text-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/5";

function FilterTokens({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-1">{children}</div>;
}

function RemovableToken({ label, removeLabel, mono, onRemove }: { label: string; removeLabel: string; mono?: boolean; onRemove: () => void }) {
  return (
    <button type="button" aria-label={removeLabel} title={removeLabel} onClick={onRemove} className={TOKEN_CLASS}>
      <span className={cn(mono && "font-mono")}>{label}</span>
      <X weight="bold" className="h-2.5 w-2.5 text-muted-foreground" aria-hidden />
    </button>
  );
}

function FilterHint({ tone = "muted", children }: { tone?: "muted" | "problem"; children: ReactNode }) {
  return (
    <p role={tone === "problem" ? "alert" : undefined} className={cn("text-2xs", tone === "problem" ? "text-destructive-ink" : "text-muted-foreground")}>
      {children}
    </p>
  );
}

export interface LeadZipFilterProps {
  label: string;
  selected: readonly string[];
  onChange: (values: string[]) => void;
}

export function LeadZipFilter({ label, selected, onChange }: LeadZipFilterProps) {
  const t = useTranslations("leadsPage.filters.zip");
  const [draft, setDraft] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const full = selected.length >= LEAD_ZIP_FILTER_MAX;

  const commit = () => {
    const { values, invalid } = zipFilterEntries(draft);
    const added = values.filter((value) => !selected.includes(value));
    if (selected.length + added.length > LEAD_ZIP_FILTER_MAX) {
      setProblem(t("tooMany", { max: LEAD_ZIP_FILTER_MAX }));
      return;
    }
    if (added.length > 0) onChange([...selected, ...added]);
    setProblem(invalid.length > 0 ? t("invalid", { values: invalid.join(", ") }) : null);
    setDraft(invalid.join(" "));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    commit();
  };

  return (
    <div className="flex flex-col gap-1.5">
      <ElevatedInput
        aria-label={label}
        value={draft}
        placeholder={t("placeholder")}
        inputMode="numeric"
        controlSize="sm"
        disabled={full}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (draft.trim()) commit();
        }}
      />
      {problem ? <FilterHint tone="problem">{problem}</FilterHint> : null}
      {full ? <FilterHint>{t("tooMany", { max: LEAD_ZIP_FILTER_MAX })}</FilterHint> : null}
      {selected.length > 0 ? (
        <FilterTokens>
          {selected.map((value) => (
            <RemovableToken
              key={value}
              label={formatCep(value)}
              mono
              removeLabel={t("remove", { value: formatCep(value) })}
              onRemove={() => onChange(selected.filter((item) => item !== value))}
            />
          ))}
        </FilterTokens>
      ) : null}
    </div>
  );
}

export interface LeadReferrerFilterProps {
  label: string;
  selected: readonly string[];
  nameOf: (leadId: string) => string;
  onChange: (leadIds: string[]) => void;
  onPicked: (lead: LeadLookupMatch) => void;
}

export function LeadReferrerFilter({ label, selected, nameOf, onChange, onPicked }: LeadReferrerFilterProps) {
  const t = useTranslations("leadsPage.filters.referredBy");
  const [text, setText] = useState("");
  const full = selected.length >= LEAD_REFERRER_FILTER_MAX;
  const lookup = useLeadLookup(text, !full);
  const matches = lookup.matches.filter((match) => !selected.includes(match.id));

  const pick = (match: LeadLookupMatch) => {
    onPicked(match);
    onChange([...selected, match.id]);
    setText("");
  };

  return (
    <div className="flex flex-col gap-1.5">
      <ElevatedInput
        aria-label={label}
        value={text}
        placeholder={t("placeholder")}
        icon={<MagnifyingGlass weight="bold" className="h-3.5 w-3.5" />}
        controlSize="sm"
        disabled={full}
        onChange={(event) => setText(event.target.value)}
      />
      {full ? <FilterHint>{t("tooMany", { max: LEAD_REFERRER_FILTER_MAX })}</FilterHint> : null}
      {lookup.searching ? <FilterHint>{t("searching")}</FilterHint> : null}
      {lookup.failed ? <FilterHint tone="problem">{t("failed")}</FilterHint> : null}
      {lookup.settled && matches.length === 0 ? <FilterHint>{t("none")}</FilterHint> : null}
      {matches.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-[--radius] border border-border">
          {matches.map((match) => {
            const lines = leadNameLines({ realName: match.realName, number: match.number });
            return (
              <li key={match.id}>
                <button
                  type="button"
                  onClick={() => pick(match)}
                  className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted"
                >
                  <span className={cn("truncate text-foreground", lines.titleMono ? "font-mono" : "font-medium")}>{lines.title}</span>
                  {lines.detail.kind === "identity" ? (
                    <span className="shrink-0 font-mono text-2xs text-muted-foreground">{lines.detail.text}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {selected.length > 0 ? (
        <FilterTokens>
          {selected.map((leadId) => (
            <RemovableToken
              key={leadId}
              label={nameOf(leadId)}
              removeLabel={t("remove", { name: nameOf(leadId) })}
              onRemove={() => onChange(selected.filter((item) => item !== leadId))}
            />
          ))}
        </FilterTokens>
      ) : null}
    </div>
  );
}

export interface LeadEntryControls {
  options: (entry: LeadFilterEntry, selected: readonly string[]) => LeadFilterChoice[];
  render?: (entry: LeadFilterEntry, field: string, label: string) => FilterFieldConfig["renderControl"];
}

export const PLAIN_LEAD_ENTRY_CONTROLS: LeadEntryControls = {
  options: (entry, selected) => selected.map((value) => ({ value, label: entry === "zip" ? formatCep(value) : value })),
};

export function useLeadEntryControls(filter: LeadFilter): LeadEntryControls {
  const t = useTranslations("leadsPage.filters");
  const referrerIds = readSet(filter, LEAD_FILTER_FIELD.referredBy);
  const referrers = useLeadNames(referrerIds);
  const [picked, setPicked] = useState<ReadonlyMap<string, string>>(new Map());

  const remember = useCallback((lead: LeadLookupMatch) => {
    const name = leadNameLines({ realName: lead.realName, number: lead.number }).title;
    setPicked((current) => new Map(current).set(lead.id, name));
  }, []);

  const nameOf = useCallback(
    (leadId: string) =>
      picked.get(leadId) ?? referrers.names.get(leadId) ?? (referrers.pending ? t("loading") : t("options.leadUnknown")),
    [picked, referrers.names, referrers.pending, t],
  );

  return useMemo<LeadEntryControls>(
    () => ({
      options: (entry, selected) => selected.map((value) => ({ value, label: entry === "zip" ? formatCep(value) : nameOf(value) })),
      render: (entry, field, label) => (current, change) =>
        entry === "zip" ? (
          <LeadZipFilter label={label} selected={readSet(current, field)} onChange={(values) => change(withSet(current, field, values))} />
        ) : (
          <LeadReferrerFilter
            label={label}
            selected={readSet(current, field)}
            nameOf={nameOf}
            onPicked={remember}
            onChange={(values) => change(withSet(current, field, values))}
          />
        ),
    }),
    [nameOf, remember],
  );
}
