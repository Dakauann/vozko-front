"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { CircleNotch, TrendUp } from "@phosphor-icons/react";

import OpportunityDrawer from "@/components/crm/OpportunityDrawer";
import { listPipelinesAction } from "@/app/actions/crm-board";
import { getOpportunityBoardAction } from "@/app/actions/opportunities";
import { listCustomFieldsAction } from "@/app/actions/custom-fields";
import type { OpportunityColumn } from "@/lib/crm/opportunities";
import type { CustomFieldDefinition } from "@/lib/crm/custom-fields";
import { cn } from "@/lib/utils";

interface CreateOpportunityButtonProps {
  entryId: string;
  entryType: string;
  leadName?: string;
  workspaceId?: string;
  className?: string;
}

// "Criar oportunidade" from a conversation: loads the sales pipeline + custom fields,
// then OPENS the deal drawer pre-filled (lead as title, this chat linked) so the user
// can fill value, owner, close date and any required custom fields before saving.
export default function CreateOpportunityButton({
  entryId,
  entryType,
  leadName,
  workspaceId,
  className,
}: CreateOpportunityButtonProps) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [pipelineId, setPipelineId] = useState("");
  const [columns, setColumns] = useState<OpportunityColumn[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);

  const handleClick = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const [{ pipelines }, { board }, { fields }] = await Promise.all([
        listPipelinesAction("opportunity"),
        getOpportunityBoardAction({ groupBy: "stage" }),
        listCustomFieldsAction("opportunity"),
      ]);
      const pipeline = pipelines.find((p) => p.isDefault) ?? pipelines[0];
      if (!pipeline || !board?.columns?.length) {
        toast.error("Não foi possível abrir o funil de vendas.");
        return;
      }
      setPipelineId(pipeline.id);
      setColumns(board.columns);
      setCustomFields(fields);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        title="Criar oportunidade a partir desta conversa"
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:border-border hover:bg-muted disabled:opacity-60",
          className,
        )}
      >
        {loading ? (
          <CircleNotch weight="bold" className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <TrendUp weight="bold" className="h-3.5 w-3.5" />
        )}
        <span className="hidden sm:inline">Criar oportunidade</span>
      </button>

      <OpportunityDrawer
        open={open}
        onOpenChange={setOpen}
        opportunity={null}
        pipelineId={pipelineId}
        columns={columns}
        customFields={customFields}
        workspaceId={workspaceId}
        defaultTitle={leadName}
        linkEntryId={entryId}
        linkEntryType={entryType}
        onSaved={() =>
          toast.success("Oportunidade criada e vinculada à conversa.", {
            action: {
              label: "Ver no funil",
              onClick: () => {
                window.location.href = "/dashboard/sales";
              },
            },
          })
        }
      />
    </>
  );
}
