"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { BellSlash, Brain, ClockCounterClockwise, Family, Handshake, IdentificationCard, Megaphone, Prohibit, Users } from "@/components/icons";
import { ScreenLoader } from "@/components/brand/screen-loader";
import LeadMemoriesSection from "@/components/crm/LeadMemoriesSection";
import { CustomFieldValue } from "@/components/crm/CustomFieldValue";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { SectionError } from "@/components/dashboard/attendance/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/elevated-design/elevated-tabs";
import Button from "@/components/elevated-design/button";
import { LeadCallButton } from "@/components/leads/LeadCall";
import { LeadSendButton } from "@/components/leads/sends/LeadSendButton";
import { OwnerChip } from "@/components/leads/OwnerChip";
import { LeadSheet } from "@/components/leads/sheet/LeadSheet";
import { rowsNeedMemberDirectory } from "@/components/leads/use-lead-columns";
import { useWorkspace } from "@/contexts/workspace-context";
import { useLeadChangeRefetch } from "@/hooks/use-lead-change-refetch";
import { useLeadPresentation } from "@/hooks/use-lead-presentation";
import { forgetLeadQueries, isMissingSection, useLeadDetail, useLeadSummary } from "@/hooks/use-lead-records";
import { isBusySectionError } from "@/lib/analytics/section-query";
import type { CustomFieldDefinition } from "@/lib/crm/custom-fields";
import { areaParts, primaryAddress, withRecord } from "@/lib/leads/detail";
import { leadFirstName, leadNameLines } from "@/lib/leads/display";
import type { LeadDetail as LeadDetailRecord } from "@/lib/leads/types";

import { LeadCampaignsTab } from "./LeadCampaignsTab";
import { LeadDealCreation } from "./LeadDealDrawer";
import { LeadDealsTab } from "./LeadDealsTab";
import { LeadDetailActions } from "./LeadDetailActions";
import { LeadFamilyTab } from "./LeadFamilyTab";
import { LeadOverview } from "./LeadOverview";
import { LeadTimelineTab } from "./LeadTimelineTab";

export const LEAD_DETAIL_TABS = ["overview", "family", "timeline", "deals", "memories", "campaigns"] as const;

export type LeadDetailTab = (typeof LEAD_DETAIL_TABS)[number];

function tabOf(value: string | undefined): LeadDetailTab {
  return (LEAD_DETAIL_TABS as readonly string[]).includes(value ?? "") ? (value as LeadDetailTab) : "overview";
}

const LEADS_PATH = "/dashboard/leads";

function TabCount({ count }: { count: number | undefined }) {
  return count && count > 0 ? <span className="text-xs tabular-nums text-muted-foreground">{count}</span> : null;
}

function HeaderMeta({
  lead,
  ownerName,
  classificationDefinition,
}: {
  lead: LeadDetailRecord;
  ownerName: string | null;
  classificationDefinition: CustomFieldDefinition | undefined;
}) {
  const t = useTranslations("leadDetail");
  const classificationValue = classificationDefinition ? lead.customFields?.[classificationDefinition.key] : undefined;
  return (
    <>
      {classificationDefinition && classificationValue !== undefined ? (
        <CustomFieldValue field={classificationDefinition} value={classificationValue} />
      ) : null}
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        {ownerName ? <OwnerChip name={ownerName}>{t("owner", { name: ownerName })}</OwnerChip> : t("noOwner")}
      </span>
      {lead.blocked ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-2xs font-semibold text-destructive-foreground">
          <Prohibit className="h-3 w-3" weight="bold" aria-hidden />
          {t("blocked")}
        </span>
      ) : null}
      {lead.optedOutAt ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-2xs font-semibold text-foreground">
          <BellSlash className="h-3 w-3" aria-hidden />
          {t("optedOut")}
        </span>
      ) : null}
    </>
  );
}

function Unavailable({ missing, busy, retrying, onRetry, onBack }: { missing: boolean; busy: boolean; retrying: boolean; onRetry: () => void; onBack: () => void }) {
  const t = useTranslations("leadDetail");
  return (
    <main className="w-full space-y-4">
      <DashboardPageHeader icon={<Users className="h-6 w-6" weight="fill" />} badge={t("back")} description="" back={{ onClick: onBack, label: t("back") }} />
      {missing ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[--radius] border border-border bg-muted px-3 py-2 text-sm">
          <span className="text-foreground">{t("notFound")}</span>
          <Button variant="secondary" title={t("back")} onClick={onBack} />
        </div>
      ) : (
        <SectionError busy={busy} retrying={retrying} onRetry={onRetry} message={t("loadFailed")} />
      )}
    </main>
  );
}

