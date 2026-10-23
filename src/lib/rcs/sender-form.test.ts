import { describe, expect, it } from "vitest";

import { EMPTY_SENDER_INPUT, maskCnpj, senderInputOf, withSenderField } from "@/lib/rcs/sender-form";
import { senderFixture } from "@/lib/rcs/test-fixtures";

describe("maskCnpj", () => {
  it("shows the digits typed so far in the CNPJ layout", () => {
    expect(maskCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(maskCnpj("11.222.333/0001-81")).toBe("11.222.333/0001-81");
    expect(maskCnpj("11222")).toBe("11.222");
    expect(maskCnpj("112223330")).toBe("11.222.333/0");
    expect(maskCnpj("")).toBe("");
  });

  it("stops at fourteen digits", () => {
    expect(maskCnpj("1122233300018199")).toBe("11.222.333/0001-81");
  });
});

describe("senderInputOf", () => {
  it("copies only the fields a person can edit", () => {
    const input = senderInputOf(senderFixture());
    expect(Object.keys(input).sort()).toEqual(Object.keys(EMPTY_SENDER_INPUT).sort());
    expect(input.brand_name).toBe("Padaria Sol");
    expect(input.cnpj).toBe("11222333000181");
  });
});

describe("withSenderField", () => {
  it("sends only the CNPJ digits to the backend", () => {
    expect(withSenderField(EMPTY_SENDER_INPUT, "cnpj", "11.222.333/0001-81").cnpj).toBe("11222333000181");
  });

  it("changes a single field", () => {
    expect(withSenderField(EMPTY_SENDER_INPUT, "brand_name", "Sol").brand_name).toBe("Sol");
    expect(EMPTY_SENDER_INPUT.brand_name).toBe("");
  });
});
