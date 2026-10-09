import type { DialPreset } from "@/lib/call-session/call-session-control";

export interface DialDraft {
  number: string;
  leadId?: string;
  leadRevision?: number;
}

export const EMPTY_DIAL_DRAFT: DialDraft = { number: "" };

export function draftFromPreset(preset: DialPreset): DialDraft {
  if (!preset.leadId) return { number: preset.phoneNumber };
  return {
    number: preset.phoneNumber,
    leadId: preset.leadId,
    ...(preset.leadRevision !== undefined ? { leadRevision: preset.leadRevision } : {}),
  };
}

export function withDialNumber(draft: DialDraft, number: string): DialDraft {
  return number === draft.number ? draft : { number };
}
