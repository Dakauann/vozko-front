"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  exportGroupMembersAction,
  followGroupAction,
  getWorkspaceGroupInviteLinkAction,
  nextGroupInSeriesAction,
  refreshGroupAction,
  unfollowGroupAction,
} from "@/app/actions/unofficial-whatsapp-groups";
import { useRouter } from "@/i18n/routing";
import type { WorkspaceGroup } from "@/lib/unofficial-whatsapp-groups/types";

import { groupsRoutes } from "../kit/routes";
import { rememberSetupWarnings } from "./setup-warnings-store";

type GroupActionKind = "follow" | "unfollow" | "refresh" | "invite" | "export" | "series";

export function useGroupActions(group: WorkspaceGroup, onChanged: () => void) {
  const t = useTranslations("unofficialGroups.detail.actions");
  const tSetup = useTranslations("unofficialGroups.kit.notices.setup");
  const router = useRouter();
  const [busy, setBusy] = useState<GroupActionKind | null>(null);

  const follow = useCallback(async () => {
    setBusy("follow");
    const result = await followGroupAction(group.id);
    setBusy(null);
    if (result.error) {
      toast.error(t("followFailed"), { description: result.error });
      return;
    }
    toast(t("followed"), { description: t("followedHint") });
    onChanged();
  }, [group.id, onChanged, t]);

  const unfollow = useCallback(async () => {
    setBusy("unfollow");
    const result = await unfollowGroupAction(group.id);
    setBusy(null);
    if (result.error) {
      toast.error(t("unfollowFailed"), { description: result.error });
      return;
    }
    toast(t("unfollowed"), { description: t("unfollowedHint") });
    onChanged();
  }, [group.id, onChanged, t]);

  const refresh = useCallback(async () => {
    setBusy("refresh");
    const result = await refreshGroupAction(group.id);
    setBusy(null);
    if (result.error) {
      toast.error(t("refreshFailed"), { description: result.error });
      return;
    }
    toast(t("refreshed"));
    onChanged();
  }, [group.id, onChanged, t]);

  const copyInvite = useCallback(async () => {
    setBusy("invite");
    const result = await getWorkspaceGroupInviteLinkAction(group.id);
    if (result.error || !result.inviteLink) {
      setBusy(null);
      toast.error(t("inviteFailed"), { description: result.error });
      return;
    }
    try {
      await navigator.clipboard.writeText(result.inviteLink);
      toast(t("inviteCopied"), { description: result.inviteLink });
    } catch {
      toast(t("inviteReady"), { description: result.inviteLink });
    }
    setBusy(null);
  }, [group.id, t]);

  const exportMembers = useCallback(async () => {
    setBusy("export");
    const result = await exportGroupMembersAction(group.id);
    setBusy(null);
    if (result.error) toast.error(t("exportFailed"), { description: result.error });
  }, [group.id, t]);

  const nextInSeries = useCallback(async () => {
    setBusy("series");
    const result = await nextGroupInSeriesAction(group.id);
    setBusy(null);
    if (result.error || !result.data) {
      toast.error(t("seriesFailed"), { description: result.error });
      return false;
    }
    const { group: created, warnings } = result.data;
    if (warnings.length > 0) {
      rememberSetupWarnings(created.id, warnings);
      const steps = warnings.map((warning) => warning.step);
      toast.warning(t("seriesCreatedWithWarnings"), {
        description: steps.map((step) => tSetup(`steps.${step}`)).join(", "),
        action: {
          label: tSetup("openSettings"),
          onClick: () => router.push(groupsRoutes.group(created.id, { tab: "settings", setup: steps })),
        },
      });
    } else {
      toast(t("seriesCreated"), { description: created.subject });
    }
    router.push(groupsRoutes.group(created.id));
    return true;
  }, [group.id, router, t, tSetup]);

  return { busy, follow, unfollow, refresh, copyInvite, exportMembers, nextInSeries };
}

export type GroupActions = ReturnType<typeof useGroupActions>;
