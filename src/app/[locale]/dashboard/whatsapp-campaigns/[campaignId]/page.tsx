"use client";

import { use, useEffect, useState } from "react";

import { AccessDenied } from "@/components/ui/access-denied";
import WhatsAppCampaignDetail from "./_components/WhatsAppCampaignDetail";
import type { WhatsAppCampaign } from "@/lib/whatsapp-campaigns/types";
import { getWhatsAppCampaignByIdAction } from "@/app/actions/whatsapp-campaigns";
import { listAgentsAction } from "@/app/actions/agents";
import { listWhatsAppTemplatesAction } from "@/app/actions/whatsapp-templates";
import { notFound } from "next/navigation";
import { useMessages } from "next-intl";

interface WhatsAppCampaignDetailPageProps {
  params: Promise<{
    campaignId: string;
    locale: string;
  }>;
}

interface PageState {
  loading: boolean;
  error?: string;
  notFound?: boolean;
  campaign?: WhatsAppCampaign;
  agentName?: string;
  templateName?: string;
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

export default function WhatsAppCampaignDetailPage({
  params,
}: WhatsAppCampaignDetailPageProps) {
  const { campaignId, locale } = use(params);
  const messages = useMessages();
  const [state, setState] = useState<PageState>({ loading: true });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true });

    Promise.all([
      getWhatsAppCampaignByIdAction(campaignId),
      listAgentsAction({ pageSize: 500 }),
      listWhatsAppTemplatesAction({ pageSize: 500 }),
    ]).then(([campaignResult, agentsResult, templatesResult]) => {
      if (cancelled) return;

      const { campaign, error } = campaignResult;

      if (error) {
        setState({ loading: false, error });
        return;
      }

      if (!campaign) {
        setState({ loading: false, notFound: true });
        return;
      }

      const { agents } = agentsResult;
      const { templates } = templatesResult;
      const agentMatch = agents?.find((agent) => agent.id === campaign.agentId);
      const templateMatch = templates?.find((t) => t.id === campaign.templateId);

      setState({
        loading: false,
        campaign,
        agentName: agentMatch?.name ?? campaign.agentName ?? undefined,
        templateName: templateMatch?.name ?? campaign.templateName ?? undefined,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  if (state.loading) return <PageLoader />;
  if (state.notFound) notFound();
  if (state.error) {
    if (state.error.includes("Insufficient permissions")) {
      return (
        <main className="w-full space-y-6">
          <AccessDenied backHref="/dashboard/whatsapp-campaigns" />
        </main>
      );
    }

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
      <WhatsAppCampaignDetail
        campaign={state.campaign!}
        agentName={state.agentName}
        templateName={state.templateName}
        messages={messages}
        locale={locale}
      />
    </main>
  );
}
