"use client";

import { useEffect, useMemo, useState } from "react";

import { listGroupJoinsAction, listWorkspaceGroupsAction } from "@/app/actions/unofficial-whatsapp-groups";
import type { GroupRow, JoinTask, PageMeta, WorkspaceGroup } from "@/lib/unofficial-whatsapp-groups/types";

const FOLLOWED_PAGE_SIZE = 100;

interface FollowedState {
  key: string;
  rows: GroupRow[];
  meta: PageMeta | null;
  error: string | null;
}

export function useFollowedGroups(refreshKey: number) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<FollowedState | null>(null);
  const requestKey = `${refreshKey}#${attempt}`;

  useEffect(() => {
    let cancelled = false;
    void listWorkspaceGroupsAction({ followed: true, page: 1, pageSize: FOLLOWED_PAGE_SIZE }).then((result) => {
      if (cancelled) return;
      setState((previous) =>
        result.error
          ? { key: requestKey, rows: previous?.rows ?? [], meta: previous?.meta ?? null, error: result.error }
          : { key: requestKey, rows: result.items, meta: result.meta, error: null },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  const rows = useMemo(() => state?.rows ?? [], [state]);
  const groupsById = useMemo(() => new Map<string, WorkspaceGroup>(rows.map((row) => [row.group.id, row.group])), [rows]);
  const loading = state?.key !== requestKey && !state?.rows.length;

  return {
    rows,
    meta: state?.meta ?? null,
    groupsById,
    loading,
    error: state?.key === requestKey && state.rows.length === 0 ? state.error : null,
    retry: () => setAttempt((current) => current + 1),
  };
}

export function useGroupJoins(refreshKey: number) {
  const [tasks, setTasks] = useState<JoinTask[]>([]);

  useEffect(() => {
    let cancelled = false;
    void listGroupJoinsAction().then((result) => {
      if (cancelled || result.error) return;
      setTasks(result.tasks);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return tasks;
}
