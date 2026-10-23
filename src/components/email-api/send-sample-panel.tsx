"use client";

import { useTranslations } from "next-intl";

import { PanelSection } from "@/components/dashboard/PanelSection";
import Button from "@/components/elevated-design/button";
import { CopyableCode } from "@/components/elevated-design/copyable-code";
import { ArrowSquareOut, Key } from "@/components/icons";
import { getBrand } from "@/config/brand";
import { useEmailSetup } from "@/hooks/use-email-marketing";
import { useSettledPermission } from "@/hooks/use-settled-permission";
import { getApiBaseUrl } from "@/lib/api/browser-client";
import { API_KEYS_PATH } from "@/lib/api-keys/paths";
import { sendCurl } from "@/lib/email-api/presentation";

export function SendSamplePanel() {
  const t = useTranslations("emailApi.sample");
  const setup = useEmailSetup({ live: false });
  const canSeeKeys = useSettledPermission("api_keys", "read");
  const brand = getBrand();
  const senders = setup.data?.senders ?? [];
  const from = (senders.find((s) => s.is_default) ?? senders[0])?.address ?? t("fromPlaceholder");
  const curl = sendCurl({ baseUrl: getApiBaseUrl(), from, to: t("to"), subject: t("subject"), html: t("html"), idempotencyKey: "reset-7f3c2a" });

  return (
    <PanelSection
      title={t("title")}
      description={t("description")}
      actions={
        <span className="flex flex-wrap gap-2">
          {canSeeKeys ? <Button link={API_KEYS_PATH} newTab={false} variant="outline" size="sm" icon={<Key className="h-3.5 w-3.5" weight="bold" />} iconVisible title={t("keys")} /> : null}
          {brand.docsUrl ? <Button link={brand.docsUrl} newTab variant="outline" size="sm" icon={<ArrowSquareOut className="h-3.5 w-3.5" weight="bold" />} iconVisible title={t("docs")} /> : null}
        </span>
      }
    >
      <div className="space-y-3">
        <CopyableCode code={curl} copyLabel={t("copy")} copiedLabel={t("copied")} failedLabel={t("copyFailed")} />
        <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">
          <li>{t("noteKey")}</li>
          <li>{t("noteIdempotency")}</li>
          <li>{t("noteInbox")}</li>
        </ul>
      </div>
    </PanelSection>
  );
}
