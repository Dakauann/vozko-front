import { merge3 } from "@/lib/coworker/merge3";
import type { Envelope } from "@/lib/email-design/agent/steps";

import type { CampaignDraft } from "./draft";

export function envelopeOfDraft(draft: Pick<CampaignDraft, "subject" | "preheader">): Envelope {
  return { subject: draft.subject, preheader: draft.preheader };
}

export function undoneEnvelope(applied: Envelope, current: Envelope, previous: Envelope): Envelope {
  return merge3<Envelope>(applied, current, previous).value;
}
