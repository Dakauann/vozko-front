"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { getGroupsDashboardAction } from "@/app/actions/unofficial-whatsapp-groups";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import { ArrowClockwise, ChartBar, Lightbulb, MagnifyingGlass, Plus, SignIn, UsersFour, UsersThree } from "@/components/icons";
import { GLYPH_PLATE } from "@/components/icons/glyph-plates";
import { Notice } from "@/components/ui/notice";
import {
  ResponsePanel,
  SentimentByGroupPanel,
  SentimentPanel,
  TopGroupsPanel,
  VolumePanel,
} from "@/components/unofficial-whatsapp-groups/dashboard/activity-panels";
import { AttentionPanel } from "@/components/unofficial-whatsapp-groups/dashboard/attention-panel";
import { CategoriesPanel } from "@/components/unofficial-whatsapp-groups/dashboard/categories-panel";
import { greetingName, hasNoGroups, normalizeDashboard } from "@/components/unofficial-whatsapp-groups/dashboard/dashboard-data";
import { InsightsPanel } from "@/components/unofficial-whatsapp-groups/dashboard/insights-panel";
import { FlowPanel, TopGrowingPanel } from "@/components/unofficial-whatsapp-groups/dashboard/members-panels";
import { MembershipTable } from "@/components/unofficial-whatsapp-groups/dashboard/membership-table";
import { NoGroupsYet } from "@/components/unofficial-whatsapp-groups/dashboard/no-groups-yet";
import { INSIGHTS_ANCHOR, OverviewKpis } from "@/components/unofficial-whatsapp-groups/dashboard/overview-kpis";
import { CrossGroupPeoplePanel } from "@/components/unofficial-whatsapp-groups/dashboard/people-panel";
import { ThemesPanel } from "@/components/unofficial-whatsapp-groups/dashboard/themes-panel";
import { useFollowedGroups, useGroupJoins } from "@/components/unofficial-whatsapp-groups/dashboard/use-dashboard-sources";
import { CountChip } from "@/components/unofficial-whatsapp-groups/kit/filters";
import { GroupsChapter, WindowLabel } from "@/components/unofficial-whatsapp-groups/kit/panel";
import { groupsRoutes } from "@/components/unofficial-whatsapp-groups/kit/routes";
import { useAuth } from "@/contexts/auth-context";
import { useWorkspace } from "@/contexts/workspace-context";
import type { GroupsDashboard } from "@/lib/unofficial-whatsapp-groups/types";
import { cn } from "@/lib/utils";

const ROW = "grid gap-3 lg:grid-cols-2 xl:grid-cols-12";
const SHORT_WINDOW_DAYS = 7;
const LONG_WINDOW_DAYS = 30;

export default function UnofficialWhatsAppGroupsDashboardPage() {
  const t = useTranslations("unofficialGroups.dashboard");
  const { can } = useWorkspace();
  const { user } = useAuth();
  const canCreate = can("unofficial_whatsapp_groups", "create");
  const canUpdate = can("unofficial_whatsapp_groups", "update");
  const canConnect = can("unofficial_whatsapp_instances", "create");

  const [dashboard, setDashboard] = useState<GroupsDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState(-1);
  const loaded = useRef(false);
  const loading = settled !== attempt;
  const reload = useCallback(() => setAttempt((current) => current + 1), []);

  useEffect(() => {
    let cancelled = false;
    void getGroupsDashboardAction().then((result) => {
      if (cancelled) return;
      if (result.error || !result.data) {
        if (loaded.current) toast.error(t("error.title"), { description: result.error });
        else setError(result.error ?? t("error.description"));
      } else {
        loaded.current = true;
        setError(null);
        setDashboard(normalizeDashboard(result.data));
      }
      setSettled(attempt);
    });
    return () => {
      cancelled = true;
    };
  }, [attempt, t]);

  const firstName = greetingName(user?.name);
  const timezone = dashboard?.timezone ?? "";

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      {canUpdate ? (
        <Button
          variant="secondary"
          link={groupsRoutes.all({ action: "discover" })}
          newTab={false}
          title={t("header.discover")}
          icon={<MagnifyingGlass className="h-4 w-4" weight="bold" />}
          iconVisible
          iconSide="left"
        />
      ) : null}
      {canCreate ? (
        <>
          <Button
            variant="secondary"
            link={groupsRoutes.all({ action: "join" })}
            newTab={false}
            title={t("actions.join")}
            icon={<SignIn className="h-4 w-4" weight="bold" />}
            iconVisible
            iconSide="left"
          />
          <Button
            variant="primary"
            link={groupsRoutes.all({ action: "create" })}
            newTab={false}
            title={t("header.create")}
            icon={<Plus className="h-4 w-4" weight="bold" />}
            iconVisible
            iconSide="left"
          />
        </>
      ) : null}
      <Button
        variant="command"
        aria-label={t("actions.refresh")}
        title=""
        icon={<ArrowClockwise className={cn("h-4 w-4", loading && "animate-spin")} weight="bold" />}
        iconVisible
        onClick={reload}
        disabled={loading}
      />
    </div>
  );

  const meta = dashboard ? (
    <span className="flex flex-wrap items-center gap-2">
      <CountChip count={dashboard.groups.followed} noun={(count) => t("header.followedChip", { count })} />
      {timezone ? <span className="readout text-2xs text-muted-foreground">{t("header.timezone", { timezone })}</span> : null}
    </span>
  ) : undefined;

  return (
    <div className="w-full space-y-6">
      <DashboardPageHeader
        icon={<UsersThree className="h-6 w-6" />}
        badge={t("header.title")}
        description={firstName ? t("header.greeting", { name: firstName }) : t("header.description")}
        meta={meta}
        actions={actions}
      />

      {!dashboard && error ? (
        <Notice tone="fault" title={t("error.title")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>{error}</p>
            <Button variant="secondary" title={t("error.retry")} onClick={reload} disabled={loading} />
          </div>
        </Notice>
      ) : dashboard && hasNoGroups(dashboard) ? (
        <NoGroupsYet hasNumbers={dashboard.connections.total > 0} canDiscover={canUpdate} canCreate={canCreate} canConnect={canConnect} />
      ) : (
        <DashboardBody dashboard={dashboard} refreshKey={attempt} />
      )}
    </div>
  );
}

