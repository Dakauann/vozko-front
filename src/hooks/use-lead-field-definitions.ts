"use client";

import { useCustomFieldDefinitions } from "@/hooks/use-custom-field-definitions";

export function useLeadFieldDefinitions(enabled = true) {
  return useCustomFieldDefinitions("lead", enabled);
}
