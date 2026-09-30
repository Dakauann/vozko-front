export const CALL_CHANNELS = ["sip", "whatsapp"] as const;

export type CallChannel = (typeof CALL_CHANNELS)[number];

export function callChannelOf(raw: string | null | undefined): CallChannel | null {
    return (CALL_CHANNELS as readonly string[]).includes(raw ?? "") ? (raw as CallChannel) : null;
}
