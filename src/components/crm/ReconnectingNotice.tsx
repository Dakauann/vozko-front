"use client";

import { useTranslations } from "next-intl";

import { Notice } from "@/components/ui/notice";

export function ReconnectingNotice({ visible }: { visible: boolean }) {
  const t = useTranslations("crmConversation.connection");
  if (!visible) return null;
  return (
    <div className="pointer-events-none fixed inset-x-4 top-4 z-50 flex justify-center">
      <Notice
        tone="warning"
        title={t("reconnectingTitle")}
        className="pointer-events-auto w-full max-w-md shadow-lg"
      >
        <p>{t("reconnectingBody")}</p>
      </Notice>
    </div>
  );
}
