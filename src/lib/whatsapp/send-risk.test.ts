import { describe, expect, it } from "vitest";

import { phoneSendRisk } from "@/lib/whatsapp-business-phones/health";
import { templateSendRisk } from "@/lib/whatsapp-templates/health";

describe("send risk", () => {
  it("raises nothing for a healthy or not yet rated number", () => {
    expect(phoneSendRisk({ status: "CONNECTED", qualityRating: "GREEN" })).toBeNull();
    expect(phoneSendRisk({ status: "CONNECTED", qualityRating: "UNKNOWN" })).toBeNull();
  });

  it("warns on a medium quality or flagged number and faults on a red or banned one", () => {
    expect(phoneSendRisk({ status: "CONNECTED", qualityRating: "YELLOW" })).toBe("warning");
    expect(phoneSendRisk({ status: "FLAGGED", qualityRating: "GREEN" })).toBe("warning");
    expect(phoneSendRisk({ status: "CONNECTED", qualityRating: "RED" })).toBe("fault");
    expect(phoneSendRisk({ status: "BANNED", qualityRating: "YELLOW" })).toBe("fault");
  });

  it("follows the template quality, pending quality raising nothing", () => {
    expect(templateSendRisk({ status: "APPROVED", quality: "UNKNOWN" })).toBeNull();
    expect(templateSendRisk({ status: "APPROVED" })).toBeNull();
    expect(templateSendRisk({ status: "APPROVED", quality: "YELLOW" })).toBe("warning");
    expect(templateSendRisk({ status: "APPROVED", quality: "RED" })).toBe("fault");
  });
});
