"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { ArrowSquareOut, ChatsCircle } from "@/components/icons";
import { conversationHref } from "@/lib/conversations/deep-link";
import type { GroupDetail } from "@/lib/unofficial-whatsapp-groups/types";

import { Readout } from "../kit/chart-parts";
import { QuietEmpty } from "../kit/empty";
import { GroupsPanel } from "../kit/panel";
import { RelativeTime } from "../kit/relative-time";
import { useGroupsFormat } from "../kit/use-groups-format";
import type { GroupPermissions } from "./use-group-permissions";

export function MessagesTab({ detail, permissions }: { detail: GroupDetail; permissions: GroupPermissions }) {
  const t = useTranslations("unofficialGroups.detail.messagesTab");
  const fmt = useGroupsFormat();
  const { conversationId, activity } = detail;

  return (
    <GroupsPanel title={t("title")} subtitle={t("subtitle")}>
      {!conversationId ? (
        <QuietEmpty icon={<ChatsCircle />} message={t("noConversation")} />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <Readout label={t("messages30d")} value={fmt.num(activity.messages)} />
            <span className="inline-flex items-baseline gap-1.5 text-2xs text-muted-foreground">
              {t("lastActivity")}
              <RelativeTime at={activity.lastActivity} className="readout text-xs font-semibold tabular-nums text-foreground" />
            </span>
          </div>
          <p className="max-w-2xl text-xs leading-relaxed text-foreground">{t("explanation")}</p>
          {permissions.openConversation ? (
            <Button
              variant="primary"
              title={t("open")}
              link={conversationHref(conversationId, "unofficial_whatsapp")}
              newTab={false}
              icon={<ArrowSquareOut className="h-4 w-4" weight="bold" />}
              iconVisible
            />
          ) : (
            <p className="text-xs text-muted-foreground">{t("noAccess")}</p>
          )}
        </div>
      )}
    </GroupsPanel>
  );
}
