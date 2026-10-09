"use client";

import { useTranslations } from "next-intl";

import { positionProviderKey } from "@/lib/maps/position";

export function useGeocodingProviderName(): (provider: string) => string {
  const tMap = useTranslations("leadMap");
  return (provider: string) => {
    const key = positionProviderKey(provider);
    return key ? tMap(key) : provider;
  };
}
