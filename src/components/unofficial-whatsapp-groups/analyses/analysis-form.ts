import {
  MAX_MESSAGES_PER_CYCLE,
  MAX_PROMPT_CHARS,
  MAX_TRACKED_FIELDS,
  TRACKED_FIELD_KEY,
  type AnalysisPatch,
  type AnalysisPayload,
  type AnalysisTrigger,
  type GroupAnalysis,
  type TrackedField,
} from "@/lib/unofficial-whatsapp-groups/types";

export const TRACKED_FIELD_KEY_MAX = 40;
export const DEFAULT_MESSAGES_PER_CYCLE = 50;
export const DEFAULT_SCHEDULE_TIME = "20:00";

export interface AnalysisForm {
  groupId: string;
  name: string;
  prompt: string;
  trigger: AnalysisTrigger;
  messagesPerCycle: string;
  scheduleTime: string;
  trackedFields: TrackedField[];
}

export type AnalysisFormIssue = "group" | "name" | "prompt" | "promptTooLong" | "messagesPerCycle" | "schedule" | "tooManyFields";

export type TrackedFieldIssue = "key" | "keyTooLong" | "duplicate";

export interface AnalysisFormErrors {
  issues: AnalysisFormIssue[];
  fields: (TrackedFieldIssue | null)[];
}

export function scheduleTimeOf(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function parseScheduleTime(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export function promptLength(prompt: string): number {
  return Array.from(prompt.trim()).length;
}

export function toFieldKey(raw: string): string {
  return raw.toLowerCase().replace(/[\s-]+/g, "_");
}

export function analysisFormFrom(analysis?: GroupAnalysis, groupId?: string): AnalysisForm {
  if (!analysis) {
    return {
      groupId: groupId ?? "",
      name: "",
      prompt: "",
      trigger: "message_count",
      messagesPerCycle: String(DEFAULT_MESSAGES_PER_CYCLE),
      scheduleTime: DEFAULT_SCHEDULE_TIME,
      trackedFields: [],
    };
  }
  return {
    groupId: analysis.groupId,
    name: analysis.name,
    prompt: analysis.prompt,
    trigger: analysis.trigger,
    messagesPerCycle: String(analysis.messagesPerCycle),
    scheduleTime: scheduleTimeOf(analysis.scheduleHour, analysis.scheduleMinute),
    trackedFields: analysis.trackedFields.map((field) => ({ ...field })),
  };
}

function parseMessagesPerCycle(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const count = Number(trimmed);
  return count >= 1 && count <= MAX_MESSAGES_PER_CYCLE ? count : null;
}

function trackedFieldIssues(fields: TrackedField[]): (TrackedFieldIssue | null)[] {
  const seen = new Set<string>();
  return fields.map((field) => {
    const key = field.key.trim();
    if (!TRACKED_FIELD_KEY.test(key)) return "key";
    if (Array.from(key).length > TRACKED_FIELD_KEY_MAX) return "keyTooLong";
    if (seen.has(key)) return "duplicate";
    seen.add(key);
    return null;
  });
}

export function analysisFormErrors(form: AnalysisForm): AnalysisFormErrors {
  const issues: AnalysisFormIssue[] = [];
  if (!form.groupId.trim()) issues.push("group");
  if (!form.name.trim()) issues.push("name");
  if (!form.prompt.trim()) issues.push("prompt");
  else if (promptLength(form.prompt) > MAX_PROMPT_CHARS) issues.push("promptTooLong");
  if (parseMessagesPerCycle(form.messagesPerCycle) === null) issues.push("messagesPerCycle");
  if (form.trigger === "scheduled" && parseScheduleTime(form.scheduleTime) === null) issues.push("schedule");
  if (form.trackedFields.length > MAX_TRACKED_FIELDS) issues.push("tooManyFields");
  return { issues, fields: trackedFieldIssues(form.trackedFields) };
}

export function formIsValid(errors: AnalysisFormErrors): boolean {
  return errors.issues.length === 0 && errors.fields.every((issue) => issue === null);
}

function settings(form: AnalysisForm, saved?: GroupAnalysis) {
  const schedule = parseScheduleTime(form.scheduleTime);
  const fallbackSchedule = parseScheduleTime(DEFAULT_SCHEDULE_TIME)!;
  return {
    name: form.name.trim(),
    prompt: form.prompt.trim(),
    trigger: form.trigger,
    messagesPerCycle: parseMessagesPerCycle(form.messagesPerCycle) ?? saved?.messagesPerCycle ?? DEFAULT_MESSAGES_PER_CYCLE,
    scheduleHour: schedule?.hour ?? saved?.scheduleHour ?? fallbackSchedule.hour,
    scheduleMinute: schedule?.minute ?? saved?.scheduleMinute ?? fallbackSchedule.minute,
    trackedFields: form.trackedFields.map((field) => ({ key: field.key.trim(), type: field.type })),
  };
}

export function analysisPayload(form: AnalysisForm): AnalysisPayload {
  return { groupId: form.groupId.trim(), ...settings(form) };
}

export function analysisPatch(form: AnalysisForm, saved: GroupAnalysis): AnalysisPatch {
  return settings(form, saved);
}
