import { describe, expect, it } from "vitest";

import { formatPhoneForDisplay } from "@/lib/phone/display";

describe("formatPhoneForDisplay", () => {
  it("groups Brazilian mobiles and fixed lines the way people read them", () => {
    expect(formatPhoneForDisplay("5584994409684")).toBe("+55 (84) 99440-9684");
    expect(formatPhoneForDisplay("551123456789")).toBe("+55 (11) 2345-6789");
    expect(formatPhoneForDisplay("84994409684")).toBe("+55 (84) 99440-9684");
  });

  it("shows toll-free and other non-geographic numbers in their usual blocks", () => {
    expect(formatPhoneForDisplay("08001234567")).toBe("0800 123 4567");
    expect(formatPhoneForDisplay("03031234567")).toBe("0303 123 4567");
  });

  it("shows other international numbers with a plus", () => {
    expect(formatPhoneForDisplay("14155550100")).toBe("+14155550100");
    expect(formatPhoneForDisplay("+14155550100")).toBe("+14155550100");
  });

  it("leaves short codes, extensions and feature codes as dialed", () => {
    expect(formatPhoneForDisplay("190")).toBe("190");
    expect(formatPhoneForDisplay("*43")).toBe("*43");
    expect(formatPhoneForDisplay("1001")).toBe("1001");
  });
});
