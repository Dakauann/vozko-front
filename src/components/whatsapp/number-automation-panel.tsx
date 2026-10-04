"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import {
  getNumberAutomationAction,
  updateNumberAutomationAction,
} from "@/app/actions/whatsapp-business-phones";
import {
  ChannelAutomationPanel,
  type ChannelAutomationPayload,
} from "@/components/channels/channel-automation-panel";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { CircleNotch, Warning } from "@/components/icons";
import {
  withNumberAutomation,
  type NumberAutomation,
} from "@/lib/whatsapp-business-phones/automation";

type Loaded =
  | { state: "loading" }
  | { state: "failed" }
  | { state: "ready"; automation: NumberAutomation };

export function NumberAutomationPanel({ phoneId }: { phoneId: string }) {
  const t = useTranslations("whatsappBusinessPhones.automation");
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });

  useEffect(() => {
    let active = true;
    void getNumberAutomationAction(phoneId).then((result) => {
      if (!active) return;
      setLoaded(result.account ? { state: "ready", automation: result.account } : { state: "failed" });
    });
    return () => {
      active = false;
    };
  }, [phoneId]);

  if (loaded.state === "loading") {
    return (
      <ElevatedContainer className="flex items-center justify-center p-6">
        <CircleNotch className="h-5 w-5 animate-spin text-muted-foreground" />
      </ElevatedContainer>
    );
  }

  if (loaded.state === "failed") {
    return (
      <ElevatedContainer className="flex items-start gap-2 p-6 text-sm text-destructive-ink">
        <Warning className="mt-0.5 h-4 w-4 shrink-0" />
        {t("loadFailed")}
      </ElevatedContainer>
    );
  }

  const save = async (id: string, payload: ChannelAutomationPayload) => {
    const result = await updateNumberAutomationAction(id, withNumberAutomation(loaded.automation, payload));
    if (!result.account) return { error: t("saveFailed") };
    return { account: result.account };
  };

  return (
    <ChannelAutomationPanel<NumberAutomation>
      account={loaded.automation}
      onUpdated={(automation) => setLoaded({ state: "ready", automation })}
      onSave={save}
      translationNamespace="whatsappBusinessPhones.automation"
      controlId="number-automation-enabled"
      showHandling
    />
  );
}

export function NumberAutomationOwnedElsewhere() {
  const t = useTranslations("whatsappBusinessPhones.automation");
  return (
    <ElevatedContainer className="space-y-1 p-6">
      <h3 className="font-display text-base font-semibold tracking-[0.01em] text-foreground">{t("title")}</h3>
      <p className="max-w-md text-sm text-muted-foreground">{t("ownedElsewhere")}</p>
    </ElevatedContainer>
  );
}
