import { describe, expect, it } from "vitest";
import {
  getConversationStatusDisplay,
  resolveCloseProvenance,
} from "./close-provenance";

describe("resolveCloseProvenance", () => {
  it("maps system idle as silence", () => {
    const p = resolveCloseProvenance("system", "customer_idle");
    expect(p?.short).toBe("silêncio");
    expect(p?.isSilence).toBe(true);
  });

  it("maps max_age as inactivity not silence", () => {
    const p = resolveCloseProvenance("system", "max_age");
    expect(p?.short).toBe("inatividade");
    expect(p?.isSilence).toBe(false);
    expect(p?.reason).toBe("max_age");
  });

  it("maps human manual", () => {
    const p = resolveCloseProvenance("human", "manual");
    expect(p?.short).toBe("atendente");
    expect(p?.isSilence).toBe(false);
  });

  it("maps ai resolved", () => {
    const p = resolveCloseProvenance("ai", "ai_resolved");
    expect(p?.short).toBe("IA");
  });

  it("maps workflow finish", () => {
    const p = resolveCloseProvenance("system", "workflow");
    expect(p?.short).toBe("fluxo");
    expect(p?.by).toBe("Workflow");
    expect(p?.reason).toBe("workflow");
    expect(p?.isSilence).toBe(false);
  });

  it("returns null when empty", () => {
    expect(resolveCloseProvenance(null, null)).toBeNull();
  });
});

describe("getConversationStatusDisplay", () => {
  it("appends provenance on finished", () => {
    const d = getConversationStatusDisplay("finished", "system", "customer_idle");
    expect(d.label).toBe("Finalizada · silêncio");
    expect(d.dotClassName).toContain("amber");
  });

  it("labels max_age finished as inactivity with amber", () => {
    const d = getConversationStatusDisplay("finished", "system", "max_age");
    expect(d.label).toBe("Finalizada · inatividade");
    expect(d.dotClassName).toContain("amber");
    expect(d.provenance?.isSilence).toBe(false);
  });

  it("labels workflow finished with slate", () => {
    const d = getConversationStatusDisplay("finished", "system", "workflow");
    expect(d.label).toBe("Finalizada · fluxo");
    expect(d.dotClassName).toContain("slate");
  });

  it("keeps plain finished without provenance", () => {
    const d = getConversationStatusDisplay("finished", null, null);
    expect(d.label).toBe("Finalizada");
  });

  it("does not attach provenance on ongoing", () => {
    const d = getConversationStatusDisplay("ongoing", "human", "manual");
    expect(d.label).toBe("Em andamento");
    expect(d.provenance).toBeNull();
  });
});
