"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import { mercadoLivreErrorKey } from "@/lib/mercadolivre/errors";

export function useMercadoLivreError() {
  const t = useTranslations("mercadolivre");
  return useCallback((failure: { code?: string }) => t(mercadoLivreErrorKey(failure.code)), [t]);
}
