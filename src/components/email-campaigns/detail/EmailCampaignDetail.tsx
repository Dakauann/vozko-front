"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { createEmailCampaignAction, isEmailActionError } from "@/app/actions/email-campaigns";
import { ScreenLoader } from "@/components/brand/screen-loader";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import { Copy, EnvelopeSimple, PencilSimple } from "@/components/icons";
import { AccessDenied } from "@/components/ui/access-denied";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Notice } from "@/components/ui/notice";
import { useWorkspace } from "@/contexts/workspace-context";
import { emailCampaignsRoot, metricsPollInterval, useEmailCampaign, useEmailCampaignMetrics, useEmailCampaignReview } from "@/hooks/use-email-campaigns";
import { sectionErrorCode } from "@/lib/analytics/section-query";
import { duplicateRequest } from "@/lib/email-campaigns/draft";
import { campaignCommands, canRun, isLaunched, isWizardStatus, wizardHref } from "@/lib/email-campaigns/status";
import type { Campaign, RecipientStatus } from "@/lib/email-campaigns/types";

import { useEmailErrorMessage, useEmailPermission } from "../shared";
import { COMMAND_ICON } from "../command-icons";
import { StartCampaignDialog } from "../StartCampaignDialog";
import { useCampaignCommands } from "../use-campaign-commands";
import { AbTestResults } from "./AbTestResults";
import { BillingSummaryPanel } from "./BillingSummaryPanel";
import { AudiencePanel, CostPanel } from "../wizard/ReviewPanels";
import { DeliveryFunnel } from "./DeliveryFunnel";
import { EmailLiveOverview } from "./EmailLiveOverview";
import { EmailSettingsPanel } from "./EmailSettingsPanel";
import { EmailTimelinePanel } from "./EmailTimelinePanel";
import { HoldNotices } from "./HoldNotices";
import { MailboxProviders } from "./MailboxProviders";
import { RecipientsPanel } from "./RecipientsPanel";
import { SkippedReasonsPanel } from "./SkippedReasonsPanel";
import { TopLinks } from "./TopLinks";

function PrelaunchPanels({ campaign, review, canReview, canEdit }: { campaign: Campaign; review: ReturnType<typeof useEmailCampaignReview>; canReview: boolean; canEdit: boolean }) {
  const t = useTranslations("emailCampaigns");
  const errorMessage = useEmailErrorMessage();
  return (
    <div className="grid gap-4 lg:grid-cols-12">
      {review.data ? (
        <>
          <AudiencePanel audience={review.data.audience} className="lg:col-span-4" />
          <CostPanel review={review.data} className="lg:col-span-4" />
        </>
      ) : (
        <div className="lg:col-span-8">
          {!canReview ? (
            <Notice tone="info" title={t("detail.notLaunched.title")}>
              <p>{t("detail.notLaunched.body")}</p>
            </Notice>
          ) : review.isError ? (
            <Notice tone="fault" title={t("review.failed")}>
              <p>{errorMessage({ code: sectionErrorCode(review.error) })}</p>
            </Notice>
          ) : (
            <ScreenLoader fit="fill" className="min-h-[240px]" label={t("review.loading")} />
          )}
        </div>
      )}
      <EmailSettingsPanel campaign={campaign} canEdit={canEdit} className="lg:col-span-4" />
    </div>
  );
}

