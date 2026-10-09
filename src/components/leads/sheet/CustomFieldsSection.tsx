"use client";

import { useTranslations } from "next-intl";

import { Lock, Tag } from "@/components/icons";
import CustomFieldInput from "@/components/crm/CustomFieldInput";
import { readableFields, type CustomFieldDefinition } from "@/lib/crm/custom-fields";
import type { LeadSheetDraft } from "@/lib/leads/sheet";

import { SheetHint, SheetLinkButton, SheetSection } from "./SheetSection";

export function CustomFieldsSection({
  definitions,
  loading,
  failed,
  draft,
  errors,
  onUpdate,
  onManageFields,
}: {
  definitions: CustomFieldDefinition[];
  loading: boolean;
  failed: boolean;
  draft: LeadSheetDraft;
  errors: Record<string, string>;
  onUpdate: (update: (draft: LeadSheetDraft) => LeadSheetDraft) => void;
  onManageFields?: () => void;
}) {
  const t = useTranslations("leadSheet.customFields");
  const readable = readableFields(definitions);
  const hidden = definitions.length - readable.length;

  const setValue = (key: string, value: unknown) =>
    onUpdate((current) => {
      const customFields = { ...current.customFields };
      if (value === undefined || value === null) delete customFields[key];
      else customFields[key] = value;
      return { ...current, customFields };
    });

  return (
    <SheetSection icon={<Tag />} title={t("title")}>
      {loading ? <SheetHint>{t("loading")}</SheetHint> : null}
      {failed ? <SheetHint tone="error">{t("loadFailed")}</SheetHint> : null}
      {!loading && !failed && definitions.length === 0 ? <SheetHint>{t("empty")}</SheetHint> : null}
      {readable.map((field) => (
        <div key={field.id} className="space-y-1">
          <CustomFieldInput
            field={field}
            value={draft.customFields[field.key]}
            error={errors[`customFields.${field.key}`]}
            onChange={(value) => setValue(field.key, value)}
          />
          {field.sensitive ? (
            <p className="flex items-center gap-1 pl-1 text-2xs text-muted-foreground">
              <Lock className="h-3 w-3" aria-hidden />
              {t("sensitive")}
            </p>
          ) : null}
        </div>
      ))}
      {hidden > 0 ? <SheetHint>{t("hiddenSensitive", { count: hidden })}</SheetHint> : null}
      {onManageFields ? <SheetLinkButton onClick={onManageFields}>{t("manage")}</SheetLinkButton> : null}
    </SheetSection>
  );
}
