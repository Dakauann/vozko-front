"use client";

import { useMemo } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { WarningCircle } from "@/components/icons";
import ElevatedButton from "@/components/elevated-design/button";
import { Checkbox } from "@/components/elevated-design/elevated-checkbox";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { CustomFieldValue } from "@/components/crm/CustomFieldValue";
import type { CustomFieldDefinition } from "@/lib/crm/custom-fields";
import { AREA_SEPARATOR, areaLine, calendarDateOf, streetLine } from "@/lib/leads/detail";
import { customFieldKeyOf, draftFromRecord, type LeadConflict, type LeadSheetDraft } from "@/lib/leads/sheet";
import type { LeadRecord } from "@/lib/leads/types";

const LIST_SEPARATOR = "; ";

function ConflictValue({
  draft,
  field,
  definitions,
  ownerName,
}: {
  draft: LeadSheetDraft;
  field: string;
  definitions: readonly CustomFieldDefinition[];
  ownerName: (ownerId: string | undefined) => string | null;
}) {
  const t = useTranslations("leadSheet.conflict");
  const tOwner = useTranslations("leadSheet.owner");
  const format = useFormatter();

  const key = customFieldKeyOf(field);
  if (key !== null) {
    const definition = definitions.find((candidate) => candidate.key === key);
    return definition ? <CustomFieldValue field={definition} value={draft.customFields[key]} /> : <EmptyValue />;
  }
  switch (field) {
    case "whatsappOptIn":
      return <>{draft.whatsappOptIn ? t("optedIn") : t("notOptedIn")}</>;
    case "owner":
      return <>{draft.ownerId ? ownerName(draft.ownerId) ?? <EmptyValue /> : tOwner("none")}</>;
    case "birthDate": {
      const date = calendarDateOf(draft.birthDate);
      return date ? <>{format.dateTime(date, { dateStyle: "short", timeZone: "UTC" })}</> : <EmptyValue />;
    }
    case "phones": {
      const phones = draft.phones.map((phone) => phone.number.trim()).filter(Boolean);
      return phones.length > 0 ? <span className="font-mono">{phones.join(LIST_SEPARATOR)}</span> : <EmptyValue />;
    }
    case "addresses": {
      const addresses = draft.addresses.map((address) => [streetLine(address), areaLine(address)].filter(Boolean).join(AREA_SEPARATOR)).filter(Boolean);
      return addresses.length > 0 ? <>{addresses.join(LIST_SEPARATOR)}</> : <EmptyValue />;
    }
    case "number":
    case "name":
    case "nickname":
    case "email":
      return draft[field].trim() ? <>{draft[field].trim()}</> : <EmptyValue />;
    default:
      return <EmptyValue />;
  }
}

export function ConflictBanner({
  current,
  conflict,
  mine,
  keepMine,
  definitions,
  ownerName,
  fieldLabel,
  onToggleKeep,
  onReapply,
  onDiscard,
}: {
  current: LeadRecord;
  conflict: LeadConflict;
  mine: LeadSheetDraft;
  keepMine: ReadonlySet<string>;
  definitions: readonly CustomFieldDefinition[];
  ownerName: (ownerId: string | undefined) => string | null;
  fieldLabel: (field: string) => string;
  onToggleKeep: (field: string, keep: boolean) => void;
  onReapply: () => void;
  onDiscard: () => void;
}) {
  const t = useTranslations("leadSheet.conflict");
  const theirs = useMemo(() => draftFromRecord(current), [current]);
  const overlap = new Set(conflict.overlap);
  const elsewhere = conflict.changed.filter((field) => !overlap.has(field));

  return (
    <div role="alert" className="m-4 space-y-3 rounded-[--radius] border border-warning-ink/40 bg-muted p-3 sm:mx-6">
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <WarningCircle className="h-4 w-4 text-warning-ink" aria-hidden />
        {t("title")}
      </p>
      {conflict.overlap.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{t("overlapHint")}</p>
          <ul className="divide-y divide-border rounded-[--radius] border border-border bg-card">
            {conflict.overlap.map((field) => (
              <li key={field} className="space-y-1 px-3 py-2 text-sm">
                <p className="font-medium text-foreground">{fieldLabel(field)}</p>
                <p className="text-xs text-muted-foreground">
                  {t("theirs")}{" "}
                  <span className="text-foreground">
                    <ConflictValue draft={theirs} field={field} definitions={definitions} ownerName={ownerName} />
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("mine")}{" "}
                  <span className="text-foreground">
                    <ConflictValue draft={mine} field={field} definitions={definitions} ownerName={ownerName} />
                  </span>
                </p>
                <label className="flex min-h-[34px] items-center gap-2 text-xs text-foreground sm:min-h-0">
                  <Checkbox
                    checked={keepMine.has(field)}
                    onCheckedChange={(checked) => onToggleKeep(field, checked === true)}
                    aria-label={t("keepMineOf", { field: fieldLabel(field) })}
                  />
                  {t("keepMine")}
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {elsewhere.length > 0 ? (
        <p className="text-xs text-muted-foreground">{t("changed", { fields: elsewhere.map(fieldLabel).join(", ") })}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <ElevatedButton variant="primary" size="sm" title={t("reapply")} onClick={onReapply} />
        <ElevatedButton variant="outline-subtle" size="sm" title={t("discard")} onClick={onDiscard} />
      </div>
    </div>
  );
}
