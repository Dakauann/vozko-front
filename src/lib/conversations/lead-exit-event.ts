import { BUTTON_ACTION_KINDS, EXIT_KINDS, exitWordLabel } from "@/lib/whatsapp-templates/exit";

export const LEAD_EXIT_ACTION = "lead_exit_action";
export const LEAD_SEND_REFUSED = "lead_send_refused";

const TRIGGERS = new Set(["button", "template_word", "campaign_word", "workspace_word"]);
const KINDS: ReadonlySet<string> = new Set(BUTTON_ACTION_KINDS);
const OWN_UNCHANGED: ReadonlySet<string> = new Set(EXIT_KINDS);
const CONFIRMATIONS = new Set(["sent", "outside_window", "already_sent", "not_sent"]);
const SEND_REFUSALS = new Set(["lead_opted_out", "lead_blocked"]);

export type LeadExitTone = "ok" | "neutral" | "refused";

export interface LeadExitPhrase {
  key: string;
  values: Record<string, string>;
}

interface LeadExitView {
  tone: LeadExitTone;
  trigger: LeadExitPhrase | null;
  result: LeadExitPhrase;
  reason: string | null;
  confirmation: string | null;
}

export function isLeadExitEvent(type: string): boolean {
  return type === LEAD_EXIT_ACTION || type === LEAD_SEND_REFUSED;
}

function triggerOf(details: Record<string, string>): LeadExitPhrase {
  const trigger = TRIGGERS.has(details.trigger) ? details.trigger : "unknown";
  if (trigger === "button") return { key: "trigger.button", values: { button: details.button_text ?? "" } };
  if (trigger === "unknown") return { key: "trigger.unknown", values: {} };
  return { key: `trigger.${trigger}`, values: { word: details.word ? exitWordLabel(details.word) : "" } };
}

function resultOf(details: Record<string, string>): LeadExitPhrase {
  const kind = KINDS.has(details.kind) ? details.kind : "other";
  switch (details.outcome) {
    case "changed":
      return { key: `changed.${kind}`, values: kind === "classify" ? { option: details.option ?? "" } : {} };
    case "unchanged":
      return { key: `unchanged.${OWN_UNCHANGED.has(kind) ? kind : "other"}`, values: {} };
    case "refused":
    case "failed":
      return { key: details.outcome, values: {} };
    default:
      return { key: "unknown", values: {} };
  }
}

function toneOf(outcome: string | undefined): LeadExitTone {
  if (outcome === "changed") return "ok";
  if (outcome === "refused" || outcome === "failed") return "refused";
  return "neutral";
}

function exitActionView(details: Record<string, string>): LeadExitView {
  const failed = details.outcome === "refused" || details.outcome === "failed";
  return {
    tone: toneOf(details.outcome),
    trigger: triggerOf(details),
    result: resultOf(details),
    reason: failed && details.reason ? details.reason : null,
    confirmation: CONFIRMATIONS.has(details.confirmation) ? `confirmation.${details.confirmation}` : null,
  };
}

function sendRefusedView(details: Record<string, string>): LeadExitView {
  const reason = SEND_REFUSALS.has(details.reason) ? details.reason : "other";
  return { tone: "refused", trigger: null, result: { key: `sendRefused.${reason}`, values: {} }, reason: null, confirmation: null };
}

export function leadExitView(type: string, details: Record<string, string>): LeadExitView | null {
  if (type === LEAD_EXIT_ACTION) return exitActionView(details);
  if (type === LEAD_SEND_REFUSED) return sendRefusedView(details);
  return null;
}
