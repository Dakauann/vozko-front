import { describe, expect, it } from "vitest";

import {
  MERCADOLIVRE_ANSWER_LIMIT,
  QUESTION_STATUS_FILTERS,
  answeredByKey,
  durationParts,
  listingStatusKey,
  listingStatusTone,
  questionIsOpen,
  questionStatusKey,
  questionStatusTone,
  responseTimeSlots,
} from "@/lib/mercadolivre/questions";
import { MERCADOLIVRE_QUESTION_STATUSES, type MercadoLivreQuestion } from "@/lib/mercadolivre/types";

function question(overrides: Partial<MercadoLivreQuestion> = {}): MercadoLivreQuestion {
  return {
    id: "q-1",
    accountId: "acc-1",
    itemId: "MLB1",
    questionId: "987",
    text: "Tem em azul?",
    status: "UNANSWERED",
    askedAt: "2026-10-19T10:00:00Z",
    suspectedSpam: false,
    ...overrides,
  };
}

describe("Mercado Livre questions", () => {
  it("caps an answer at 2,000 characters with no charset rule", () => {
    expect(MERCADOLIVRE_ANSWER_LIMIT).toEqual({ max: 2000, unit: "characters" });
  });

  it("names a copy key and a solid tone for every status the server sends", () => {
    for (const status of MERCADOLIVRE_QUESTION_STATUSES) {
      expect(questionStatusKey(status)).toBe(`status.${status}`);
      expect(questionStatusTone(status)).not.toBe("outline");
    }
    expect(questionStatusTone("UNANSWERED")).toBe("warning");
    expect(questionStatusTone("ANSWERED")).toBe("healthy");
    expect(questionStatusTone("BANNED")).toBe("fault");
  });

  it("refuses to guess a status it does not know", () => {
    expect(questionStatusKey("SOMETHING_NEW")).toBe("status.unknown");
    expect(questionStatusTone("SOMETHING_NEW")).toBe("muted");
    expect(questionIsOpen(question({ status: "SOMETHING_NEW" }))).toBe(false);
  });

  it("only takes an answer while the question waits for one", () => {
    expect(questionIsOpen(question())).toBe(true);
    for (const status of MERCADOLIVRE_QUESTION_STATUSES.filter((s) => s !== "UNANSWERED")) {
      expect(questionIsOpen(question({ status }))).toBe(false);
    }
  });

  it("says who answered, and nothing for an origin it does not know", () => {
    expect(answeredByKey("operator")).toBe("answeredBy.operator");
    expect(answeredByKey("rule")).toBe("answeredBy.rule");
    expect(answeredByKey("mercadolivre_app")).toBe("answeredBy.mercadolivre_app");
    expect(answeredByKey(undefined)).toBeNull();
    expect(answeredByKey("robot")).toBeNull();
  });

  it("filters by every status a seller acts on, unanswered first", () => {
    expect(QUESTION_STATUS_FILTERS[0]).toBe("all");
    expect(QUESTION_STATUS_FILTERS[1]).toBe("UNANSWERED");
    for (const filter of QUESTION_STATUS_FILTERS.slice(1)) {
      expect(MERCADOLIVRE_QUESTION_STATUSES as readonly string[]).toContain(filter);
    }
  });

  it("lists the measured response time slots in a fixed order and skips the missing ones", () => {
    expect(responseTimeSlots({ available: false })).toEqual([]);
    expect(
      responseTimeSlots({ available: true, weekend: { minutes: 300 }, total: { minutes: 45, salesPercentIncrease: 12 } }),
    ).toEqual([
      { key: "total", minutes: 45, salesPercentIncrease: 12 },
      { key: "weekend", minutes: 300, salesPercentIncrease: undefined },
    ]);
  });

  it("splits a duration into days, hours and minutes", () => {
    expect(durationParts(45)).toEqual({ days: 0, hours: 0, minutes: 45 });
    expect(durationParts(135)).toEqual({ days: 0, hours: 2, minutes: 15 });
    expect(durationParts(1500)).toEqual({ days: 1, hours: 1, minutes: 0 });
  });

  it("names the listing status, and a neutral key for one it does not know", () => {
    expect(listingStatusKey("active")).toBe("listingStatus.active");
    expect(listingStatusKey("closed")).toBe("listingStatus.closed");
    expect(listingStatusKey("under_review")).toBe("listingStatus.unknown");
  });

  it("marks only an active listing as healthy", () => {
    expect(listingStatusTone("active")).toBe("healthy");
    expect(listingStatusTone("paused")).toBe("warning");
    expect(listingStatusTone("closed")).toBe("muted");
    expect(listingStatusTone("under_review")).toBe("muted");
  });
});
