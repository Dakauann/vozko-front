import { nextPollDelay } from "@/lib/polling";

import { activeDomains } from "./ladder";
import type { EmailDomain, EmailSetup, EmailSetupProgress } from "./types";

export function isSettingUp(progress: EmailSetupProgress | undefined): boolean {
  return progress?.state === "in_progress";
}

export function setupPollDelay(setup: EmailSetup | undefined, previousMs: number | null): number | null {
  return isSettingUp(setup?.setup) ? nextPollDelay(previousMs) : null;
}

export function domainsNeedingSetup(setup: EmailSetup): EmailDomain[] {
  return activeDomains(setup).filter((domain) => domain.setup.state !== "done");
}
