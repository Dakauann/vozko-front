"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { ScreenLoader } from "@/components/brand/screen-loader";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { PanelSection } from "@/components/dashboard/PanelSection";
import { ConnectDomainSheet } from "@/components/email-marketing/connect-domain-sheet";
import { DomainsPanelList } from "@/components/email-marketing/domains-panel";
import { EmailActivation } from "@/components/email-marketing/email-activation";
import { PausedAccountNotice } from "@/components/email-marketing/paused-account-notice";
import { RepliesPausedNotice } from "@/components/email-marketing/replies-paused-notice";
import { SendersPanelBody } from "@/components/email-marketing/senders-panel";
import { ProbationProgress, SendingLadder } from "@/components/email-marketing/sending-ladder";
import { SuppressionsPanelBody } from "@/components/email-marketing/suppressions-panel";
import { useEmailError } from "@/components/email-marketing/use-email-error";
import Button from "@/components/elevated-design/button";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { ExplainerHint } from "@/components/explainers/ExplainerHint";
import { Globe, PaperPlaneTilt } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import { useEmailSetup, useRefreshEmail } from "@/hooks/use-email-marketing";
import { useSettledPermission } from "@/hooks/use-settled-permission";
import { accountStatusTone } from "@/lib/email-marketing/ladder";

function TitleWithHint({ title, hint }: { title: string; hint: "email.ladder" | "email.dnsRecords" }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {title}
      <ExplainerHint id={hint} />
    </span>
  );
}

export default function EmailSendersPage() {
  const t = useTranslations("emailMarketing");
  const describe = useEmailError();
  const setup = useEmailSetup();
  const refresh = useRefreshEmail();
  const canConfigure = useSettledPermission("email_marketing", "configure");
  const [connectOpen, setConnectOpen] = useState(false);
  const onChanged = () => void refresh("setup");

  if (setup.isPending) return <ScreenLoader fit="screen" />;

  const account = setup.data?.account ?? null;
  const ready = setup.data?.provisioned === true && account !== null;

  return (
    <main className="w-full space-y-6">
      <DashboardPageHeader
        icon={<PaperPlaneTilt weight="fill" />}
        badge={t("sendersPage.title")}
        description={t("sendersPage.description")}
        actions={
          ready && canConfigure ? (
            <Button icon={<Globe className="h-4 w-4" weight="bold" />} iconVisible title={t("sendersPage.connectDomain")} onClick={() => setConnectOpen(true)} />
          ) : undefined
        }
      />

      {setup.isError ? (
        <Notice tone="fault" title={t("overview.setupFailed")}>
          <p>{describe(setup.error)}</p>
          <Button variant="outline" size="sm" title={t("common.retry")} onClick={() => void setup.refetch()} />
        </Notice>
      ) : null}

      {setup.data && !ready ? <EmailActivation subdomain={setup.data.subdomain} activation={setup.data.activation} /> : null}

      {ready && setup.data && account ? (
        <>
          <PausedAccountNotice account={account} />
          <RepliesPausedNotice setup={setup.data} />

          <PanelSection
            title={<TitleWithHint title={t("sendersPage.ladderTitle")} hint="email.ladder" />}
            description={t("sendersPage.ladderDescription")}
            actions={<StatusChip tone={accountStatusTone(account.status)} label={t(`accountStatus.${account.status}`)} />}
          >
            <div className="space-y-5">
              <SendingLadder account={account} />
              {setup.data.probation ? <ProbationProgress probation={setup.data.probation} /> : null}
            </div>
          </PanelSection>

          <PanelSection title={<TitleWithHint title={t("sendersPage.domainsTitle")} hint="email.dnsRecords" />} description={t("sendersPage.domainsDescription")}>
            <DomainsPanelList setup={setup.data} canConfigure={canConfigure} onChanged={onChanged} />
          </PanelSection>

          <PanelSection title={t("sendersPage.sendersTitle")} description={t("sendersPage.sendersDescription")}>
            <SendersPanelBody setup={setup.data} canConfigure={canConfigure} onChanged={onChanged} />
          </PanelSection>

          <PanelSection title={t("sendersPage.suppressionsTitle")} description={t("sendersPage.suppressionsDescription")}>
            <SuppressionsPanelBody canConfigure={canConfigure} />
          </PanelSection>

          <ConnectDomainSheet open={connectOpen} onOpenChange={setConnectOpen} onChanged={onChanged} />
        </>
      ) : null}
    </main>
  );
}
