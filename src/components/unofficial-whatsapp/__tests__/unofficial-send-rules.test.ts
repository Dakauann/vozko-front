import { describe, expect, it } from "vitest";

import { messageBodiesReady, unofficialMessageReady } from "../campaign-message-composer";
import { DEFAULT_SEND_DELAY_MS } from "../campaign-pacing-panel";
import { instanceUnusable } from "@/lib/unofficial-whatsapp/types";
import type { UnofficialWhatsAppMessageSpec } from "@/lib/unofficial-whatsapp-campaigns/types";

const text = (...bodies: string[]): UnofficialWhatsAppMessageSpec => ({ kind: "text", bodies });

describe("messageBodiesReady", () => {
  it("needs every variation of a text written with the same variables", () => {
    expect(messageBodiesReady(text("Oi {{1}}", "Olá {{1}}"))).toBe(true);
    expect(messageBodiesReady(text("Oi {{1}}", ""))).toBe(false);
    expect(messageBodiesReady(text("Oi {{1}}", "Olá {{2}}"))).toBe(false);
  });

  it("lets a media message go without a caption", () => {
    expect(messageBodiesReady({ kind: "image", bodies: [""] })).toBe(true);
  });
});

describe("unofficialMessageReady", () => {
  it("also needs the file when the kind asks for one", () => {
    expect(unofficialMessageReady({ kind: "image", bodies: [""] })).toBe(false);
    expect(unofficialMessageReady({ kind: "image", bodies: [""], mediaId: "m-1" })).toBe(true);
    expect(unofficialMessageReady(text("Oi"))).toBe(true);
  });
});

describe("instanceUnusable", () => {
  it("refuses only a banned number or one that failed to provision", () => {
    expect(instanceUnusable("banned")).toBe(true);
    expect(instanceUnusable("provision-failed")).toBe(true);
    expect(instanceUnusable("disconnected")).toBe(false);
    expect(instanceUnusable(null)).toBe(false);
  });
});

describe("DEFAULT_SEND_DELAY_MS", () => {
  it("keeps the pacing a new send starts with", () => {
    expect(DEFAULT_SEND_DELAY_MS).toEqual({ min: 3000, max: 12000 });
  });
});
