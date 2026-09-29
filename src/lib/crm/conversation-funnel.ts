import type { FunnelStages } from "@/app/actions/stages";

export function conversationFunnel(funnels: FunnelStages[], stageId: string | null | undefined): FunnelStages | null {
  if (!stageId) return null;
  return funnels.find((funnel) => funnel.stages.some((stage) => stage.id === stageId)) ?? null;
}
