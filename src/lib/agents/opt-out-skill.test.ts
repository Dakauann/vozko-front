import { describe, expect, it } from "vitest";

import { OPT_OUT_SKILL, missingOptOutSkill } from "./opt-out-skill";

const optOut = { name: OPT_OUT_SKILL, displayName: "Parar de receber templates (opt-out)" };
const search = { name: "search_knowledge_base", displayName: "Buscar na base" };

describe("the opt-out skill note", () => {
  it("is the backend's record_opt_out tool", () => {
    expect(OPT_OUT_SKILL).toBe("record_opt_out");
  });

  it("points at the skill when the backend offers it and the agent has not selected it", () => {
    expect(missingOptOutSkill([search, optOut], [{ name: "search_knowledge_base" }])).toBe(optOut);
    expect(missingOptOutSkill([optOut], [])).toBe(optOut);
  });

  it("stays quiet once the agent has the skill", () => {
    expect(missingOptOutSkill([search, optOut], [{ name: OPT_OUT_SKILL }])).toBeNull();
  });

  it("stays quiet when this server does not offer the skill", () => {
    expect(missingOptOutSkill([search], [])).toBeNull();
  });
});