function DashboardBody({ dashboard, refreshKey }: { dashboard: GroupsDashboard | null; refreshKey: number }) {
  const t = useTranslations("unofficialGroups.dashboard.chapters");
  const { can } = useWorkspace();
  const followed = useFollowedGroups(refreshKey);
  const joins = useGroupJoins(refreshKey);
  const pending = dashboard === null;
  const timezone = dashboard?.timezone ?? "";
  const d = dashboard;

  return (
    <div className="space-y-6">
      <OverviewKpis dashboard={dashboard} />

      <GroupsChapter
        id="groups-activity"
        icon={<ChartBar className="h-4 w-4" weight="fill" />}
        plate={GLYPH_PLATE.ChartBar}
        title={t("activity")}
        subtitle={t("activitySub")}
        meta={timezone ? <WindowLabel days={SHORT_WINDOW_DAYS} timezone={timezone} /> : null}
      >
        <div className={ROW}>
          <VolumePanel points={d?.dailyVolume ?? []} timezone={timezone} loading={pending} className="lg:col-span-2 xl:col-span-6" />
          <SentimentPanel tally={d?.sentiment ?? { positive: 0, neutral: 0, negative: 0 }} loading={pending} className="xl:col-span-3" />
          <AttentionPanel
            rows={followed.rows}
            meta={followed.meta}
            joins={joins}
            connections={d?.connections ?? null}
            loading={followed.loading}
            error={followed.error}
            onRetry={followed.retry}
            className="xl:col-span-3"
          />
        </div>
        <div className={cn(ROW, "items-start")}>
          <SentimentByGroupPanel groups={d?.sentimentByGroup ?? []} loading={pending} className="lg:col-span-2 xl:col-span-6" />
          <TopGroupsPanel groups={d?.topGroups ?? []} points={d?.dailyVolume ?? []} loading={pending} className="xl:col-span-3" />
          <ResponsePanel points={d?.responseTime ?? []} timezone={timezone} loading={pending} className="xl:col-span-3" />
        </div>
      </GroupsChapter>

      <GroupsChapter
        id="groups-members"
        icon={<UsersThree className="h-4 w-4" weight="fill" />}
        plate={GLYPH_PLATE.UsersThree}
        title={t("members")}
        subtitle={t("membersSub")}
        meta={timezone ? <WindowLabel days={LONG_WINDOW_DAYS} timezone={timezone} /> : null}
      >
        <div className={ROW}>
          <FlowPanel points={d?.growth ?? []} loading={pending} className="lg:col-span-2 xl:col-span-8" />
          <TopGrowingPanel groups={d?.topGrowing ?? []} loading={pending} className="lg:col-span-2 xl:col-span-4" />
        </div>
        <MembershipTable categories={d?.groups.categories ?? []} timezone={timezone} refreshKey={refreshKey} />
      </GroupsChapter>

      <div id={INSIGHTS_ANCHOR} className="scroll-mt-16">
        <GroupsChapter
          id="groups-insights"
          icon={<Lightbulb className="h-4 w-4" weight="fill" />}
          plate={GLYPH_PLATE.Lightbulb}
          title={t("intelligence")} subtitle={t("intelligenceSub")}>
          <div className={cn(ROW, "items-start")}>
            <InsightsPanel
              insights={d?.insights ?? []}
              groupsById={followed.groupsById}
              timezone={timezone}
              loading={pending}
              canConfigure={can("unofficial_whatsapp_groups", "configure")}
              className="lg:col-span-2 xl:col-span-7"
            />
            <ThemesPanel timezone={timezone} refreshKey={refreshKey} className="lg:col-span-2 xl:col-span-5" />
          </div>
        </GroupsChapter>
      </div>

      <GroupsChapter
        id="groups-people"
        icon={<UsersFour className="h-4 w-4" weight="fill" />}
        plate="tile-4"
        title={t("peopleCategories")}
        subtitle={t("peopleCategoriesSub")}
      >
        <div className={cn(ROW, "items-start")}>
          <CrossGroupPeoplePanel
            people={d?.crossGroupPeople ?? []}
            total={d?.crossGroupTotal ?? 0}
            pending={pending}
            canOpenLeads={can("leads", "read")}
            refreshKey={refreshKey}
            className="lg:col-span-2 xl:col-span-8"
          />
          <CategoriesPanel categories={d?.groups.categories ?? []} loading={pending} className="lg:col-span-2 xl:col-span-4" />
        </div>
      </GroupsChapter>
    </div>
  );
}
