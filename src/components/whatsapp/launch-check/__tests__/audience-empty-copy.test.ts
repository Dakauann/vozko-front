import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";

describe("empty audience copy", () => {
  it.each([["pt", pt], ["en", en], ["es", es], ["de", de]])("tells %s readers a campaign without contacts apart from one already sent", (_locale, messages) => {
    const codes = messages.launchCheck.codes;
    expect(codes.audience_empty.title).not.toEqual(codes.nothing_pending.title);
    expect(codes.audience_empty.description).not.toEqual(codes.nothing_pending.description);
  });
});
