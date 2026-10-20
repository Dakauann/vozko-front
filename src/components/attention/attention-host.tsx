"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { getBrand } from "@/config/brand";
import { useWorkspace } from "@/contexts/workspace-context";
import { useRouter } from "@/i18n/routing";
import { claimInBrowser, showInBrowser, type DesktopCopy } from "@/lib/attention/browser";
import { desktopAlertsAllowed } from "@/lib/attention/desktop-preference";
import type { AttentionSignal } from "@/lib/attention/rules";
import { createAttention } from "@/lib/attention/service";
import { setAttentionSink, signalAttention, viewingNow } from "@/lib/attention/signal";
import { subscribeNotificationCreated } from "@/lib/notifications/bus";
import { messageSoundsMuted } from "@/lib/sounds/message-sound-preference";
import { soundPlayer } from "@/lib/sounds/sound-player";

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

export function AttentionHost() {
  const t = useTranslations("attention");
  const router = useRouter();
  const workspaceId = useWorkspace().currentWorkspace?.id ?? "";

  useEffect(() => {
    const copy: DesktopCopy = {
      fallbackTitle: (source) => t(`fallbackTitle.${source}`),
      summaryTitle: (source, count) => t(`summaryTitle.${source}`, { count }),
      summaryBody: (source) => t(`summaryBody.${source}`),
    };
    const open = (signal: AttentionSignal) => {
      if (signal.open) signal.open();
      else if (signal.href && isExternal(signal.href)) window.open(signal.href, "_blank", "noopener");
      else if (signal.href) router.push(signal.href);
    };
    const attend = createAttention({
      now: () => Date.now(),
      view: () => ({
        focused: document.hasFocus(),
        visible: document.visibilityState === "visible",
        viewing: viewingNow(),
        soundMuted: messageSoundsMuted(),
        desktopAllowed: desktopAlertsAllowed(),
      }),
      claim: claimInBrowser,
      play: (sound) => (sound === "message" ? soundPlayer.play("message") : soundPlayer.chime()),
      show: (notice) => showInBrowser(notice, copy, getBrand().logo.mark, open),
    });
    return setAttentionSink((signal) => void attend(signal));
  }, [router, t]);

  useEffect(
    () =>
      subscribeNotificationCreated((event) => {
        if (event.workspaceId !== workspaceId) return;
        const { item } = event;
        signalAttention({
          id: `notification:${item.id}`,
          source: "notification",
          group: item.id,
          title: item.title,
          body: item.body,
          critical: item.severity === "critical",
          href: item.actionUrl,
        });
      }),
    [workspaceId],
  );

  useEffect(() => {
    const unlock = () => soundPlayer.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  return null;
}
