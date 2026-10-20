import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";

import {
  closeProvenanceText,
  conversationStatusText,
  getConversationStatusDisplay,
  resolveCloseProvenance,
  type StatusTranslator,
} from "./close-provenance";

function translator(locale: string, messages: unknown): StatusTranslator {
  return createTranslator({ locale, messages, namespace: "conversationStatus" } as never) as unknown as StatusTranslator;
}

const tPt = translator("pt", pt);

describe("resolveCloseProvenance", () => {
  it("maps system idle as silence", () => {
    const p = resolveCloseProvenance("system", "customer_idle");
    expect(p?.kind).toBe("silence");
    expect(p?.isSilence).toBe(true);
  });

  it("maps max_age as inactivity not silence", () => {
    const p = resolveCloseProvenance("system", "max_age");
    expect(p?.kind).toBe("max_age");
    expect(p?.isSilence).toBe(false);
    expect(p?.reason).toBe("max_age");
  });

  it("maps human manual", () => {
    expect(resolveCloseProvenance("human", "manual")?.kind).toBe("human");
  });

  it("maps ai resolved", () => {
    expect(resolveCloseProvenance("ai", "ai_resolved")?.kind).toBe("ai");
  });

  it("maps workflow finish", () => {
    const p = resolveCloseProvenance("system", "workflow");
    expect(p?.kind).toBe("workflow");
    expect(p?.reason).toBe("workflow");
    expect(p?.isSilence).toBe(false);
  });

  it("keeps an unknown source as raw data instead of guessing a label", () => {
    const p = resolveCloseProvenance("robot", "");
    expect(p?.kind).toBe("other");
    expect(closeProvenanceText(p!, tPt)).toEqual({ short: "robot", by: "robot", reason: "" });
  });

  it("returns null when empty", () => {
    expect(resolveCloseProvenance(null, null)).toBeNull();
  });
});

describe("getConversationStatusDisplay", () => {
  it("appends provenance on finished", () => {
    const d = getConversationStatusDisplay("finished", "system", "customer_idle");
    expect(conversationStatusText(d, tPt).label).toBe("Finalizada · silêncio");
    expect(d.dotClassName).toContain("amber");
  });

  it("labels max_age finished as inactivity with amber", () => {
    const d = getConversationStatusDisplay("finished", "system", "max_age");
    expect(conversationStatusText(d, tPt).label).toBe("Finalizada · inatividade");
    expect(d.dotClassName).toContain("amber");
    expect(d.provenance?.isSilence).toBe(false);
  });

  it("labels workflow finished with slate", () => {
    const d = getConversationStatusDisplay("finished", "system", "workflow");
    expect(conversationStatusText(d, tPt).label).toBe("Finalizada · fluxo");
    expect(d.dotClassName).toContain("slate");
  });

  it("keeps plain finished without provenance", () => {
    const d = getConversationStatusDisplay("finished", null, null);
    expect(conversationStatusText(d, tPt).label).toBe("Finalizada");
  });

  it("does not attach provenance on ongoing", () => {
    const d = getConversationStatusDisplay("ongoing", "human", "manual");
    expect(conversationStatusText(d, tPt).label).toBe("Em andamento");
    expect(d.provenance).toBeNull();
  });

  it("calls an unknown status new", () => {
    expect(conversationStatusText(getConversationStatusDisplay(undefined), tPt).baseLabel).toBe("Nova");
  });
});

describe("status text in every language", () => {
  const catalogs: [string, unknown][] = [["pt", pt], ["en", en], ["es", es], ["de", de]];

  it.each(catalogs)("has a real label for every status and provenance in %s", (locale, messages) => {
    const t = translator(locale, messages);
    for (const status of ["new", "ongoing", "finished"]) {
      const label = conversationStatusText(getConversationStatusDisplay(status === "new" ? null : status), t).label;
      expect(label).not.toMatch(/conversationStatus\./);
    }
    for (const [source, reason] of [["system", "max_age"], ["system", "workflow"], ["system", "customer_idle"], ["ai", "ai_resolved"], ["human", "manual"]]) {
      const text = closeProvenanceText(resolveCloseProvenance(source, reason)!, t);
      for (const value of Object.values(text)) expect(value).not.toMatch(/conversationStatus\./);
    }
  });
});
