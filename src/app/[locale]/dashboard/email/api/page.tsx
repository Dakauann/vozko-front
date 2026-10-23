"use client";

import { useTranslations } from "next-intl";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { PanelSection } from "@/components/dashboard/PanelSection";
import { EmailLogTable } from "@/components/email-api/email-log-table";
import { SendSamplePanel } from "@/components/email-api/send-sample-panel";
import Button from "@/components/elevated-design/button";
import { Code, WebhooksLogo } from "@/components/icons";
import { EMAIL_WEBHOOKS_PATH } from "@/lib/email-api/presentation";

export default function EmailApiPage() {
  const t = useTranslations("emailApi");
  return (
    <main className="w-full space-y-6">
      <DashboardPageHeader
        icon={<Code weight="bold" />}
        badge={t("title")}
        description={t("description")}
        actions={<Button link={EMAIL_WEBHOOKS_PATH} newTab={false} variant="outline" icon={<WebhooksLogo className="h-4 w-4" weight="bold" />} iconVisible title={t("webhooksLink")} />}
      />
      <SendSamplePanel />
      <PanelSection title={t("log.title")} description={t("log.description")}>
        <EmailLogTable />
      </PanelSection>
    </main>
  );
}
