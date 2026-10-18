"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { getWorkspaceGroupAction } from "@/app/actions/unofficial-whatsapp-groups";
import { EmptyState } from "@/components/audience/shared";
import { ScreenLoader } from "@/components/brand/screen-loader";
import Button from "@/components/elevated-design/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/elevated-design/elevated-tabs";
import { ArrowLeft, UsersThree } from "@/components/icons";
import type { GroupDetail } from "@/lib/unofficial-whatsapp-groups/types";

import { GroupAnalysesPanel } from "@/components/unofficial-whatsapp-groups/analyses/group-analyses-panel";

import { DETAIL_TABS, groupsRoutes, parseDetailTab, type DetailTab } from "../kit/routes";
import { useGroupsFormat } from "../kit/use-groups-format";
import { CampaignsTab } from "./campaigns-tab";
import { campaignTotalLabel, knownCampaignTally, tabSearch } from "./detail-model";
import { DetailKpiBand } from "./detail-kpi-band";
import { GroupHeader } from "./group-header";
import { MembersTab } from "./members-tab";
import { MessagesTab } from "./messages-tab";
import { OverviewTab } from "./overview-tab";
import { SettingsTab } from "./settings-tab";
import { useGroupActions } from "./use-group-actions";
import { useGroupCampaigns, type GroupCampaignsState } from "./use-group-campaigns";
import { useGroupPermissions } from "./use-group-permissions";

interface LoadedDetail {
  groupId: string;
  detail: GroupDetail | null;
  error: string | null;
  missing: boolean;
}

export function GroupDetailView({ groupId }: { groupId: string }) {
  const t = useTranslations("unofficialGroups.detail");
  const [loaded, setLoaded] = useState<LoadedDetail | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const campaigns = useGroupCampaigns(groupId);

  useEffect(() => {
    let cancelled = false;
    void getWorkspaceGroupAction(groupId).then((result) => {
      if (cancelled) return;
      setLoaded({ groupId, detail: result.data ?? null, error: result.error ?? null, missing: result.status === 404 });
    });
    return () => {
      cancelled = true;
    };
  }, [groupId, retryKey]);

  const reload = useCallback(async () => {
    const result = await getWorkspaceGroupAction(groupId);
    if (result.error || !result.data) {
      toast.error(t("reloadFailed"), { description: result.error });
      return;
    }
    setLoaded({ groupId, detail: result.data, error: null, missing: false });
  }, [groupId, t]);

  const onChanged = useCallback(() => {
    void reload();
  }, [reload]);

  if (!loaded || loaded.groupId !== groupId) return <ScreenLoader fit="screen" />;

  if (!loaded.detail) {
    return (
      <div className="rounded-[--radius] border border-border bg-card">
        <EmptyState
          icon={<UsersThree weight="fill" />}
          title={loaded.missing ? t("notFound.title") : t("loadFailed.title")}
          description={loaded.missing ? t("notFound.text") : (loaded.error ?? t("loadFailed.text"))}
          action={
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <Button
                variant="primary"
                title={t("notFound.back")}
                link={groupsRoutes.all()}
                newTab={false}
                icon={<ArrowLeft className="h-4 w-4" weight="bold" />}
                iconVisible
              />
              <Button
                variant="secondary"
                title={t("notFound.retry")}
                onClick={() => {
                  setLoaded(null);
                  setRetryKey((key) => key + 1);
                }}
              />
            </div>
          }
        />
      </div>
    );
  }

  return <LoadedGroup detail={loaded.detail} campaigns={campaigns} onChanged={onChanged} />;
}

function LoadedGroup({ detail, campaigns, onChanged }: { detail: GroupDetail; campaigns: GroupCampaignsState; onChanged: () => void }) {
  const t = useTranslations("unofficialGroups.detail");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const permissions = useGroupPermissions();
  const fmt = useGroupsFormat();
  const actions = useGroupActions(detail.group, onChanged);
  const tab = parseDetailTab(searchParams.get("tab"));
  const { group } = detail;

  const selectTab = useCallback(
    (next: string) => {
      router.replace(`${pathname}${tabSearch(searchParams.toString(), parseDetailTab(next))}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const campaignTally = knownCampaignTally(campaigns);
  const counts: Partial<Record<DetailTab, string | null>> = {
    members: fmt.num(detail.members.active),
    analysis: fmt.num(detail.analyses.length),
    campaigns: campaignTally ? campaignTotalLabel(campaignTally, fmt.num) : null,
  };

  return (
    <div className="w-full space-y-3">
      <GroupHeader detail={detail} permissions={permissions} actions={actions} />

      <DetailKpiBand detail={detail} campaigns={campaigns} />

      <Tabs value={tab} onValueChange={selectTab}>
        <TabsList aria-label={t("tabs.label")}>
          {DETAIL_TABS.map((key) => {
            const count = counts[key];
            return (
              <TabsTrigger key={key} value={key}>
                {t(`tabs.${key}`)}
                {count ? <span className="readout text-2xs font-medium tabular-nums text-muted-foreground">{count}</span> : null}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="overview" className="mt-3">
          <OverviewTab detail={detail} permissions={permissions} actions={actions} onChanged={onChanged} />
        </TabsContent>
        <TabsContent value="members" className="mt-3">
          <MembersTab detail={detail} onChanged={onChanged} />
        </TabsContent>
        <TabsContent value="messages" className="mt-3">
          <MessagesTab detail={detail} permissions={permissions} />
        </TabsContent>
        <TabsContent value="analysis" className="mt-3">
          <GroupAnalysesPanel
            group={group}
            analyses={detail.analyses}
            onChanged={onChanged}
            onFollow={permissions.update ? () => void actions.follow() : undefined}
            followBusy={actions.busy !== null}
          />
        </TabsContent>
        <TabsContent value="campaigns" className="mt-3">
          <CampaignsTab detail={detail} campaigns={campaigns} />
        </TabsContent>
        <TabsContent value="settings" className="mt-3">
          <SettingsTab detail={detail} permissions={permissions} actions={actions} onChanged={onChanged} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
