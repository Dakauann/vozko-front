import { describe, expect, it } from "vitest";

import { leadFirstName, leadNameLines } from "../display";

describe("leadNameLines", () => {
  it("shows the real name with the WhatsApp identity below in mono", () => {
    expect(leadNameLines({ realName: "Maria Souza", number: "5511900010142" })).toEqual({
      title: "Maria Souza",
      titleMono: false,
      detail: { kind: "identity", text: "+55 (11) 90001-0142" },
    });
  });

  it("shows the number as the title and says the name is missing when the stored name is the number", () => {
    expect(leadNameLines({ realName: "", number: "5511900047788" })).toEqual({
      title: "+55 (11) 90004-7788",
      titleMono: true,
      detail: { kind: "noName" },
    });
  });

  it.each(["5511900047788", "+55 (11) 90004-7788", " 55 11 90004 7788 "])("reads a name %j that is only the number as no name", (realName) => {
    expect(leadNameLines({ realName, number: "5511900047788" })).toEqual({
      title: "+55 (11) 90004-7788",
      titleMono: true,
      detail: { kind: "noName" },
    });
  });

  it("keeps a name that carries other digits than the number", () => {
    expect(leadNameLines({ realName: "5511900040000", number: "5511900047788" }).title).toBe("5511900040000");
  });

  it("says a relative has no WhatsApp", () => {
    expect(leadNameLines({ realName: "Bruna Souza", number: "" })).toEqual({
      title: "Bruna Souza",
      titleMono: false,
      detail: { kind: "noWhatsApp" },
    });
  });

  it("has nothing to show for a lead without name or number", () => {
    expect(leadNameLines({ number: "" })).toEqual({ title: "", titleMono: false, detail: { kind: "noWhatsApp" } });
  });
});

describe("leadFirstName", () => {
  it("takes the first word of the name the title shows", () => {
    expect(leadFirstName(leadNameLines({ realName: "  Maria Aparecida Souza ", number: "5511900010142" }))).toBe("Maria");
  });

  it("has no first name when the title is the number", () => {
    expect(leadFirstName(leadNameLines({ realName: "", number: "5511900010142" }))).toBe("");
  });

  it("has no first name without name or number", () => {
    expect(leadFirstName(leadNameLines({ number: "" }))).toBe("");
  });
});
