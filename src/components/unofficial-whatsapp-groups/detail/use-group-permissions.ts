"use client";

import { useMemo } from "react";

import { useWorkspace } from "@/contexts/workspace-context";

export function useGroupPermissions() {
  const { can } = useWorkspace();
  return useMemo(
    () => ({
      update: can("unofficial_whatsapp_groups", "update"),
      create: can("unofficial_whatsapp_groups", "create"),
      leave: can("unofficial_whatsapp_groups", "delete"),
      removeMembers: can("unofficial_whatsapp_groups", "delete"),
      configure: can("unofficial_whatsapp_groups", "configure"),
      exportMembers: can("unofficial_whatsapp_groups", "export"),
      addLeads: can("leads", "create"),
      createCampaign: can("unofficial_whatsapp_campaigns", "create"),
      openConversation: can("conversations", "read"),
      uploadMedia: can("media", "create"),
    }),
    [can],
  );
}

export type GroupPermissions = ReturnType<typeof useGroupPermissions>;
