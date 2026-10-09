"use client";

import { useMemo } from "react";

import { useLeadOwnerName } from "@/components/leads/use-lead-owner-name";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAssignableMembers } from "@/hooks/use-assignable-members";
import { useLeadFieldDefinitions } from "@/hooks/use-lead-field-definitions";
import { readableClassificationField } from "@/lib/crm/custom-fields";

export interface LeadPresentationOptions {
  directory?: boolean;
}

export function useLeadPresentation(enabled = true, { directory = true }: LeadPresentationOptions = {}) {
  const { can } = useWorkspace();
  const membersReadable = can("members", "read");
  const fields = useLeadFieldDefinitions(enabled);
  const members = useAssignableMembers(enabled && directory && membersReadable);
  const ownerName = useLeadOwnerName(members.names, membersReadable);
  const classification = useMemo(() => readableClassificationField(fields.definitions), [fields.definitions]);
  return { fields, classification, members, membersReadable, ownerName };
}
