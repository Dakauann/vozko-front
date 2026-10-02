"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { isAdsError, listAdAccountsAction } from "@/app/actions/advertising";
import { useWorkspace } from "@/contexts/workspace-context";
import { accountStorageKey, pickAccountId, readStored, writeStored } from "@/lib/advertising/connect";
import type { AdAccount } from "@/lib/advertising/types";

type AccountsState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; accounts: AdAccount[] };

export interface UseAdAccountsOptions {
  enabled: boolean;
  requested?: string | null;
}

export function useAdAccounts({ enabled, requested = null }: UseAdAccountsOptions) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const [state, setState] = useState<AccountsState>({ status: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const reload = useCallback(
    (preferred?: string | null) =>
      listAdAccountsAction().then((result) => {
        if (isAdsError(result)) {
          setState({ status: "error", message: result.error });
          return;
        }
        setState({ status: "ready", accounts: result.data });
        const ids = result.data.map((account) => account.id);
        const stored = workspaceId ? readStored(accountStorageKey(workspaceId)) : null;
        setSelectedId(pickAccountId(ids, preferred, requested, stored));
      }),
    [requested, workspaceId],
  );

  useEffect(() => {
    if (!enabled) return;
    void reload();
  }, [enabled, reload]);

  const accounts = useMemo(() => (state.status === "ready" ? state.accounts : []), [state]);
  const selected = accounts.find((account) => account.id === selectedId) ?? null;

  const select = useCallback(
    (id: string) => {
      setSelectedId(id);
      if (workspaceId) writeStored(accountStorageKey(workspaceId), id);
    },
    [workspaceId],
  );

  const replace = useCallback((updated: AdAccount) => {
    setState((current) =>
      current.status === "ready"
        ? { status: "ready", accounts: current.accounts.map((account) => (account.id === updated.id ? updated : account)) }
        : current,
    );
  }, []);

  return {
    accounts,
    selected,
    select,
    replace,
    reload,
    loading: state.status === "loading",
    error: state.status === "error" ? state.message : null,
  };
}

export type AdAccountsState = ReturnType<typeof useAdAccounts>;
