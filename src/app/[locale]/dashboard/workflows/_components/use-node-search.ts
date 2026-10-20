"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Node } from "@xyflow/react";

import type { NodeDefinition } from "@/lib/workflows/types";

import type { WorkflowNodeData } from "./workflow-node";
import { matchNodeIds } from "./workflow-node-search";

interface NodeSearchInput {
  structureNodes: Node[];
  defMap: Map<string, NodeDefinition>;
  setNodes: Dispatch<SetStateAction<Node[]>>;
  focusNode: (nodeId: string) => void;
}

export function useNodeSearch({ structureNodes, defMap, setNodes, focusNode }: NodeSearchInput) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTypeFilter, setSearchTypeFilter] = useState<string | null>(null);
  const [searchActiveIndex, setSearchActiveIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const searchTypes = useMemo(() => {
    const seen = new Map<string, string>();
    for (const n of structureNodes) {
      const d = n.data as unknown as WorkflowNodeData;
      if (d.nodeType === "group" || seen.has(d.nodeType)) continue;
      seen.set(d.nodeType, defMap.get(d.nodeType)?.label ?? d.nodeType);
    }
    return [...seen.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, z) => a.label.localeCompare(z.label));
  }, [structureNodes, defMap]);

  const searchMatches = useMemo(() => {
    if (!searchOpen) return [] as string[];
    return matchNodeIds(
      searchQuery,
      structureNodes
        .filter(
          (n) => (n.data as unknown as WorkflowNodeData).nodeType !== "group",
        )
        .map((n) => {
          const d = n.data as unknown as WorkflowNodeData;
          return {
            id: n.id,
            label: d.label,
            nodeType: d.nodeType,
            config: d.config,
          };
        }),
      { type: searchTypeFilter },
    );
  }, [searchOpen, searchQuery, searchTypeFilter, structureNodes]);
  const searchMatchKey = searchMatches.join(",");

  useEffect(() => {
    const active =
      searchOpen &&
      (searchQuery.trim().length > 0 || searchTypeFilter != null);
    const matchSet = new Set(searchMatches);
    const hasMatches = matchSet.size > 0;
    setNodes((nds) => {
      let changed = false;
      const next = nds.map((n) => {
        const d = n.data as unknown as WorkflowNodeData;
        const isGroup = d.nodeType === "group";
        const wantMatch = active && matchSet.has(n.id);
        const wantDim = active && hasMatches && !matchSet.has(n.id) && !isGroup;
        if (
          Boolean(d.searchMatch) === wantMatch &&
          Boolean(d.searchDim) === wantDim
        ) {
          return n;
        }
        changed = true;
        return { ...n, data: { ...d, searchMatch: wantMatch, searchDim: wantDim } };
      });
      return changed ? next : nds;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchOpen, searchQuery, searchTypeFilter, searchMatchKey, setNodes]);

  const [seenMatches, setSeenMatches] = useState<string | null>(null);
  const matchesKey = searchOpen ? searchMatchKey : null;
  if (matchesKey !== null && matchesKey !== seenMatches) {
    setSeenMatches(matchesKey);
    setSearchActiveIndex(searchMatches.length === 1 ? 0 : -1);
  } else if (matchesKey === null && seenMatches !== null) {
    setSeenMatches(null);
  }

  const onlyMatch = searchOpen && searchMatches.length === 1 ? searchMatches[0] : null;
  useEffect(() => {
    if (onlyMatch) focusNode(onlyMatch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchMatchKey, searchOpen]);

  const goToMatch = useCallback(
    (delta: number) => {
      const count = searchMatches.length;
      if (count === 0) return;
      const nextIndex =
        searchActiveIndex < 0
          ? delta > 0
            ? 0
            : count - 1
          : (searchActiveIndex + delta + count) % count;
      setSearchActiveIndex(nextIndex);
      focusNode(searchMatches[nextIndex]);
    },
    [searchMatches, searchActiveIndex, focusNode],
  );

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    requestAnimationFrame(() => searchInputRef.current?.select());
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchTypeFilter(null);
    setSearchActiveIndex(-1);
  }, []);

  return {
    searchInputRef,
    search: {
      searchOpen,
      searchQuery,
      setSearchQuery,
      searchTypeFilter,
      setSearchTypeFilter,
      searchActiveIndex,
      searchTypes,
      searchMatches,
      goToMatch,
      openSearch,
      closeSearch,
    },
  };
}

export type NodeSearch = ReturnType<typeof useNodeSearch>["search"];
