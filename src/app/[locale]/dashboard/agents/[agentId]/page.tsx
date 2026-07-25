"use client";

import { use, useEffect, useState } from "react";
import {
  getAgentByIdAction,
  getAgentOptionsAction,
  getAgentToolsAction,
} from "@/app/actions/agents";
import type {
  Agent,
  AgentOptions,
  AgentToolDefinition,
} from "@/lib/agents/types";

import AgentDetail from "./_components/AgentDetail";
import { notFound } from "next/navigation";

interface AgentDetailPageProps {
  params: Promise<{
    agentId: string;
  }>;
}

interface PageState {
  loading: boolean;
  error?: string;
  notFound?: boolean;
  agent?: Agent;
  options?: AgentOptions | null;
  tools?: AgentToolDefinition[];
}

function PageLoader() {
  return (
    <main className="flex w-full items-center justify-center py-24">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary"
        role="status"
        aria-label="Loading"
      />
    </main>
  );
}

export default function AgentDetailPage({ params }: AgentDetailPageProps) {
  const { agentId } = use(params);
  const [state, setState] = useState<PageState>({ loading: true });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true });

    Promise.all([
      getAgentByIdAction(agentId),
      getAgentOptionsAction(),
      getAgentToolsAction(),
    ]).then(([agentResult, optionsResult, toolsResult]) => {
      if (cancelled) return;
      if (agentResult.error) {
        setState({ loading: false, error: agentResult.error });
        return;
      }
      if (!agentResult.agent) {
        setState({ loading: false, notFound: true });
        return;
      }
      setState({
        loading: false,
        agent: agentResult.agent,
        options: optionsResult.options ?? null,
        tools: toolsResult.tools ?? [],
      });
    });

    return () => {
      cancelled = true;
    };
  }, [agentId]);

  if (state.loading) return <PageLoader />;
  if (state.notFound) notFound();
  if (state.error) {
    return (
      <main className="w-full space-y-6">
        <div className="rounded-2xl border border-rose-600 bg-rose-500 px-4 py-3 text-sm text-white">
          {state.error}
        </div>
      </main>
    );
  }

  return (
    <main className="w-full space-y-6">
      <AgentDetail
        agent={state.agent!}
        options={state.options ?? null}
        tools={state.tools ?? []}
      />
    </main>
  );
}
