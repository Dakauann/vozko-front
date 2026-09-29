export type SipTrunkType = "BIDIRECTIONAL" | "OUTBOUND" | "INBOUND";
export type SipTransport = "UDP" | "TCP";
export type SipRegistrationStatus = "UNREGISTERED" | "REGISTERING" | "REGISTERED" | "FAILED";
export type SipCodec = "PCMU" | "PCMA" | "opus" | "telephone-event";
export type SipSrtpMode = "" | "OPTIONAL" | "REQUIRED";

export interface SipTrunkSettings {
  authUsername?: string;
  outboundProxy?: string;
  skipRegistration: boolean;
  registerExpirySeconds?: number;
  dialPlan: { stripPrefix?: string; addPrefix?: string };
  codecs?: SipCodec[];
  srtpMode?: SipSrtpMode;
  stunEnabled: boolean;
  publicAddress?: string;
  inboundAllowedSources?: string[];
}

export interface SipTrunk {
  id: string;
  name: string;
  trunkType: SipTrunkType;
  host: string;
  port: number;
  domain?: string;
  transport: SipTransport;
  username: string;
  hasPassword: boolean;
  enabled: boolean;
  settings: SipTrunkSettings;
  registrationStatus: SipRegistrationStatus;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SipTrunkPayload {
  name: string;
  trunkType: SipTrunkType;
  host: string;
  port: number;
  domain: string;
  transport: SipTransport;
  username: string;
  password?: string;
  enabled: boolean;
  settings: SipTrunkSettings;
}

export interface SipActiveCall {
  id: string;
  trunkId: string;
  direction: "inbound" | "outbound";
  phoneNumber: string;
  startedAt: string;
  answeredAt?: string;
}

export const SIP_CODECS: SipCodec[] = ["PCMU", "PCMA", "opus", "telephone-event"];

export function canDialThrough(trunk: SipTrunk): boolean {
  return trunk.enabled && trunk.trunkType !== "INBOUND" && trunk.registrationStatus === "REGISTERED";
}
