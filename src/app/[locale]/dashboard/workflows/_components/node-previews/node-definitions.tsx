"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

import { testBehaviorOf, type NodeTestBehavior } from "@/lib/workflows/node-test-behavior";
import type { NodeDefinition } from "@/lib/workflows/types";

const NodeDefinitionsContext = createContext<ReadonlyMap<string, NodeDefinition> | null>(null);

export function NodeDefinitionsProvider({
  definitions,
  children,
}: {
  definitions: readonly NodeDefinition[];
  children: ReactNode;
}) {
  const byType = useMemo(() => new Map(definitions.map((definition) => [definition.type, definition])), [definitions]);
  return <NodeDefinitionsContext.Provider value={byType}>{children}</NodeDefinitionsContext.Provider>;
}

export function useNodeDefinition(type: string): NodeDefinition | undefined {
  return useContext(NodeDefinitionsContext)?.get(type);
}

export function useTestBehaviorOf(): (nodeType: string) => NodeTestBehavior | undefined {
  const byType = useContext(NodeDefinitionsContext);
  return useCallback((nodeType: string) => testBehaviorOf(byType, nodeType), [byType]);
}
