import { describe, expect, it } from "vitest";

import { missingPortal } from "./page-capabilities";
import type { AdPage } from "./types";

const page = (capabilities: AdPage["capabilities"]): AdPage => ({
  pageId: "p-1",
  name: "Loja",
  canAdvertise: true,
  leadTermsAccepted: false,
  numbers: [],
  capabilities,
});

describe("missingPortal", () => {
  it("gives the Meta screen of a missing capability", () => {
    const terms = "https://www.facebook.com/ads/leadgen/tos";
    expect(missingPortal(page([{ channel: "lead_forms", state: "missing", action: { kind: "portal", url: terms } }]), "lead_forms")).toBe(terms);
  });

  it("gives nothing when the capability is ready, unknown or fixed inside Vozko", () => {
    expect(missingPortal(page([{ channel: "lead_forms", state: "ready" }]), "lead_forms")).toBeNull();
    expect(missingPortal(page([]), "lead_forms")).toBeNull();
    expect(missingPortal(page([{ channel: "whatsapp", state: "missing", action: { kind: "in_app", key: "link_whatsapp" } }]), "whatsapp")).toBeNull();
  });
});
