import { listWorkflowsAction } from "@/app/actions/workflows";
import { listPipelines } from "@/lib/crm/pipelines";
import { fetchDepartments } from "@/lib/department/client";
import { AGENT_CALL_TRIGGER } from "@/lib/workflows/agent-call";
import { workflowOptionLabel } from "@/lib/workflows/publication";

export interface ToolOption {
  value: string;
  label: string;
}

const AGENT_WORKFLOWS_PAGE_SIZE = 100;

const loaders: Record<string, () => Promise<ToolOption[]>> = {
  departments: async () => {
    const res = await fetchDepartments();
    return res.departments.map((d) => ({ value: d.id, label: d.name }));
  },
  opportunity_pipelines: async () => {
    const res = await listPipelines("opportunity");
    return (res.data ?? []).map((p) => ({ value: p.id, label: p.name }));
  },
  agent_workflows: async () => {
    const res = await listWorkflowsAction({
      status: "active",
      type: "messages",
      triggerType: AGENT_CALL_TRIGGER,
      pageSize: AGENT_WORKFLOWS_PAGE_SIZE,
    });
    if (res.error) throw new Error(res.error);
    return res.workflows.map((w) => ({ value: w.id, label: workflowOptionLabel(w) }));
  },
};

export async function loadToolOptions(source: string): Promise<ToolOption[] | null> {
  const load = loaders[source];
  return load ? load() : null;
}

export function toggleChoice(current: unknown, value: string, order: string[]): string[] {
  const chosen = new Set(Array.isArray(current) ? current.map(String) : []);
  if (chosen.has(value)) chosen.delete(value);
  else chosen.add(value);
  return order.filter((option) => chosen.has(option));
}
