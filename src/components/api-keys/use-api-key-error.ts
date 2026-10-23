"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";

import { codedOf } from "@/components/email-marketing/use-email-error";
import { codedErrorMessage } from "@/lib/api/coded-error";

export function useApiKeyError() {
  const t = useTranslations("apiKeys");
  return useCallback((error: unknown) => codedErrorMessage(t, codedOf(error), t("errors.default")), [t]);
}
