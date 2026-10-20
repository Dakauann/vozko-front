"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { listCallListsAction } from "@/app/actions/call-lists";
import { listDelegationTargetsAction } from "@/app/actions/conversations";
import { listPipelinesAction } from "@/app/actions/crm-board";
import { listStagesAction } from "@/app/actions/stages";
import { listWorkflowsAction } from "@/app/actions/workflows";
import { useDepartment } from "@/contexts/department-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { memberDisplayName, useAssignableMembers } from "@/hooks/use-assignable-members";
import { useLeadFieldDefinitions } from "@/hooks/use-lead-field-definitions";

export interface ParamOption {
  value: string;
  label: string;
  description?: string;
}

export interface ParamOptions {
  options: ParamOption[];
  loading: boolean;
  failed: boolean;
}

interface LeadSelectField {
  key: string;
  label: string;
  options: string[];
}

const PICKER_PAGE_SIZE = 100;
const OPTIONS_STALE_MS = 60_000;

export const TEAM_PREFIX = "team:";
export const MEMBER_PREFIX = "user:";
export const AGENT_PREFIX = "agent:";
export const FLOW_PREFIX = "flow:";

function useOptionsQuery(name: string, enabled: boolean, load: () => Promise<ParamOption[]>, extra: string = ""): ParamOptions {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const query = useQuery({
    queryKey: ["button-action-options", workspaceId, name, extra],
    queryFn: load,
    enabled: enabled && workspaceId !== "",
    staleTime: OPTIONS_STALE_MS,
    retry: false,
    refetchOnWindowFocus: false,
  });
  return { options: query.data ?? [], loading: enabled && query.isPending, failed: query.isError };
}

export function useHandOffOptions(enabled: boolean): ParamOptions {
  const { departments } = useDepartment();
  const members = useAssignableMembers(enabled);
  const options = useMemo(
    () => [
      ...departments.filter((department) => department.id).map((department) => ({ value: `${TEAM_PREFIX}${department.id}`, label: department.name })),
      ...members.members.map((member) => ({ value: `${MEMBER_PREFIX}${member.userId}`, label: memberDisplayName(member) })),
    ],
    [departments, members.members],
  );
  return { options, loading: members.pending, failed: members.failed };
}

export function useDelegateOptions(enabled: boolean): ParamOptions {
  return useOptionsQuery("delegates", enabled, async () => {
    const targets = await listDelegationTargetsAction("");
    return targets.map((target) => ({ value: `${target.kind === "agent" ? AGENT_PREFIX : FLOW_PREFIX}${target.id}`, label: target.name }));
  });
}

export function useWorkflowOptions(enabled: boolean): ParamOptions {
  return useOptionsQuery("workflows", enabled, async () => {
    const result = await listWorkflowsAction({ pageSize: PICKER_PAGE_SIZE });
    if (result.error) throw new Error(result.error);
    return result.workflows.map((workflow) => ({ value: workflow.id, label: workflow.name }));
  });
}

export function useCallListOptions(enabled: boolean): ParamOptions {
  return useOptionsQuery("call-lists", enabled, async () => {
    const result = await listCallListsAction({ page: 1, pageSize: PICKER_PAGE_SIZE });
    if (result.error) throw new Error(result.error.message ?? "call lists failed");
    return result.data.items.map((list) => ({ value: list.id, label: list.name }));
  });
}

export function useDealPipelineOptions(enabled: boolean): ParamOptions {
  return useOptionsQuery("deal-pipelines", enabled, async () => {
    const result = await listPipelinesAction("opportunity");
    if (result.error) throw new Error(result.error);
    return result.pipelines.map((pipeline) => ({ value: pipeline.id, label: pipeline.name }));
  });
}

export function useDealStageOptions(pipelineId: string): ParamOptions {
  return useOptionsQuery(
    "deal-stages",
    pipelineId !== "",
    async () => {
      const result = await listStagesAction(undefined, undefined, undefined, pipelineId);
      if (result.error) throw new Error(result.error);
      return result.stages.map((stage) => ({ value: stage.id, label: stage.name }));
    },
    pipelineId,
  );
}

export function useLeadSelectFields(enabled: boolean): { fields: LeadSelectField[]; loading: boolean; failed: boolean } {
  const definitions = useLeadFieldDefinitions(enabled);
  const fields = useMemo(
    () =>
      definitions.definitions
        .filter((definition) => definition.type === "select")
        .map((definition) => ({ key: definition.key, label: definition.label, options: definition.options ?? [] })),
    [definitions.definitions],
  );
  return { fields, loading: enabled && definitions.loading, failed: definitions.failed };
}
