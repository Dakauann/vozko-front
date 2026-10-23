import { CAMPAIGN_LIMITS, emptyCampaignDraft, type Campaign, type CampaignChannel, type CampaignDraft, type CampaignVariant } from "@/lib/carrier-messaging/campaigns";
import type { LeadSelection } from "@/lib/leads/actions";

export type EditorStep = "channel" | "message" | "fallback" | "audience" | "review" | "send";

export type ScheduleMode = "now" | "once" | "recurring";

const LETTERS = ["A", "B", "C", "D"];

export function editorSteps(channel: CampaignChannel): EditorStep[] {
  return channel === "rcs" ? ["channel", "message", "fallback", "audience", "review", "send"] : ["channel", "message", "audience", "review", "send"];
}

export function draftOf(campaign: Campaign): CampaignDraft {
  const { name, channel, kind, sender_id, variants, fallback, audience, scheduled_at, recurrence } = campaign;
  return structuredClone({ name, channel, kind, sender_id, variants, fallback, audience, scheduled_at, recurrence });
}

export function withChannel(draft: CampaignDraft, channel: CampaignChannel): CampaignDraft {
  if (draft.channel === channel) return draft;
  const fresh = emptyCampaignDraft(channel);
  return { ...fresh, name: draft.name, kind: draft.kind, audience: draft.audience, scheduled_at: draft.scheduled_at, recurrence: draft.recurrence };
}

function blankVariant(channel: CampaignChannel, name: string): CampaignVariant {
  return channel === "rcs" ? { name, content: {}, bindings: [] } : { name, text: "", bindings: [] };
}

function freeLetter(variants: readonly CampaignVariant[]): string {
  const taken = new Set(variants.map((variant) => variant.name.trim().toUpperCase()));
  return LETTERS.find((letter) => !taken.has(letter)) ?? String(variants.length + 1);
}

function lettered(variants: CampaignVariant[]): CampaignVariant[] {
  if (variants.length < 2) return variants;
  const named = variants.filter((variant) => variant.name.trim());
  return variants.map((variant) => {
    if (variant.name.trim()) return variant;
    const next = { ...variant, name: freeLetter(named) };
    named.push(next);
    return next;
  });
}

export function canAddVariant(draft: CampaignDraft): boolean {
  return draft.variants.length < CAMPAIGN_LIMITS.maxVariants;
}

export function addVariant(draft: CampaignDraft): CampaignDraft {
  if (!canAddVariant(draft)) return draft;
  const named = lettered([...draft.variants, blankVariant(draft.channel, "")]);
  return { ...draft, variants: named };
}

export function duplicateVariant(draft: CampaignDraft, index: number): CampaignDraft {
  const source = draft.variants[index];
  if (!source || !canAddVariant(draft)) return draft;
  const named = lettered(draft.variants);
  const copy = { ...structuredClone(source), name: freeLetter(named) };
  return { ...draft, variants: [...named.slice(0, index + 1), copy, ...named.slice(index + 1)] };
}

export function removeVariant(draft: CampaignDraft, index: number): CampaignDraft {
  if (draft.variants.length <= CAMPAIGN_LIMITS.minVariants) return draft;
  return { ...draft, variants: draft.variants.filter((_, at) => at !== index) };
}

export function updateVariant(draft: CampaignDraft, index: number, variant: CampaignVariant): CampaignDraft {
  return { ...draft, variants: draft.variants.map((current, at) => (at === index ? variant : current)) };
}

export function scheduleModeOf(draft: CampaignDraft): ScheduleMode {
  if (draft.recurrence) return "recurring";
  return draft.scheduled_at ? "once" : "now";
}

export function withoutSchedule(draft: CampaignDraft): CampaignDraft {
  return { ...draft, scheduled_at: null, recurrence: null };
}

export function scheduleIncomplete(draft: CampaignDraft): boolean {
  const mode = scheduleModeOf(draft);
  if (mode === "once") return !draft.scheduled_at;
  if (mode === "recurring") return !draft.recurrence?.time;
  return true;
}

export function withScheduleMode(draft: CampaignDraft, mode: ScheduleMode, timezone: string): CampaignDraft {
  if (scheduleModeOf(draft) === mode) return draft;
  if (mode === "now") return withoutSchedule(draft);
  if (mode === "once") return { ...draft, recurrence: null };
  return { ...draft, scheduled_at: null, recurrence: { frequency: "weekly", time: "09:00", weekdays: [1], timezone } };
}

export function audienceCount(selection: LeadSelection | null): number | null {
  if (!selection) return null;
  if (selection.mode === "ids") return selection.ids?.length ?? 0;
  if (selection.mode === "first_n" && selection.limit) return selection.limit;
  return selection.expectedCount ?? null;
}
