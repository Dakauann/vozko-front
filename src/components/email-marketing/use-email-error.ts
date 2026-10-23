"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";

import { codedErrorMessage } from "@/lib/api/coded-error";
import { SectionError } from "@/lib/analytics/section-query";

interface CodedLike {
  code?: string;
  status?: number;
  message?: string;
}

export function codedOf(error: unknown): CodedLike {
  if (error instanceof SectionError) return { code: error.code, status: error.status, message: error.message };
  if (error instanceof Error) return { code: error.message, message: error.message };
  if (error && typeof error === "object") return error as CodedLike;
  return {};
}

export function useEmailError() {
  const t = useTranslations("emailMarketing");
  return useCallback((error: unknown) => codedErrorMessage(t, codedOf(error), t("errors.default")), [t]);
}
