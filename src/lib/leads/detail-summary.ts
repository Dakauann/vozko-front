import { formatPhoneForDisplay } from "@/lib/phone/display";

export interface NumberHolder {
  leadId: string;
  name?: string;
  number?: string;
}

export interface SharedNumber {
  number: string;
  holders: NumberHolder[];
  more: boolean;
}

export interface LeadDetailSummary {
  dealsCount?: number;
  memoriesCount: number;
  sharedNumbers: SharedNumber[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function holderOf(value: unknown): NumberHolder | null {
  if (!isRecord(value)) return null;
  const leadId = textOf(value.leadId);
  if (!leadId) return null;
  const name = textOf(value.name);
  const number = textOf(value.number);
  return { leadId, ...(name ? { name } : {}), ...(number ? { number } : {}) };
}

function sharedNumberOfValue(value: unknown): SharedNumber | null {
  if (!isRecord(value) || !Array.isArray(value.holders)) return null;
  const number = textOf(value.number);
  const holders = value.holders.map(holderOf).filter((holder): holder is NumberHolder => holder !== null);
  if (!number || holders.length === 0) return null;
  return { number, holders, more: value.more === true };
}

export function readLeadSummary(value: unknown): LeadDetailSummary | null {
  if (!isRecord(value) || !isCount(value.memoriesCount) || !Array.isArray(value.sharedNumbers)) return null;
  if (value.dealsCount !== undefined && value.dealsCount !== null && !isCount(value.dealsCount)) return null;
  const sharedNumbers = value.sharedNumbers.map(sharedNumberOfValue).filter((shared): shared is SharedNumber => shared !== null);
  return {
    ...(isCount(value.dealsCount) ? { dealsCount: value.dealsCount } : {}),
    memoriesCount: value.memoriesCount,
    sharedNumbers,
  };
}

export function sharedNumberOf(summary: LeadDetailSummary | undefined, number: string): SharedNumber | undefined {
  if (!summary || !number) return undefined;
  return summary.sharedNumbers.find((shared) => shared.number === number);
}

export function sharedNumberOfShown(summary: LeadDetailSummary | undefined, stored: string | undefined, shown: string): SharedNumber | undefined {
  if (!stored || formatPhoneForDisplay(stored) !== shown.trim()) return undefined;
  return sharedNumberOf(summary, stored);
}
