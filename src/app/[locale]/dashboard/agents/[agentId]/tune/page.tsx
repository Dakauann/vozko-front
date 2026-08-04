"use client";

import { use, useEffect, useState } from "react";

import type { Agent } from "@/lib/agents/types";
import { OnboardingTuningPanel } from "@/components/agents/OnboardingTuningPanel";
import { getAgentByIdAction } from "@/app/actions/agents";
import { notFound } from "next/navigation";
import { useTranslations } from "next-intl";

interface TunePageProps {
  params: Promise<{ agentId: string }>;
}

interface PageState {
  loading: boolean;
  notFound?: boolean;
  agent?: Agent;
}

function PageLoader() {
  return (
    <main className="flex w-full items-center justify-center py-24">
      <div
        className="h-8 w-8 animate-spin rounded-full border border-muted border-t-primary"
        role="status"
        aria-label="Loading"
      />
    </main>
  );
}

export default function TunePage({ params }: TunePageProps) {
  const { agentId } = use(params);
  const t = useTranslations("agents.tuning");

  const [state, setState] = useState<PageState>({ loading: true });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true });

    getAgentByIdAction(agentId).then(({ agent, error }) => {
      if (cancelled) return;
      if (!agent) {
        if (error) {
          console.error("Failed to load agent for tuning:", error);
        }
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

  const agent = state.agent!;

  return (
    <main className="w-full space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">{t("title")}</h1>
        <p className="max-w-3xl text-base text-muted-foreground">
          {t("description")}
        </p>
      </header>

      <OnboardingTuningPanel agent={agent} />
    </main>
  );
}
