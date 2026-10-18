"use client";

import { useEffect, useState } from "react";

import { listWorkspaceGroupsAction } from "@/app/actions/unofficial-whatsapp-groups";
import type { WorkspaceGroup } from "@/lib/unofficial-whatsapp-groups/types";

const FOLLOWED_GROUPS_PAGE_SIZE = 100;

const SEARCH_DEBOUNCE_MS = 300;

interface FollowedGroups {
  groups: WorkspaceGroup[];
  totalItems: number;
  loading: boolean;
  error: string | null;
}

export function useFollowedGroups(search: string, enabled = true): FollowedGroups {
  const [state, setState] = useState<Omit<FollowedGroups, "loading"> & { key: string | null }>({ groups: [], totalItems: 0, error: null, key: null });
  const term = search.trim();

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const timer = setTimeout(
      () => {
        void listWorkspaceGroupsAction({ followed: true, search: term || undefined, page: 1, pageSize: FOLLOWED_GROUPS_PAGE_SIZE, sort: "name" }).then((result) => {
          if (cancelled) return;
          setState({
            groups: result.error ? [] : result.items.map((row) => row.group),
            totalItems: result.error ? 0 : result.meta.totalItems,
            error: result.error ?? null,
            key: term,
          });
        });
      },
      term ? SEARCH_DEBOUNCE_MS : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, enabled]);

  return { groups: state.groups, totalItems: state.totalItems, loading: enabled && state.key !== term, error: state.error };
}