export function LeadDetail({ leadId, initialTab }: { leadId: string; initialTab?: string }) {
  const t = useTranslations("leadDetail");
  const router = useRouter();
  const client = useQueryClient();
  const { can, currentWorkspace } = useWorkspace();
  const { query, update } = useLeadDetail(leadId);
  const summary = useLeadSummary(leadId);
  const [tab, setTab] = useState<LeadDetailTab>(() => tabOf(initialTab));
  const [sheetOpen, setSheetOpen] = useState(false);

  const readsAddresses = can("leads", "read_addresses");
  const permissions = {
    edit: can("leads", "update"),
    block: can("leads", "block"),
    anonymize: can("leads", "anonymize"),
    createDeals: can("conversations", "create"),
    editDeals: can("conversations", "update"),
  };

  const { fields, classification, ownerName } = useLeadPresentation(true, { directory: rowsNeedMemberDirectory(query.data ? [query.data] : []) });

  const backToList = useCallback(() => router.push(LEADS_PATH), [router]);

  const leaveAnonymized = useCallback(() => {
    forgetLeadQueries(client, currentWorkspace?.id ?? "", leadId);
    backToList();
  }, [client, currentWorkspace?.id, leadId, backToList]);

  const anonymizedElsewhere = useCallback(() => {
    toast.info(t("anonymizedElsewhere"));
    backToList();
  }, [t, backToList]);

  useLeadChangeRefetch(leadId, { version: query.data?.version, onAnonymized: anonymizedElsewhere });

  if (query.isPending) return <ScreenLoader fit="screen" />;

  if (query.isError || !query.data) {
    return (
      <Unavailable
        missing={isMissingSection(query.error)}
        busy={isBusySectionError(query.error)}
        retrying={query.isFetching}
        onRetry={() => void query.refetch()}
        onBack={backToList}
      />
    );
  }

  const lead = query.data;
  const lines = leadNameLines({ realName: lead.realName, number: lead.number });
  const identity = lines.detail.kind === "identity" ? lines.detail.text : lines.titleMono ? lines.title : t("noWhatsApp");
  const description = [identity, ...areaParts(primaryAddress(lead.addresses))].join(" · ");
  const openSheet = permissions.edit ? () => setSheetOpen(true) : undefined;
  const addAddress = permissions.edit && readsAddresses ? openSheet : undefined;
  const familyTotal = lead.relativesCount + lead.referredCount;

  return (
    <main className="w-full space-y-4">
      <DashboardPageHeader
        icon={<Users className="h-6 w-6" weight="fill" />}
        badge={t("back")}
        title={lines.title || t("unnamed")}
        description={description}
        back={{ onClick: backToList, label: t("back") }}
        meta={<HeaderMeta lead={lead} ownerName={ownerName(lead.owner, lead.ownerName)} classificationDefinition={classification} />}
        actions={
          <>
            <LeadSendButton leadId={lead.id} action="send_template" label={t("actions.sendTemplate")} />
            <LeadCallButton leadId={lead.id} revision={lead.version} />
            <LeadSendButton leadId={lead.id} action="send_unofficial" label={t("actions.sendMessage")} />
            {permissions.createDeals ? <LeadDealCreation leadId={lead.id} leadName={lead.realName ?? ""} /> : null}
            <LeadDetailActions
              lead={lead}
              permissions={permissions}
              onEdit={() => setSheetOpen(true)}
              onChange={update}
              onAnonymized={leaveAnonymized}
            />
          </>
        }
      />

      <Tabs value={tab} onValueChange={(value) => setTab(tabOf(value))} className="w-full">
        <TabsList>
          <TabsTrigger value="overview">
            <IdentificationCard className="h-4 w-4" aria-hidden />
            {t("tabs.overview")}
          </TabsTrigger>
          <TabsTrigger value="family">
            <Family className="h-4 w-4" aria-hidden />
            {t("tabs.family")}
            <TabCount count={familyTotal} />
          </TabsTrigger>
          <TabsTrigger value="timeline">
            <ClockCounterClockwise className="h-4 w-4" aria-hidden />
            {t("tabs.timeline")}
          </TabsTrigger>
          <TabsTrigger value="deals">
            <Handshake className="h-4 w-4" aria-hidden />
            {t("tabs.deals")}
            <TabCount count={summary.data?.dealsCount} />
          </TabsTrigger>
          <TabsTrigger value="memories">
            <Brain className="h-4 w-4" aria-hidden />
            {t("tabs.memories")}
            <TabCount count={summary.data?.memoriesCount} />
          </TabsTrigger>
          <TabsTrigger value="campaigns">
            <Megaphone className="h-4 w-4" aria-hidden />
            {t("tabs.campaigns")}
            <TabCount count={lead.totalCampaigns} />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <LeadOverview
            lead={lead}
            definitions={fields.definitions}
            definitionsLoading={fields.loading}
            definitionsFailed={fields.failed}
            readsAddresses={readsAddresses}
            onAddAddress={addAddress}
            summary={summary.data}
          />
        </TabsContent>
        <TabsContent value="family" className="mt-6">
          <LeadFamilyTab leadId={lead.id} total={familyTotal} onAdd={openSheet} />
        </TabsContent>
        <TabsContent value="timeline" className="mt-6">
          <LeadTimelineTab leadId={lead.id} leadName={leadFirstName(lines)} onAddMemory={permissions.edit ? () => setTab("memories") : undefined} />
        </TabsContent>
        <TabsContent value="deals" className="mt-6">
          <LeadDealsTab leadId={lead.id} leadName={lead.realName ?? ""} canCreate={permissions.createDeals} canEdit={permissions.editDeals} />
        </TabsContent>
        <TabsContent value="memories" className="mt-6">
          <LeadMemoriesSection leadId={lead.id} canManage={permissions.edit} />
        </TabsContent>
        <TabsContent value="campaigns" className="mt-6">
          <LeadCampaignsTab lead={lead} />
        </TabsContent>
      </Tabs>

      {permissions.edit ? (
        <LeadSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          leadId={lead.id}
          onSaved={(record) => update((detail) => withRecord(detail, record))}
        />
      ) : null}
    </main>
  );
}
