import { describe, expect, it } from "vitest";

import {
  MERCADOLIVRE_MODERATION_REASONS,
  isFromMercadoLivreAgent,
  readMediaUnavailable,
  readModeration,
} from "@/lib/mercadolivre/message-metadata";

const moderation = (value: unknown) => ({ mercadolivre_moderation: value });

describe("readModeration", () => {
  it("says nothing about an available message or a message without the key", () => {
    expect(readModeration(moderation({ status: "available" }))).toBeNull();
    expect(readModeration({})).toBeNull();
    expect(readModeration(null)).toBeNull();
    expect(readModeration(undefined)).toBeNull();
  });

  it("marks a message Mercado Livre is still reviewing", () => {
    expect(readModeration(moderation({ status: "pending_review" }))).toEqual({ state: "pending_review", reason: null });
  });

  it("marks a message waiting for translation", () => {
    expect(readModeration(moderation({ status: "pending_translation" }))).toEqual({ state: "pending_translation", reason: null });
  });

  it("marks moderated and rejected messages as blocked, with the reason", () => {
    expect(readModeration(moderation({ status: "moderated", reason: "SOCIAL_NETWORK_LINK" }))).toEqual({
      state: "blocked",
      reason: "SOCIAL_NETWORK_LINK",
    });
    expect(readModeration(moderation({ status: "rejected", reason: "AUTOMATIC_MESSAGE" }))).toEqual({
      state: "blocked",
      reason: "AUTOMATIC_MESSAGE",
    });
  });

  it("treats a rejected moderation as blocked even when the message status says available", () => {
    expect(readModeration(moderation({ status: "available", moderation: "REJECTED", reason: "PERSONAL_DATA" }))).toEqual({
      state: "blocked",
      reason: "PERSONAL_DATA",
    });
  });

  it("knows every documented reason", () => {
    expect(MERCADOLIVRE_MODERATION_REASONS).toEqual([
      "OUT_OF_PLACE_LANGUAGE",
      "SOCIAL_NETWORK_LINK",
      "LINK_SHORT_URL",
      "AUTOMATIC_MESSAGE",
      "PERSONAL_DATA",
      "LINK_MERCADOPAGO",
      "ML_LINKS_PAYPAL",
      "EVASION_CLAIM_SELLER",
    ]);
    for (const reason of MERCADOLIVRE_MODERATION_REASONS) {
      expect(readModeration(moderation({ status: "rejected", reason }))?.reason).toBe(reason);
    }
  });

  it("falls back to the unknown reason for a reason it does not know", () => {
    expect(readModeration(moderation({ status: "moderated", reason: "NEW_RULE" }))).toEqual({ state: "blocked", reason: "unknown" });
    expect(readModeration(moderation({ status: "moderated" }))).toEqual({ state: "blocked", reason: "unknown" });
  });

  it("never reads an unknown status as delivered", () => {
    expect(readModeration(moderation({ status: "on_hold" }))).toEqual({ state: "unknown", reason: null });
    expect(readModeration(moderation({}))).toEqual({ state: "unknown", reason: null });
    expect(readModeration(moderation("rejected"))).toEqual({ state: "unknown", reason: null });
  });
});

describe("isFromMercadoLivreAgent", () => {
  it("is true only for the explicit flag", () => {
    expect(isFromMercadoLivreAgent({ mercadolivre_from_agent: true })).toBe(true);
    expect(isFromMercadoLivreAgent({ mercadolivre_from_agent: "true" })).toBe(false);
    expect(isFromMercadoLivreAgent({})).toBe(false);
    expect(isFromMercadoLivreAgent(null)).toBe(false);
  });
});

describe("readMediaUnavailable", () => {
  it("reads the flag and the original file name", () => {
    expect(readMediaUnavailable({ mercadolivre_media_unavailable: true, mercadolivre_file_name: "nota.pdf" })).toEqual({ fileName: "nota.pdf" });
    expect(readMediaUnavailable({ mercadolivre_media_unavailable: true })).toEqual({ fileName: null });
  });

  it("is null without the flag", () => {
    expect(readMediaUnavailable({ mercadolivre_file_name: "nota.pdf" })).toBeNull();
    expect(readMediaUnavailable(undefined)).toBeNull();
  });
});
