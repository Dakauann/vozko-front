"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";

import { getCarrierCampaignAction } from "@/app/actions/carrier-messaging";
import { ScreenLoader } from "@/components/brand/screen-loader";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import { Megaphone } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import { useRouter } from "@/i18n/routing";
import type { Campaign } from "@/lib/carrier-messaging/campaigns";
import { useLoaded } from "@/lib/carrier-messaging/use-loaded";
import { pathForScreen } from "@/lib/navigation/routes";

import { useCarrierRefusalText } from "../../shared/use-carrier-error-text";
import { CarrierCampaignEditor } from "./CarrierCampaignEditor";
import { whatsappFallbackSlot } from "./WhatsAppFallbackPicker";
import { CarrierAreaGate } from "@/components/carrier-messaging/shared/ComingSoon";

const CAMPAIGNS_PATH = "/dashboard/rcs-sms/campaigns";
const NEW_PATH = pathForScreen("carrier_campaign_new") ?? `${CAMPAIGNS_PATH}/new`;

function EditorBody({ initial, onCreated }: { initial?: Campaign; onCreated?: (campaign: Campaign) => void }) {
  const router = useRouter();
  const open = (campaign: Campaign) => router.push(pathForScreen("carrier_campaign", { campaignId: campaign.id }) ?? CAMPAIGNS_PATH);
  const saved = (campaign: Campaign) => {
    if (!initial && onCreated) onCreated(campaign);
  };
  return (
    <CarrierCampaignEditor key={initial?.id ?? "new"} initial={initial} onLaunched={open} onSaved={saved} whatsappTemplateSlot={whatsappFallbackSlot} />
  );
}

function LoadedEditor({ campaignId }: { campaignId: string }) {
  const t = useTranslations("carrierMessaging.pages.campaignHost");
  const refusalText = useCarrierRefusalText();
  const load = useCallback((signal: AbortSignal) => getCarrierCampaignAction(campaignId, signal), [campaignId]);
  const campaign = useLoaded(load, campaignId);
  if (campaign.status === "loading") return <ScreenLoader fit="screen" />;
  if (campaign.status === "failed") {
    return (
      <Notice tone="fault" title={t("loadFailed")}>
        <p>{refusalText(campaign.error)}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" title={t("retry")} onClick={campaign.reload} />
          <Button variant="ghost" size="sm" title={t("back")} link={CAMPAIGNS_PATH} newTab={false} />
        </div>
      </Notice>
    );
  }
  return <EditorBody initial={campaign.data} />;
}

function CarrierCampaignEditorScreenBody() {
  const t = useTranslations("carrierMessaging.pages.campaignHost.header");
  const params = useSearchParams();
  const router = useRouter();
  const campaignId = params.get("campaign") ?? "";
  const [createdId, setCreatedId] = useState<string | null>(null);
  const created = (campaign: Campaign) => {
    if (createdId === campaign.id) return;
    setCreatedId(campaign.id);
    router.replace(`${NEW_PATH}?${new URLSearchParams({ campaign: campaign.id }).toString()}`);
  };
  const keepsEditor = campaignId === "" || campaignId === createdId;
  return (
    <motion.main className="w-full space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <DashboardPageHeader icon={<Megaphone weight="fill" />} badge={campaignId ? t("editBadge") : t("newBadge")} description={t("description")} />
      {keepsEditor ? <EditorBody onCreated={created} /> : <LoadedEditor campaignId={campaignId} />}
    </motion.main>
  );
}

export function CarrierCampaignEditorScreen() {
  const t = useTranslations("carrierMessaging.pages.campaignHost.header");
  return (
    <CarrierAreaGate badge={t("newBadge")} description={t("description")}>
      <CarrierCampaignEditorScreenBody />
    </CarrierAreaGate>
  );
}
