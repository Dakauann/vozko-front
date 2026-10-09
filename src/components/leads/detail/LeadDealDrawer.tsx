"use client";

import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Plus } from "@/components/icons";
import OpportunityDrawer from "@/components/crm/OpportunityDrawer";
import Button from "@/components/elevated-design/button";
import { useWorkspace } from "@/contexts/workspace-context";
import { refreshLeadDeals } from "@/hooks/use-lead-records";
import { useOpportunityDrawer } from "@/hooks/use-opportunity-creation";
import type { Opportunity } from "@/lib/crm/opportunities";

export function useLeadDealDrawer({ leadId, leadName }: { leadId: string; leadName: string }) {
  const t = useTranslations("leadDetail.deals");
  const tDrawer = useTranslations("opportunityDrawer");
  const client = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const drawer = useOpportunityDrawer();

  const refuseUnopened = (opened: boolean) => {
    if (!opened) toast.error(tDrawer("openFailed"));
  };

  const create = () => void drawer.start().then(refuseUnopened);
  const edit = (deal: Opportunity) => void drawer.edit(deal).then(refuseUnopened);

  const element = drawer.setup ? (
    <OpportunityDrawer
      open={drawer.open}
      onOpenChange={drawer.setOpen}
      opportunity={drawer.opportunity}
      pipelineId={drawer.setup.pipelineId}
      columns={drawer.setup.columns}
      customFields={drawer.setup.customFields}
      workspaceId={workspaceId}
      defaultTitle={leadName || undefined}
      heading={t("add")}
      leadId={leadId}
      onSaved={() => refreshLeadDeals(client, workspaceId, leadId)}
    />
  ) : null;

  return { loading: drawer.loading, create, edit, element };
}

export function NewLeadDealButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  const t = useTranslations("leadDetail.deals");
  return (
    <Button
      variant="secondary"
      size="sm"
      icon={<Plus className="h-3.5 w-3.5" weight="bold" />}
      iconVisible
      iconSide="left"
      title={loading ? t("opening") : t("add")}
      disabled={loading}
      onClick={onClick}
    />
  );
}

export function LeadDealCreation({ leadId, leadName }: { leadId: string; leadName: string }) {
  const deals = useLeadDealDrawer({ leadId, leadName });
  return (
    <>
      <NewLeadDealButton loading={deals.loading} onClick={deals.create} />
      {deals.element}
    </>
  );
}
