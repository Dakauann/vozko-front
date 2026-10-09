"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import type { CodedError } from "@/lib/api/coded-error";
import { leadActionErrorMessage } from "@/lib/leads/actions";
import {
  LEAD_FIELD_SOURCES,
  LITERAL_SOURCE,
  bindingFieldKey,
  type BindingChoice,
  type BindingSource,
  type SendSlotRef,
} from "@/lib/leads/sends";

export function useSendErrorText() {
  const tSends = useTranslations("leadSends");
  const tBulk = useTranslations("leadsPage.bulk");
  const tLeads = useTranslations("leadsPage");
  const tFields = useTranslations("customFields");
  const tSelection = useTranslations("selection");
  return useCallback(
    (error: CodedError) => leadActionErrorMessage([tSends, tBulk, tLeads, tFields, tSelection], error),
    [tSends, tBulk, tLeads, tFields, tSelection],
  );
}

export function useBindingLabel(choices: readonly BindingChoice[]) {
  const t = useTranslations("leadSends.bindings");
  return useCallback(
    (source: BindingSource): string => {
      if (source === LITERAL_SOURCE) return t("sources.literal");
      if (source in LEAD_FIELD_SOURCES) return t(`sources.${LEAD_FIELD_SOURCES[source as keyof typeof LEAD_FIELD_SOURCES]}`);
      const field = choices.find((choice) => choice.source === source)?.field;
      return t("custom", { label: field?.label ?? bindingFieldKey(source) ?? source });
    },
    [t, choices],
  );
}

export function useMissingSlotText() {
  const t = useTranslations("leadSends.review");
  return useCallback(
    ({ slot, source }: SendSlotRef, customLabel?: string): string => {
      if (source && Object.hasOwn(LEAD_FIELD_SOURCES, source)) {
        const field = t(`missingField.${LEAD_FIELD_SOURCES[source as keyof typeof LEAD_FIELD_SOURCES]}`);
        return t("missingSlot", { field, slot });
      }
      const key = source ? bindingFieldKey(source) : null;
      if (!key) return t("missingSlotUnnamed", { slot });
      return t("missingSlot", { field: t("missingField.custom", { label: customLabel ?? key }), slot });
    },
    [t],
  );
}
