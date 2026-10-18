"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import type { GroupDetail } from "@/lib/unofficial-whatsapp-groups/types";

import { NoAdminSeatNotice, SeriesConflictNotice, SetupWarningsNotice, type ConflictGroup } from "../kit/notices";
import { GroupsPanel } from "../kit/panel";
import { parseSetupSteps } from "../kit/routes";
import { DEFAULT_MEMBER_FILTERS, hasAdminSeat, outstandingSetupWarnings, setupWarningsFor, type MemberFilters } from "./detail-model";
import { ParticipantsManager } from "./participants-manager";
import { CategorySection, DangerZoneSection, NumbersSection, SeriesSection } from "./settings-side";
import { SETUP_TARGET } from "./settings-targets";
import { RulesSection, WhatsAppDataSection } from "./settings-whatsapp";
import { forgetSetupWarnings, recallSetupWarnings } from "./setup-warnings-store";
import type { GroupActions } from "./use-group-actions";
import type { GroupPermissions } from "./use-group-permissions";

export function SettingsTab({
  detail,
  permissions,
  actions,
  onChanged,
}: {
  detail: GroupDetail;
  permissions: GroupPermissions;
  actions: GroupActions;
  onChanged: () => void;
}) {
  const t = useTranslations("unofficialGroups.detail.settingsTab");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const setup = searchParams.get("setup");
  const { group, numbers } = detail;
  const steps = useMemo(() => parseSetupSteps(setup), [setup]);
  const warnings = useMemo(
    () => outstandingSetupWarnings(setupWarningsFor(steps, recallSetupWarnings(group.id)), group, numbers),
    [steps, group, numbers],
  );
  const settled = steps.length > 0 && warnings.length === 0;
  const canWrite = permissions.update || permissions.removeMembers;
  const [participantFilters, setParticipantFilters] = useState<MemberFilters>(DEFAULT_MEMBER_FILTERS);
  const [conflict, setConflict] = useState<ConflictGroup[] | null>(null);

  useEffect(() => {
    const first = steps[0];
    if (!first) return;
    const target = document.getElementById(SETUP_TARGET[first]);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.focus({ preventScroll: true });
  }, [steps]);

  useEffect(() => {
    if (!settled) return;
    forgetSetupWarnings(group.id);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("setup");
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }, [settled, group.id, searchParams, router, pathname]);

  return (
    <div className="space-y-3">
      {warnings.length > 0 ? <SetupWarningsNotice warnings={warnings} groupId={group.id} showSettingsLink={false} /> : null}
      {conflict ? <SeriesConflictNotice groups={conflict} /> : null}
      {canWrite && !hasAdminSeat(numbers) ? <NoAdminSeatNotice action="edit" /> : null}
      <div className="grid gap-3 xl:grid-cols-12">
        <div className="min-w-0 space-y-3 xl:col-span-8">
          {permissions.update ? <WhatsAppDataSection detail={detail} permissions={permissions} onChanged={onChanged} onConflict={setConflict} /> : null}
          {permissions.update ? <RulesSection detail={detail} onChanged={onChanged} onConflict={setConflict} /> : null}
          <section id={SETUP_TARGET.promote_numbers} tabIndex={-1} className="rounded-[--radius] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <GroupsPanel title={t("participants.title")} subtitle={t("participants.subtitle")}>
              <ParticipantsManager
                group={group}
                seats={detail.numbers}
                mode="manage"
                pageSize={20}
                counts={detail.members}
                filters={participantFilters}
                onFiltersChange={setParticipantFilters}
                onChanged={onChanged}
                hideAdminNotice
              />
            </GroupsPanel>
          </section>
        </div>
        <div className="min-w-0 space-y-3 xl:col-span-4">
          {permissions.update ? <CategorySection group={group} onChanged={onChanged} /> : null}
          {group.seriesId ? <SeriesSection detail={detail} permissions={permissions} actions={actions} /> : null}
          <NumbersSection detail={detail} canLeave={permissions.leave} onChanged={onChanged} />
          {permissions.leave && detail.numbers.length > 0 ? <DangerZoneSection detail={detail} /> : null}
        </div>
      </div>
    </div>
  );
}
