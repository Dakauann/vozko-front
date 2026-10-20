"use client";

import { useTranslations } from "next-intl";

import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import { ExplainerHint } from "@/components/explainers/ExplainerHint";
import { Notice } from "@/components/ui/notice";
import { enableDesktopAlerts, setDesktopAlertsOff, useDesktopAlerts } from "@/lib/attention/desktop-preference";
import { setMessageSoundsMuted, useMessageSoundsMuted } from "@/lib/sounds/message-sound-preference";

export function AttentionControls() {
  const t = useTranslations("attention.controls");
  const muted = useMessageSoundsMuted();
  const desktop = useDesktopAlerts();

  return (
    <div className="space-y-3">
      <ElevatedSwitch
        label={t("sound")}
        description={t("soundHint")}
        checked={!muted}
        onCheckedChange={(on: boolean) => setMessageSoundsMuted(!on)}
        explainer={<ExplainerHint id="settings.alertSound" align="end" />}
      />
      {desktop.permission === "unsupported" ? (
        <p className="text-2xs leading-relaxed text-muted-foreground">{t("desktopUnsupported")}</p>
      ) : desktop.permission === "denied" ? (
        <Notice tone="warning" title={t("desktopBlockedTitle")}>
          <p>{t("desktopBlocked")}</p>
        </Notice>
      ) : (
        <ElevatedSwitch
          label={t("desktop")}
          description={t("desktopHint")}
          checked={desktop.enabled}
          onCheckedChange={(on: boolean) => (on ? void enableDesktopAlerts() : setDesktopAlertsOff(true))}
          explainer={<ExplainerHint id="settings.desktopAlerts" align="end" />}
        />
      )}
    </div>
  );
}
