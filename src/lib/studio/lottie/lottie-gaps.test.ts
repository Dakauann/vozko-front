import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";

import { LOTTIE_GAP_CODES, LottieGaps } from "./lottie-gaps";

describe("Lottie gaps", () => {
  it("explains every gap in the four languages of the editor", () => {
    for (const messages of [pt, en, es, de]) {
      const texts = messages.studio.lottie.gaps as Record<string, string>;
      expect(LOTTIE_GAP_CODES.filter((code) => typeof texts[code] !== "string" || texts[code].trim() === "")).toEqual([]);
    }
  });

  it("lists each gap once per place", () => {
    const gaps = new LottieGaps();
    gaps.add("text", "Título");
    gaps.add("text", "Título");
    gaps.add("text", "Outro");
    expect(gaps.list).toEqual([
      { code: "text", where: "Título" },
      { code: "text", where: "Outro" },
    ]);
  });
});
