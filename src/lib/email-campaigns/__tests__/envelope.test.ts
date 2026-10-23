import { describe, expect, it } from "vitest";

import { envelopeOfDraft, undoneEnvelope } from "../envelope";

describe("campaign envelope", () => {
  it("reads the subject and the preheader of a draft", () => {
    expect(envelopeOfDraft({ subject: "Oi", preheader: "Prévia" })).toEqual({ subject: "Oi", preheader: "Prévia" });
  });

  it("undoes what Elo changed and keeps what the person changed after her", () => {
    const previous = { subject: "Antes", preheader: "Prévia antes" };
    const applied = { subject: "Da Elo", preheader: "Prévia da Elo" };
    expect(undoneEnvelope(applied, applied, previous)).toEqual(previous);
    expect(undoneEnvelope(applied, { subject: "Dela", preheader: "Prévia da Elo" }, previous)).toEqual({ subject: "Dela", preheader: "Prévia antes" });
  });
});
