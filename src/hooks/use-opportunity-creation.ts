"use client";

import { useCallback, useRef, useState } from "react";

import { listPipelinesAction } from "@/app/actions/crm-board";
import { listCustomFieldsAction } from "@/app/actions/custom-fields";
import { getOpportunityBoardAction } from "@/app/actions/opportunities";
import type { CustomFieldDefinition } from "@/lib/crm/custom-fields";
import type { Opportunity, OpportunityColumn } from "@/lib/crm/opportunities";

export interface OpportunitySetup {
  pipelineId: string;
  columns: OpportunityColumn[];
  customFields: CustomFieldDefinition[];
}

export async function loadOpportunitySetup(pipelineId?: string): Promise<OpportunitySetup | null> {
  const [{ pipelines, error: pipelinesError }, { fields, error: fieldsError }] = await Promise.all([
    listPipelinesAction("opportunity"),
    listCustomFieldsAction("opportunity"),
  ]);
  const pipeline = pipelineId
    ? pipelines.find((candidate) => candidate.id === pipelineId)
    : (pipelines.find((candidate) => candidate.isDefault) ?? pipelines[0]);
  if (pipelinesError || fieldsError || !pipeline) return null;
  const { board } = await getOpportunityBoardAction({ groupBy: "stage", pipelineId: pipeline.id, pageSize: 1 });
  if (!board?.columns?.length) return null;
  return { pipelineId: pipeline.id, columns: board.columns, customFields: fields };
}

export function useOpportunityDrawer() {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [setup, setSetup] = useState<OpportunitySetup | null>(null);
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const pending = useRef(false);

  const openOn = useCallback(async (target: Opportunity | null): Promise<boolean> => {
    if (pending.current) return false;
    pending.current = true;
    setLoading(true);
    try {
      const loaded = await loadOpportunitySetup(target?.pipelineId);
      if (!loaded) return false;
      setSetup(loaded);
      setOpportunity(target);
      setOpen(true);
      return true;
    } catch {
      return false;
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }, []);

  const start = useCallback(() => openOn(null), [openOn]);
  const edit = useCallback((target: Opportunity) => openOn(target), [openOn]);

  return { loading, open, setOpen, setup, opportunity, start, edit };
}

export const useOpportunityCreation = useOpportunityDrawer;
