"use client";

import { useCallback, useMemo } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { codedErrorMessage, type CodedRefusal } from "@/lib/api/coded-error";
import type { AnswerWords } from "@/lib/whatsapp-forms/answers";
import type { BindingTarget, CustomFieldOption, Problem } from "@/lib/whatsapp-forms/types";

const CUSTOM_SLOT = "custom_field:";

export function bindingKey(target: BindingTarget): string {
  return target.replace(".", "_");
}

export function useFormError() {
  const t = useTranslations("whatsappForms");
  return useCallback((error: CodedRefusal) => codedErrorMessage(t, error, t("errors.failed")), [t]);
}

export function useProblemText() {
  const t = useTranslations("whatsappForms.problems");
  return useCallback(
    (problem: Problem) => {
      if (problem.code === "meta_validation" && problem.message) return t("meta_validation", { message: problem.message });
      if (t.has(problem.code)) return t(problem.code, { limit: problem.limit ?? 0, message: problem.message ?? "" });
      return problem.message || t("fallback");
    },
    [t],
  );
}

export function useAnswerWords(): AnswerWords {
  const t = useTranslations("whatsappForms.common");
  const format = useFormatter();
  return useMemo(
    () => ({
      yes: t("yes"),
      no: t("no"),
      range: (start: string, end: string) => t("range", { start, end }),
      date: (iso: string) => {
        const at = new Date(`${iso}T12:00:00`);
        return Number.isNaN(at.getTime()) ? iso : format.dateTime(at, { dateStyle: "short" });
      },
    }),
    [t, format],
  );
}

export function useLeadSlotLabel(customFields: readonly CustomFieldOption[]) {
  const t = useTranslations("whatsappForms.bindingTargets");
  return useCallback(
    (slot: string) => {
      if (slot.startsWith(CUSTOM_SLOT)) {
        const key = slot.slice(CUSTOM_SLOT.length);
        return customFields.find((field) => field.key === key)?.label ?? key;
      }
      const key = slot.replace(".", "_");
      return t.has(key) ? t(key) : slot;
    },
    [customFields, t],
  );
}
