export type DelegationKind = "agent" | "workflow";

export interface DelegationTarget {
  kind: DelegationKind;
  id: string;
  name: string;
}

interface AgentLike {
  id: string;
  name: string;
  isActive: boolean;
}

interface WorkflowLike {
  id: string;
  name: string;
  status: string;
  type?: string;
}

export function delegationTargets(agents: AgentLike[], workflows: WorkflowLike[]): DelegationTarget[] {
  return [
    ...agents.filter((a) => a.isActive).map((a) => ({ kind: "agent" as const, id: a.id, name: a.name })),
    ...workflows
      .filter((w) => w.status === "active" && w.type !== "voice")
      .map((w) => ({ kind: "workflow" as const, id: w.id, name: w.name })),
  ];
}

export function ownerOf(target: DelegationTarget): string {
  return target.kind === "workflow" ? `workflow:${target.id}` : `ai:${target.id}`;
}
