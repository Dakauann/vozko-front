"use client";

import { useEffect, useState } from "react";
import { getAgentRequiredVariablesAction } from "@/app/actions/agents";
import type { AgentVariableInfo } from "@/lib/agents/types";

export function useAgentRequiredVariables(agentId: string | null | undefined) {
  const [variables, setVariables] = useState<AgentVariableInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!agentId) {
      setVariables([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getAgentRequiredVariablesAction(agentId).then((result) => {
      if (cancelled) return;
      setVariables(result.variables ?? []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [agentId]);

  return { variables, loading };
}