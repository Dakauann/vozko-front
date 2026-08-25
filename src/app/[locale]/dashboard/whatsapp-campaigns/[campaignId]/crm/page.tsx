"use client";

import { use, useEffect, useState } from "react";

import CrmLayout from "@/components/crm/CrmLayout";
import type { WhatsAppCampaign } from "@/lib/whatsapp-campaigns/types";
import { getWhatsAppCampaignByIdAction } from "@/app/actions/whatsapp-campaigns";
import { notFound } from "next/navigation";
import { useTranslations } from "next-intl";

interface CrmPageProps {
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

export default function WhatsAppCampaignCrmPage({ params }: CrmPageProps) {
  const { campaignId } = use(params);
  const t = useTranslations("crm");
  const [state, setState] = useState<PageState>({ loading: true });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true });

    getWhatsAppCampaignByIdAction(campaignId).then(({ campaign, error }) => {
      if (cancelled) return;
      if (error) {
        setState({ loading: false, error });
        return;
      }
      if (!campaign) {
        setState({ loading: false, notFound: true });
        return;
      }
      setState({ loading: false, campaign });
    });

    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  if (state.loading) return <PageLoader />;
  if (state.notFound) notFound();
  if (state.error) {
    return (
      <main className="w-full space-y-6">
        <div className="rounded-[--radius] border border-destructive bg-destructive px-4 py-3 text-sm text-destructive-foreground">
          {state.error}
        </div>
      </main>
    );
  }

  const campaign = state.campaign!;

  return (
    <main className="w-full space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold text-healthy-ink">
          {t("header.badge")}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-[0.01em] text-foreground">
              {campaign.name}, {t("header.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("header.description")}
            </p>
          </div>
        </div>
      </header>

      <CrmLayout
        campaignId={campaignId}
        campaignType="whatsapp"
        translations={{
          inbox: {
            title: t("inbox.title"),
            searchPlaceholder: t("inbox.searchPlaceholder"),
            noConversations: t("inbox.noConversations"),
            connecting: t("inbox.connecting"),
            disconnected: t("inbox.disconnected"),
            connected: t("inbox.connected"),
            loadingMore: t("inbox.loadingMore"),
          },
          conversation: {
            noConversationSelected: t("conversation.noConversationSelected"),
            noConversationDescription: t(
              "conversation.noConversationDescription",
            ),
            loadingMore: t("conversation.loadingMore"),
            windowClosed: t("conversation.windowClosed"),
            windowClosedDescription: t("conversation.windowClosedDescription"),
            noPermissionStageAssign: t("conversation.noPermissionStageAssign"),
          },
          input: {
            placeholder: t("input.placeholder"),
            windowClosed: t("input.windowClosed"),
            windowClosedDescription: t("input.windowClosedDescription"),
            windowClosedNoClock: t("input.windowClosedNoClock"),
            sendButton: t("input.sendButton"),
            attachFile: t("input.attachFile"),
            recording: t("input.recording"),
            uploading: t("input.uploading"),
            windowExpires: t("input.windowExpires"),
            noPermissionSend: t("input.noPermissionSend"),
          },
        }}
      />
    </main>
  );
}
