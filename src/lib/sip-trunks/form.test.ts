import { describe, expect, it } from "vitest";

import { draftFromTrunk, emptyTrunkDraft, payloadFromDraft, validateDraft } from "./form";
import type { SipTrunk } from "./types";

const trunk: SipTrunk = {
  id: "t1",
  name: "Main",
  trunkType: "BIDIRECTIONAL",
  host: "sip.provider.com",
  port: 5080,
  domain: "provider.com",
  transport: "UDP",
  username: "1001",
  hasPassword: true,
  enabled: true,
  settings: {
    skipRegistration: false,
    dialPlan: { stripPrefix: "+55", addPrefix: "0" },
    codecs: ["PCMA", "telephone-event"],
    srtpMode: "",
    stunEnabled: false,
    inboundAllowedSources: ["203.0.113.0/24", "198.51.100.7"],
  },
  registrationStatus: "REGISTERED",
  createdAt: "",
  updatedAt: "",
};

describe("sip trunk form", () => {
  it("round-trips an existing trunk without sending its unchanged password", () => {
    const payload = payloadFromDraft(draftFromTrunk(trunk));
    expect(payload.password).toBeUndefined();
    expect(payload.port).toBe(5080);
    expect(payload.settings.inboundAllowedSources).toEqual(["203.0.113.0/24", "198.51.100.7"]);
    expect(payload.settings.dialPlan).toEqual({ stripPrefix: "+55", addPrefix: "0" });
    expect(payload.settings.codecs).toEqual(["PCMA", "telephone-event"]);
  });

  it("trims fields, drops blank lines and sends a typed password", () => {
    const draft = {
      ...emptyTrunkDraft(),
      name: "  Line  ",
      host: " sip.example.com ",
      port: "",
      username: " u ",
      password: "secret",
      inboundSources: "203.0.113.4\n\n  198.51.100.0/24  \n",
    };
    const payload = payloadFromDraft(draft);
    expect(payload.name).toBe("Line");
    expect(payload.host).toBe("sip.example.com");
    expect(payload.port).toBe(0);
    expect(payload.username).toBe("u");
    expect(payload.password).toBe("secret");
    expect(payload.settings.inboundAllowedSources).toEqual(["203.0.113.4", "198.51.100.0/24"]);
  });

  it("reports the fields a trunk cannot be saved without", () => {
    const empty = emptyTrunkDraft();
    expect(validateDraft(empty, false)).toEqual(expect.arrayContaining(["name", "host", "username", "password"]));
    expect(validateDraft({ ...empty, name: "x", host: "h", skipRegistration: true }, false)).toEqual([]);
    expect(validateDraft({ ...draftFromTrunk(trunk), password: "" }, true)).toEqual([]);
    expect(validateDraft({ ...draftFromTrunk(trunk), port: "70000" }, true)).toEqual(["port"]);
    expect(validateDraft({ ...draftFromTrunk(trunk), codecs: ["opus"] }, true)).toEqual(["codecs"]);
  });
});
