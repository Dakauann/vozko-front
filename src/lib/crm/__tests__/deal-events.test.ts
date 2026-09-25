import { describe, expect, it } from "vitest";

import { dealEventText, type OpportunityEvent } from "@/lib/crm/opportunities";

function event(overrides: Partial<OpportunityEvent>): OpportunityEvent {
  return {
    id: "ev-1",
    opportunityId: "deal-1",
    type: "created",
    actorId: "ai:agent-1",
    valueCents: 0,
    currency: "BRL",
    createdAt: "2026-09-25T14:00:00Z",
    ...overrides,
  };
}

const stages = new Map([["st-new", "Novo"], ["st-won", "Ganho"]]);

describe("dealEventText", () => {
  it("says who created the deal", () => {
    expect(dealEventText(event({ type: "created" }), "Agente de IA", stages)).toBe("Agente de IA criou o negócio");
  });

  it("names both stages of a move", () => {
    expect(
      dealEventText(event({ type: "stage_moved", fromStageId: "st-new", toStageId: "st-won" }), "Ana", stages),
    ).toBe("Ana moveu de Novo para Ganho");
  });

  it("carries the value of a win", () => {
    expect(dealEventText(event({ type: "won", valueCents: 150050 }), "Fluxo", stages)).toMatch(
      /^Fluxo marcou como ganho \(R\$\s1\.500,50\)$/,
    );
  });

  it("carries the new value of a value change", () => {
    expect(dealEventText(event({ type: "value_changed", valueCents: 7900 }), "Ana", stages)).toMatch(
      /^Ana alterou o valor para R\$\s79,00$/,
    );
  });

  it("falls back to a neutral stage name for a stage that no longer exists", () => {
    expect(
      dealEventText(event({ type: "stage_moved", fromStageId: "st-gone", toStageId: "st-new" }), "Ana", stages),
    ).toBe("Ana moveu de etapa removida para Novo");
  });

  it("describes the remaining events", () => {
    expect(dealEventText(event({ type: "lost" }), "Ana", stages)).toBe("Ana marcou como perdido");
    expect(dealEventText(event({ type: "reopened" }), "Ana", stages)).toBe("Ana reabriu o negócio");
    expect(dealEventText(event({ type: "owner_changed" }), "Ana", stages)).toBe("Ana trocou o responsável");
    expect(dealEventText(event({ type: "linked" }), "Ana", stages)).toBe("Ana vinculou uma conversa");
  });
});
