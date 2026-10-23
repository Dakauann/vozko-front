import { describe, expect, it } from "vitest";

import { RCS_ERROR_CODES, RCS_SENDER_FIELDS, rcsErrorField } from "@/lib/rcs/errors";

describe("RCS_ERROR_CODES", () => {
  it("lists each code once", () => {
    expect(new Set(RCS_ERROR_CODES).size).toBe(RCS_ERROR_CODES.length);
  });
});

describe("rcsErrorField", () => {
  it("reads the sender field a refusal points at", () => {
    expect(rcsErrorField({ code: "rcs_sender_incomplete", details: { field: "logo_url" } })).toBe("logo_url");
  });

  it("places a refusal whose code names one field next to that field", () => {
    expect(rcsErrorField({ code: "rcs_contact_email_domain" })).toBe("contact_email");
    expect(rcsErrorField({ code: "rcs_gambling_authorization" })).toBe("gambling_authorization_url");
    expect(rcsErrorField({ code: "carrier_provider_unavailable" })).toBeNull();
  });

  it("ignores fields the form does not have", () => {
    expect(rcsErrorField({ code: "rcs_sender_incomplete", details: { field: "provider_profile_id" } })).toBeNull();
    expect(rcsErrorField({ code: "rcs_sender_incomplete" })).toBeNull();
  });

  it("knows every editable sender field", () => {
    expect(RCS_SENDER_FIELDS).toContain("brand_name");
    expect(RCS_SENDER_FIELDS).toContain("billing_category");
  });
});
