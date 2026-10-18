"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import { codedErrorMessage, type CodedError } from "@/lib/api/coded-error";

export function useCompanyError() {
  const t = useTranslations("leadCompanies");
  return useCallback((error: CodedError) => codedErrorMessage(t, error, t("errors.failed")), [t]);
}
