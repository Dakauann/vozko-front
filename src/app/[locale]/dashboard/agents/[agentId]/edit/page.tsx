"use client";

import { use, useEffect, useState } from "react";

import type { Agent } from "@/lib/agents/types";
import EditAgentClient from "./EditAgentClient";
import { getAgentByIdAction } from "@/app/actions/agents";
import { notFound } from "next/navigation";

interface EditAgentPageProps {
  params: Promise<{
    agentId: string;
  }>;
}

interface PageState {
  loading: boolean;
  error?: string;
  notFound?: boolean;
  agent?: Agent;
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

export default function EditAgentPage({ params }: EditAgentPageProps) {
  const { agentId } = use(params);
  const [state, setState] = useState<PageState>({ loading: true });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true });

    getAgentByIdAction(agentId).then(({ agent, error }) => {
      if (cancelled) return;
      if (error) {
        setState({ loading: false, error });
        return;
      }
      if (!agent) {
        setState({ loading: false, notFound: true });
        return;
      }
      setState({ loading: false, agent });
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

  return <EditAgentClient agent={state.agent!} />;
}
