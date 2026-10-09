import { describe, expect, it } from "vitest";

import { dealEventMessage, type OpportunityEvent } from "@/lib/crm/opportunities";

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
const labels = { removedStage: "etapa removida", money: (cents: number, currency: string) => `${currency} ${cents}` };

describe("dealEventMessage", () => {
  it("says who created the deal", () => {
    expect(dealEventMessage(event({ type: "created" }), "Agente de IA", stages, labels)).toEqual({
      key: "created",
      values: { actor: "Agente de IA", from: "etapa removida", to: "etapa removida", value: "BRL 0" },
    });
  });

  it("names both stages of a move", () => {
    expect(dealEventMessage(event({ type: "stage_moved", fromStageId: "st-new", toStageId: "st-won" }), "Ana", stages, labels).values).toMatchObject({
      from: "Novo",
      to: "Ganho",
    });
  });

  it("carries the value of a win in the deal's own currency", () => {
    expect(dealEventMessage(event({ type: "won", valueCents: 150050, currency: "USD" }), "Fluxo", stages, labels).values.value).toBe("USD 150050");
  });

  it("formats a deal without a currency as reais", () => {
    expect(dealEventMessage(event({ type: "value_changed", valueCents: 7900, currency: "" }), "Ana", stages, labels).values.value).toBe("BRL 7900");
  });

  it("falls back to a neutral stage name for a stage that no longer exists", () => {
    expect(dealEventMessage(event({ type: "stage_moved", fromStageId: "st-gone", toStageId: "st-new" }), "Ana", stages, labels).values.from).toBe("etapa removida");
  });

  it("keys every event by its own type", () => {
    for (const type of ["lost", "reopened", "owner_changed", "linked"] as const) {
      expect(dealEventMessage(event({ type }), "Ana", stages, labels).key).toBe(type);
    }
  });
});
