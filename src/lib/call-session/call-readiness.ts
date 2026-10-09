export type CallBlocker = "noPermission" | "connecting" | "busy";

export interface CallBlockerInput {
  permitted: boolean;
  online: boolean;
  live: boolean;
  direct: boolean;
}

export function isCallLive(callState: { status: string } | null): boolean {
  return callState !== null && callState.status !== "ended";
}

export function callBlocker({ permitted, online, live, direct }: CallBlockerInput): CallBlocker | null {
  if (!permitted) return "noPermission";
  if (!direct) return null;
  if (!online) return "connecting";
  if (live) return "busy";
  return null;
}
