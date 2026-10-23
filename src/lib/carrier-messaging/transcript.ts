import { isCount, isJson } from "@/lib/json/guards";
import { parseRcsContent } from "@/lib/rcs/parse";
import { RCS_BILLING_CLASSES, type RcsBillingClass, type RcsContent } from "@/lib/rcs/types";

export interface RcsTranscript {
  content: RcsContent;
  billingClass?: RcsBillingClass;
}

export interface SmsTranscript {
  segments: number;
}

export function readRcsTranscript(metadata: unknown): RcsTranscript | null {
  if (!isJson(metadata) || !isJson(metadata.rcs)) return null;
  const content = parseRcsContent(metadata.rcs.content);
  if (!content) return null;
  const billingClass = metadata.rcs.class;
  return typeof billingClass === "string" && (RCS_BILLING_CLASSES as readonly string[]).includes(billingClass)
    ? { content, billingClass: billingClass as RcsBillingClass }
    : { content };
}

export function readSmsTranscript(metadata: unknown): SmsTranscript | null {
  if (!isJson(metadata) || !isJson(metadata.sms) || !isCount(metadata.sms.segments) || metadata.sms.segments === 0) return null;
  return { segments: metadata.sms.segments };
}
