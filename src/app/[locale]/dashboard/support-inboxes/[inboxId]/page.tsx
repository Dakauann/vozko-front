"use client";

import { use, useEffect, useState } from "react";

import { AccessDenied } from "@/components/ui/access-denied";
import SupportInboxDetail from "./_components/SupportInboxDetail";
import type { SupportInbox } from "@/lib/support-inboxes/types";
import { getSupportInboxAction } from "@/app/actions/support-inboxes";
import { listAgentsAction } from "@/app/actions/agents";
import { notFound } from "next/navigation";

interface SupportInboxDetailPageProps {
  params: Promise<{
    inboxId: string;
    locale: string;
  }>;
}

interface PageState {
  loading: boolean;
  error?: string;
  accessDenied?: boolean;
  notFound?: boolean;
  inbox?: SupportInbox;
  agentName?: string;
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

export default function SupportInboxDetailPage({
  params,
}: SupportInboxDetailPageProps) {
  const { inboxId } = use(params);
  const [state, setState] = useState<PageState>({ loading: true });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true });

    Promise.all([
      getSupportInboxAction(inboxId),
      listAgentsAction({ pageSize: 500 }),
    ]).then(([inboxResult, agentsResult]) => {
      if (cancelled) return;

      const { inbox, error } = inboxResult;

      if (error) {
        if (error.includes("Insufficient permissions")) {
          setState({ loading: false, accessDenied: true });
          return;
        }
        setState({ loading: false, error });
        return;
      }

      if (!inbox) {
        setState({ loading: false, notFound: true });
        return;
      }

      const agentMatch = agentsResult.agents?.find((a) => a.id === inbox.agentId);

      setState({
        loading: false,
        inbox,
        agentName: agentMatch?.name,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [inboxId]);

  if (state.loading) return <PageLoader />;
  if (state.notFound) notFound();

  if (state.accessDenied) {
    return (
      <main className="w-full space-y-6">
        <AccessDenied backHref="/dashboard/support-inboxes" />
      </main>
    );
  }

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
      <SupportInboxDetail inbox={state.inbox!} agentName={state.agentName} />
    </main>
  );
}