function DetailBody({ campaign, sampledAt }: { campaign: Campaign; sampledAt: number | undefined }) {
  const t = useTranslations("emailCampaigns");
  const router = useRouter();
  const client = useQueryClient();
  const allowed = useEmailPermission();
  const errorMessage = useEmailErrorMessage();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const launched = isLaunched(campaign.status);
  const metrics = useEmailCampaignMetrics(campaign.id);
  const interval = metricsPollInterval(metrics.data);
  const canReview = !launched && allowed("update");
  const review = useEmailCampaignReview(campaign.id, canReview, `${campaign.updated_at}|${campaign.status}`);
  const canEdit = canRun(campaign.actions, "edit", allowed);
  const [recipientStatus, setRecipientStatus] = useState<RecipientStatus | "">("");
  const commands = useCampaignCommands();
  const [stopping, setStopping] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const available = campaignCommands(campaign.actions, allowed);

  const duplicate = async () => {
    const created = await createEmailCampaignAction(duplicateRequest(campaign, t("list.duplicate.name", { name: campaign.name })));
    if (isEmailActionError(created)) {
      toast.error(t("list.duplicate.failed"), { description: errorMessage(created) });
      return;
    }
    toast.success(t("list.duplicate.done"));
    await client.invalidateQueries({ queryKey: emailCampaignsRoot(workspaceId) });
    router.push(wizardHref(created.data.id));
  };

  return (
    <main className="w-full space-y-4">
      <DashboardPageHeader
        icon={<EnvelopeSimple className="h-6 w-6" weight="fill" />}
        badge={t("detail.badge")}
        title={campaign.name}
        description={launched ? t("detail.description") : t("detail.prelaunchDescription")}
        back={{ onClick: () => router.push("/dashboard/email/campaigns"), label: t("wizard.back") }}
        actions={
          <>
            {available.map((command) => (
              <Button
                key={command}
                variant={command === "stop" ? "outline" : "command"}
                title={t(`commands.${command}.action`)}
                icon={COMMAND_ICON[command]}
                iconVisible
                iconSide="left"
                disabled={commands.busy !== null}
                onClick={() => (command === "stop" ? setStopping(true) : command === "start" ? setStarting(campaign.id) : void commands.run(command, campaign.id))}
              />
            ))}
            {canEdit ? (
              <Button variant="command" title={t("detail.edit")} icon={<PencilSimple className="h-4 w-4" />} iconVisible iconSide="left" link={wizardHref(campaign.id)} newTab={false} />
            ) : null}
            {allowed("create") ? <Button variant="command" title={t("list.duplicate.action")} icon={<Copy className="h-4 w-4" />} iconVisible iconSide="left" onClick={() => void duplicate()} /> : null}
          </>
        }
      />

      <HoldNotices campaign={campaign} />

      {metrics.data ? (
        <EmailLiveOverview
          metrics={metrics.data}
          launched={launched}
          ready={review.data?.audience.sendable}
          sampledAt={metrics.dataUpdatedAt || sampledAt}
          unavailable={metrics.isError}
          scheduledAt={campaign.scheduled_at}
          timeZone={campaign.time_zone}
          activeStatus={recipientStatus}
          onFilterStatus={launched ? setRecipientStatus : undefined}
        />
      ) : metrics.isError ? (
        <Notice tone="fault" title={t("detail.metricsFailed")}>
          <p>{errorMessage({ code: sectionErrorCode(metrics.error) })}</p>
        </Notice>
      ) : (
        <ScreenLoader fit="fill" className="min-h-[180px]" />
      )}

      {launched ? (
        <>
          <div className="grid gap-4 lg:grid-cols-12">
            {metrics.data ? <DeliveryFunnel metrics={metrics.data} className="lg:col-span-4" /> : null}
            <EmailTimelinePanel campaignId={campaign.id} className={metrics.data ? "lg:col-span-8" : "lg:col-span-12"} />
            <BillingSummaryPanel campaign={campaign} className="lg:col-span-4" />
            {metrics.data ? <SkippedReasonsPanel metrics={metrics.data} className="lg:col-span-4" /> : null}
            <EmailSettingsPanel campaign={campaign} canEdit={canEdit} className={metrics.data ? "lg:col-span-4" : "lg:col-span-8"} />
          </div>

          {campaign.ab_test ? <AbTestResults test={campaign.ab_test} subject={campaign.subject} metrics={metrics.data} startedAt={campaign.started_at} /> : null}

          <div className="grid gap-4 xl:grid-cols-2">
            <TopLinks campaignId={campaign.id} interval={interval} />
            <MailboxProviders campaignId={campaign.id} interval={interval} />
          </div>

          <RecipientsPanel campaignId={campaign.id} abTest={campaign.ab_test !== undefined} interval={interval} status={recipientStatus} onStatusChange={setRecipientStatus} />
        </>
      ) : (
        <PrelaunchPanels campaign={campaign} review={review} canReview={canReview} canEdit={canEdit} />
      )}

      <StartCampaignDialog campaignId={starting} onClose={() => setStarting(null)} onStart={(id) => commands.run("start", id)} />
      <ConfirmDialog
        open={stopping}
        onOpenChange={setStopping}
        title={t("commands.stop.confirmTitle")}
        description={t("commands.stop.confirmBody")}
        confirmLabel={t("commands.stop.action")}
        onConfirm={async () => {
          await commands.run("stop", campaign.id);
        }}
      />
    </main>
  );
}

export function EmailCampaignDetail({ campaignId }: { campaignId: string }) {
  const t = useTranslations("emailCampaigns");
  const router = useRouter();
  const errorMessage = useEmailErrorMessage();
  const query = useEmailCampaign(campaignId);
  const campaign = query.data;
  const toWizard = campaign !== undefined && isWizardStatus(campaign.status);

  useEffect(() => {
    if (toWizard) router.replace(wizardHref(campaignId));
  }, [toWizard, campaignId, router]);

  if (query.isPending || toWizard) return <ScreenLoader fit="screen" />;
  if (query.isError || !campaign) {
    const code = sectionErrorCode(query.error);
    if ((query.error as { status?: number } | null)?.status === 403) return <AccessDenied backHref="/dashboard/email/campaigns" />;
    return (
      <main className="w-full space-y-4">
        <Notice tone="fault" title={code === "email_campaign_not_found" ? t("detail.notFound") : t("detail.loadFailed")}>
          <p>{errorMessage({ code })}</p>
          <Button variant="secondary" size="sm" title={t("wizard.back")} link="/dashboard/email/campaigns" newTab={false} />
        </Notice>
      </main>
    );
  }
  return <DetailBody campaign={campaign} sampledAt={query.dataUpdatedAt} />;
}
