"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { getNodeVariablesAction } from "@/app/actions/workflows";
import type { VariableCatalog } from "@/lib/workflows/variable-catalog";
import { createCatalogLoader, type CatalogAnswer, type CatalogDraft, type CatalogLoader } from "@/lib/workflows/variable-catalog-loader";

export type NodeVariablesState =
  | { status: "loading" }
  | { status: "ready"; catalog: VariableCatalog }
  | { status: "failed"; error: string; code?: string }
  | { status: "unavailable" };

export interface NodeVariables {
  state: NodeVariablesState;
  retry: () => void;
}

interface CatalogSource {
  loader: CatalogLoader;
  draft: () => CatalogDraft;
}

const UNAVAILABLE: NodeVariables = { state: { status: "unavailable" }, retry: () => {} };
const LOADING: NodeVariablesState = { status: "loading" };

const CatalogSourceContext = createContext<CatalogSource | null>(null);
const NodeVariablesContext = createContext<NodeVariables>(UNAVAILABLE);

export function VariableCatalogSourceProvider({
  workflowId,
  revision,
  children,
}: {
  workflowId: string | null;
  revision: number | null;
  children: ReactNode;
}) {
  const draftRef = useRef<CatalogDraft>({ workflowId, revision });
  useEffect(() => {
    draftRef.current = { workflowId, revision };
  }, [workflowId, revision]);
  const source = useMemo<CatalogSource>(() => ({ loader: createCatalogLoader(getNodeVariablesAction), draft: () => draftRef.current }), []);
  return <CatalogSourceContext.Provider value={source}>{children}</CatalogSourceContext.Provider>;
}

export function useCatalogSource(): CatalogSource | null {
  return useContext(CatalogSourceContext);
}

function stateOf(answer: CatalogAnswer): NodeVariablesState {
  if ("catalog" in answer) return { status: "ready", catalog: answer.catalog };
  if ("unavailable" in answer) return { status: "unavailable" };
  return { status: "failed", error: answer.error, ...(answer.code ? { code: answer.code } : {}) };
}

interface LoadedAnswer {
  key: string;
  nodeId: string;
  state: NodeVariablesState;
}

export function useNodeVariableCatalog(nodeId: string, draft: CatalogDraft): NodeVariables {
  const source = useCatalogSource();
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<LoadedAnswer | null>(null);
  const [lastReady, setLastReady] = useState<LoadedAnswer | null>(null);
  const { workflowId, revision } = draft;
  const key = `${workflowId ?? ""}:${revision ?? ""}:${nodeId}:${attempt}`;

  useEffect(() => {
    if (!source) return;
    let live = true;
    source.loader.load({ workflowId, revision }, nodeId).then((answer) => {
      if (!live) return;
      const next = { key, nodeId, state: stateOf(answer) };
      setLoaded(next);
      if (next.state.status === "ready") setLastReady(next);
    });
    return () => {
      live = false;
    };
  }, [source, workflowId, revision, nodeId, key]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  const state = !source
    ? UNAVAILABLE.state
    : loaded?.key === key
      ? loaded.state
      : lastReady?.nodeId === nodeId
        ? lastReady.state
        : LOADING;
  return useMemo(() => ({ state, retry }), [state, retry]);
}

export function NodeVariablesProvider({ value, children }: { value: NodeVariables; children: ReactNode }) {
  return <NodeVariablesContext.Provider value={value}>{children}</NodeVariablesContext.Provider>;
}

export function useNodeVariables(): NodeVariables {
  return useContext(NodeVariablesContext);
}
