"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Chip } from "@/components/audience/shared";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import { StatusChip } from "@/components/elevated-design/status-chip";
import {
  ArrowClockwise,
  Bell,
  BellSlash,
  ChatsCircle,
  Copy,
  DotsThree,
  DownloadSimple,
  Lock,
  Plus,
  Stack,
  Tag,
  Users,
} from "@/components/icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link, useRouter } from "@/i18n/routing";
import { conversationHref } from "@/lib/conversations/deep-link";
import type { GroupDetail } from "@/lib/unofficial-whatsapp-groups/types";
import { cn } from "@/lib/utils";

import { GroupAvatar } from "../marks";
import { StartCampaignButton } from "../kit/campaign";
import { MemberCountLabel, OriginChip } from "../kit/identity";
import { RelativeTime } from "../kit/relative-time";
import { groupsRoutes } from "../kit/routes";
import { useGroupName } from "../kit/use-groups-format";
import { canCreateNextInSeries, hasAdminSeat, headline } from "./detail-model";
import { NextInSeriesConfirm } from "./next-in-series";
import type { GroupActions } from "./use-group-actions";
import type { GroupPermissions } from "./use-group-permissions";

export function GroupHeader({ detail, permissions, actions }: { detail: GroupDetail; permissions: GroupPermissions; actions: GroupActions }) {
  const t = useTranslations("unofficialGroups.detail");
  const tKit = useTranslations("unofficialGroups.kit.identity");
  const router = useRouter();
  const groupName = useGroupName();
  const [confirmSeries, setConfirmSeries] = useState(false);
  const { group, numbers, runningCampaigns, conversationId } = detail;
  const followed = Boolean(group.followedAt);
  const subject = groupName(group.subject);
  const canInvite = hasAdminSeat(numbers);
  const canSeries = canCreateNextInSeries(group, permissions);
  const canConversation = permissions.openConversation && Boolean(conversationId);
  const busy = actions.busy !== null;
  const menuItems = [permissions.update, canInvite, permissions.exportMembers, canConversation, canSeries].some(Boolean);

  return (
    <>
      <DashboardPageHeader
        icon={<GroupAvatar group={{ subject, pictureUrl: group.pictureUrl }} size="md" />}
        badge={t("badge")}
        title={subject}
        description={headline(group.description)}
        back={{ onClick: () => router.push(groupsRoutes.all()), label: t("back") }}
        meta={
          <>
            {followed ? (
              <StatusChip tone="healthy" label={t("header.followed")} />
            ) : (
              <StatusChip tone="muted" label={t("header.notFollowed")} />
            )}
            <OriginChip origin={group.origin} />
            {group.category ? (
              <Chip>
                <Tag className="h-3 w-3 text-muted-foreground" weight="bold" aria-hidden />
                {group.category}
              </Chip>
            ) : null}
            <Chip>
              <Users className="h-3 w-3 text-muted-foreground" weight="bold" aria-hidden />
              <MemberCountLabel count={group.memberCount} className="tabular-nums" />
            </Chip>
            {group.seriesId && group.seriesSequence ? <SeriesChip detail={detail} /> : null}
            {group.announce ? <Chip>{tKit("adminsOnly")}</Chip> : null}
            {group.locked ? (
              <Chip>
                <Lock className="h-3 w-3 text-muted-foreground" weight="bold" aria-hidden />
                {t("header.locked")}
              </Chip>
            ) : null}
            {runningCampaigns > 0 ? (
              <Link
                href={groupsRoutes.group(group.id, { tab: "campaigns" })}
                className="rounded-[--radius] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Chip dot="hsl(var(--healthy))" className="hover:bg-[hsl(var(--accent-hover))]">
                  {t("header.runningCampaigns", { count: runningCampaigns })}
                </Chip>
              </Link>
            ) : null}
            {group.lastActivityAt ? (
              <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground">
                {t("header.lastActivityLabel")}
                <RelativeTime at={group.lastActivityAt} className="readout tabular-nums text-foreground" />
              </span>
            ) : null}
          </>
        }
        actions={
          <>
            <StartCampaignButton groups={[{ id: group.id, origin: group.origin, numbers }]} variant={followed ? "primary" : "secondary"} />
            {permissions.update ? (
              followed ? (
                <Button
                  variant="command"
                  title={t("actions.unfollow")}
                  icon={<BellSlash className="h-4 w-4" weight="bold" />}
                  iconVisible
                  disabled={busy}
                  onClick={() => void actions.unfollow()}
                />
              ) : (
                <Button
                  variant="primary"
                  title={t("actions.follow")}
                  icon={<Bell className="h-4 w-4" weight="bold" />}
                  iconVisible
                  disabled={busy}
                  onClick={() => void actions.follow()}
                />
              )
            ) : null}
            {menuItems ? (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="command"
                    aria-label={t("actions.more")}
                    icon={<DotsThree className={cn("h-4 w-4", busy && "animate-pulse")} weight="bold" />}
                    iconVisible
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[14rem]">
                  {permissions.update ? (
                    <DropdownMenuItem disabled={busy} onSelect={() => void actions.refresh()}>
                      <ArrowClockwise className={cn("mr-2 h-4 w-4", actions.busy === "refresh" && "animate-spin")} />
                      {t("actions.refresh")}
                    </DropdownMenuItem>
                  ) : null}
                  {canInvite ? (
                    <DropdownMenuItem disabled={busy} onSelect={() => void actions.copyInvite()}>
                      <Copy className="mr-2 h-4 w-4" />
                      {t("actions.copyInvite")}
                    </DropdownMenuItem>
                  ) : null}
                  {permissions.exportMembers ? (
                    <DropdownMenuItem disabled={busy} onSelect={() => void actions.exportMembers()}>
                      <DownloadSimple className="mr-2 h-4 w-4" />
                      {t("actions.exportCsv")}
                    </DropdownMenuItem>
                  ) : null}
                  {canConversation && conversationId ? (
                    <DropdownMenuItem onSelect={() => router.push(conversationHref(conversationId, "unofficial_whatsapp"))}>
                      <ChatsCircle className="mr-2 h-4 w-4" />
                      {t("actions.openConversation")}
                    </DropdownMenuItem>
                  ) : null}
                  {canSeries ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem disabled={busy} onSelect={() => setConfirmSeries(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        {t("actions.nextInSeriesLong")}
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </>
        }
      />
      {canSeries ? <NextInSeriesConfirm detail={detail} actions={actions} open={confirmSeries} onOpenChange={setConfirmSeries} /> : null}
    </>
  );
}

function SeriesChip({ detail }: { detail: GroupDetail }) {
  const t = useTranslations("unofficialGroups.detail.header");
  const groupName = useGroupName();
  const { group, series } = detail;
  const siblings = [...series].sort((a, b) => a.sequence - b.sequence);
  const label =
    series.length > 0 ? t("seriesOf", { sequence: group.seriesSequence ?? 0, total: series.length }) : t("series", { sequence: group.seriesSequence ?? 0 });
  if (siblings.length === 0) return <Chip>{label}</Chip>;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-[--radius] border border-border bg-muted px-2 py-0.5 text-2xs font-medium text-foreground transition-colors hover:bg-[hsl(var(--accent-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Stack className="h-3 w-3 text-muted-foreground" weight="bold" aria-hidden />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <p className="px-2 pb-1 text-2xs font-semibold text-muted-foreground">{t("seriesTitle", { count: siblings.length })}</p>
        <ul className="max-h-64 space-y-0.5 overflow-y-auto">
          {siblings.map((sibling) => {
            const current = sibling.groupId === group.id;
            return (
              <li key={sibling.groupId}>
                <Link
                  href={groupsRoutes.group(sibling.groupId)}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 rounded-[--radius] px-2 py-1.5 text-xs transition-colors hover:bg-[hsl(var(--accent-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    current ? "font-semibold text-foreground" : "text-foreground",
                  )}
                >
                  <span className="readout text-2xs tabular-nums text-muted-foreground">#{sibling.sequence}</span>
                  <span className="truncate">{groupName(sibling.subject)}</span>
                  <span className="readout text-2xs tabular-nums text-muted-foreground">{t("seriesMembers", { count: sibling.members })}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
