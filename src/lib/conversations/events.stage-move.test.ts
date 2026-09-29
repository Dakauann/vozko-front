import { describe, expect, it } from "vitest";

import { stageMoveLine } from "./events";

const certainty = (value: string) => `${value}% de certeza`;

describe("stageMoveLine", () => {
  it("names both stages of a move", () => {
    expect(stageMoveLine({ from_stage_name: "qualificando", stage_name: "agendado" }, certainty)).toBe("qualificando → agendado");
  });

  it("adds how sure the AI was", () => {
    expect(stageMoveLine({ from_stage_name: "qualificando", stage_name: "agendado", confidence: "93" }, certainty)).toBe(
      "qualificando → agendado · 93% de certeza",
    );
  });

  it("accepts the older to_stage_name key", () => {
    expect(stageMoveLine({ from_stage_name: "novo", to_stage_name: "agendado" }, certainty)).toBe("novo → agendado");
  });

  it("is not a move when a side is missing or unchanged", () => {
    expect(stageMoveLine({ stage_name: "agendado" }, certainty)).toBeNull();
    expect(stageMoveLine({ from_stage_name: "agendado", stage_name: "agendado" }, certainty)).toBeNull();
  });

  it("ignores a confidence that is not a percentage", () => {
    expect(stageMoveLine({ from_stage_name: "a", stage_name: "b", confidence: "high" }, certainty)).toBe("a → b");
  });
});
