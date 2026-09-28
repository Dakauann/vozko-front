"use client";

import { Info, Warning } from "@/components/icons";
import { useTranslations } from "next-intl";

import { ProfileNotice } from "@/components/channels/channel-profile-parts";
import type { FacebookRouting } from "@/lib/facebook/types";

export function RoutingHealthBanner({ routing }: { routing: FacebookRouting }) {
  const t = useTranslations("facebook.routing");
  if (routing.isDefaultApp === true) return null;

  const off = routing.isDefaultApp === false;
  return (
    <ProfileNotice
      color={off ? "amber" : "slate"}
      icon={off ? <Warning className="h-4 w-4" /> : <Info className="h-4 w-4" />}
    >
      <p className="font-medium">{off ? t("offTitle") : t("unknownTitle")}</p>
      <p className="mt-1 opacity-80">{off ? t("offBody") : t("unknownBody")}</p>
      <p className="mt-1 opacity-80">{t("howTo")}</p>
      <p className="mt-1 text-2xs opacity-70">
        {t("heuristic")}
        {routing.checkedAt ? ` ${t("checkedAt", { date: new Date(routing.checkedAt).toLocaleString() })}` : ""}
      </p>
    </ProfileNotice>
  );
}
