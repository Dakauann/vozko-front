"use client";

import { useState } from "react";

import { useLeadOwnerName } from "@/components/leads/use-lead-owner-name";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAssignableMembers } from "@/hooks/use-assignable-members";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

const SEARCH_DEBOUNCE_MS = 300;

export function useMemberDirectory() {
  const { can } = useWorkspace();
  const readable = can("members", "read");
  const directory = useAssignableMembers(readable);
  const ownerName = useLeadOwnerName(directory.names, readable);
  return { readable, ownerName };
}

export function useMemberSearch() {
  const { readable, ownerName } = useMemberDirectory();
  const [search, setSearch] = useState("");
  const term = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const found = useAssignableMembers(readable, term);
  return { readable, ownerName, setSearch, found, searching: found.loading && found.members.length === 0 };
}
