import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";
import { AI_ACTIONS, type AiBlockReason } from "@/lib/studio/ai-actions";

const LOCALES = { pt, en, es, de };
const REASONS: AiBlockReason[] = ["noElo", "locked", "loading", "running", "busy"];
const PROMPTS = ["eloRewrite", "eloTranslate", "eloShorten", "imageVariation"];
const VENDORS = /openai|openrouter|anthropic|claude|gpt|gemini|google|lyria|rembg|bria/i;

type Messages = Record<string, unknown>;

function section(messages: { studio: { aiActions: object } }, key: string): Messages {
  return (messages.studio.aiActions as unknown as Record<string, Messages>)[key];
}

describe("contextual AI action texts", () => {
  it.each(Object.entries(LOCALES))("names every action, cost, block reason and prompt in %s", (_, messages) => {
    expect(typeof messages.studio.aiActions.menu).toBe("string");
    expect(typeof messages.studio.aiActions.reference).toBe("string");
    expect(typeof messages.studio.image.jobs.errors.provider_busy).toBe("string");
    expect(typeof messages.studio.video.jobs.errors.provider_busy).toBe("string");
    for (const action of AI_ACTIONS) {
      expect(typeof section(messages, "items")[action.id], action.id).toBe("string");
      if (action.cost !== "elo") expect(typeof section(messages, "cost")[action.cost], action.cost).toBe("string");
    }
    for (const reason of REASONS) expect(typeof section(messages, "blocked")[reason], reason).toBe("string");
    for (const prompt of PROMPTS) expect(typeof section(messages, "prompts")[prompt], prompt).toBe("string");
    for (const key of ["design", "timeline", "span"]) expect(typeof section(messages, "context")[key], key).toBe("string");
  });

  it.each(Object.entries(LOCALES))("keeps the text Elo reads free of vendor names and dashes in %s", (_, messages) => {
    const text = JSON.stringify(messages.studio.aiActions);
    expect(text).not.toMatch(VENDORS);
    expect(text).not.toMatch(/[–—]/);
  });
});
