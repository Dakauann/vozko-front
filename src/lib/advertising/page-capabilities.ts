import type { AdPage, AdPageCapability, AdPageChannel } from "./types";

export function missingPortal(page: AdPage, channel: AdPageChannel): string | null {
  const capability: AdPageCapability | undefined = (page.capabilities ?? []).find((candidate) => candidate.channel === channel);
  if (!capability || capability.state === "ready") return null;
  return capability.action?.kind === "portal" && capability.action.url ? capability.action.url : null;
}
