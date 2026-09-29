import { describe, expect, it } from "vitest";

import type { FunnelStages } from "@/app/actions/stages";
import type { Stage } from "@/lib/conversations/types";
import { conversationFunnel } from "../conversation-funnel";

function funnel(pipelineId: string, pipelineName: string, stageIds: string[], isDefault = false): FunnelStages {
  return {
    pipelineId,
    pipelineName,
    isDefault,
    position: 0,
    stages: stageIds.map((id) => ({ id, name: id }) as Stage),
  };
}

const FUNNELS = [
  funnel("atendimento", "Atendimento", ["recebido", "agendamento"], true),
  funnel("teste-jev", "Teste Jev", ["qualificando", "agendado"]),
];

describe("conversationFunnel", () => {
  it("finds the funnel of the conversation's current stage", () => {
    expect(conversationFunnel(FUNNELS, "agendado")?.pipelineName).toBe("Teste Jev");
  });

  it("has no funnel for a conversation without a stage", () => {
    expect(conversationFunnel(FUNNELS, undefined)).toBeNull();
    expect(conversationFunnel(FUNNELS, "")).toBeNull();
  });

  it("does not guess when the stage belongs to no known funnel", () => {
    expect(conversationFunnel(FUNNELS, "deleted-stage")).toBeNull();
  });
});
