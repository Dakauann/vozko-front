import type { SipCodec, SipSrtpMode, SipTransport, SipTrunk, SipTrunkPayload, SipTrunkType } from "./types";

export interface SipTrunkDraft {
  name: string;
  trunkType: SipTrunkType;
  host: string;
  port: string;
  domain: string;
  transport: SipTransport;
  username: string;
  password: string;
  enabled: boolean;
  authUsername: string;
  outboundProxy: string;
  skipRegistration: boolean;
  stripPrefix: string;
  addPrefix: string;
  codecs: SipCodec[];
  srtpMode: SipSrtpMode;
  stunEnabled: boolean;
  publicAddress: string;
  inboundSources: string;
}

export type SipTrunkDraftField = "name" | "host" | "port" | "username" | "password" | "codecs";

export function emptyTrunkDraft(): SipTrunkDraft {
  return {
    name: "",
    trunkType: "BIDIRECTIONAL",
    host: "",
    port: "",
    domain: "",
    transport: "UDP",
    username: "",
    password: "",
    enabled: true,
    authUsername: "",
    outboundProxy: "",
    skipRegistration: false,
    stripPrefix: "",
    addPrefix: "",
    codecs: [],
    srtpMode: "",
    stunEnabled: false,
    publicAddress: "",
    inboundSources: "",
  };
}

export function draftFromTrunk(trunk: SipTrunk): SipTrunkDraft {
  return {
    name: trunk.name,
    trunkType: trunk.trunkType,
    host: trunk.host,
    port: trunk.port ? String(trunk.port) : "",
    domain: trunk.domain ?? "",
    transport: trunk.transport,
    username: trunk.username,
    password: "",
    enabled: trunk.enabled,
    authUsername: trunk.settings.authUsername ?? "",
    outboundProxy: trunk.settings.outboundProxy ?? "",
    skipRegistration: trunk.settings.skipRegistration,
    stripPrefix: trunk.settings.dialPlan?.stripPrefix ?? "",
    addPrefix: trunk.settings.dialPlan?.addPrefix ?? "",
    codecs: trunk.settings.codecs ?? [],
    srtpMode: trunk.settings.srtpMode ?? "",
    stunEnabled: trunk.settings.stunEnabled,
    publicAddress: trunk.settings.publicAddress ?? "",
    inboundSources: (trunk.settings.inboundAllowedSources ?? []).join("\n"),
  };
}

export function payloadFromDraft(draft: SipTrunkDraft): SipTrunkPayload {
  const password = draft.password;
  return {
    name: draft.name.trim(),
    trunkType: draft.trunkType,
    host: draft.host.trim(),
    port: draft.port.trim() ? Number(draft.port.trim()) : 0,
    domain: draft.domain.trim(),
    transport: draft.transport,
    username: draft.username.trim(),
    ...(password ? { password } : {}),
    enabled: draft.enabled,
    settings: {
      authUsername: draft.authUsername.trim() || undefined,
      outboundProxy: draft.outboundProxy.trim() || undefined,
      skipRegistration: draft.skipRegistration,
      dialPlan: {
        stripPrefix: draft.stripPrefix.trim() || undefined,
        addPrefix: draft.addPrefix.trim() || undefined,
      },
      codecs: draft.codecs.length > 0 ? draft.codecs : undefined,
      srtpMode: draft.srtpMode || undefined,
      stunEnabled: draft.stunEnabled,
      publicAddress: draft.publicAddress.trim() || undefined,
      inboundAllowedSources: draft.inboundSources
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    },
  };
}

export function validateDraft(draft: SipTrunkDraft, editing: boolean): SipTrunkDraftField[] {
  const missing: SipTrunkDraftField[] = [];
  if (!draft.name.trim()) missing.push("name");
  if (!draft.host.trim()) missing.push("host");
  const port = draft.port.trim();
  if (port && (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)) missing.push("port");
  if (!draft.skipRegistration) {
    if (!draft.username.trim()) missing.push("username");
    if (!editing && !draft.password) missing.push("password");
  }
  if (draft.codecs.length > 0 && !draft.codecs.some((codec) => codec === "PCMU" || codec === "PCMA")) {
    missing.push("codecs");
  }
  return missing;
}
