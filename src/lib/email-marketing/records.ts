import type { EmailDnsRecord, EmailRecordPurpose, EmailRecordStatus } from "./types";

export const RECORD_PURPOSES: readonly EmailRecordPurpose[] = ["dkim", "mail_from_mx", "mail_from_spf", "reply_mx", "dmarc"];

export interface EmailRecordRow {
  key: string;
  purpose: EmailRecordPurpose;
  type: string;
  host: string;
  fullName: string;
  status: EmailRecordStatus;
  value: string;
  priority: number | null;
}

function purposeRank(purpose: EmailRecordPurpose): number {
  const index = RECORD_PURPOSES.indexOf(purpose);
  return index === -1 ? RECORD_PURPOSES.length : index;
}

export function recordRows(records: readonly EmailDnsRecord[]): EmailRecordRow[] {
  return records
    .map((record, index) => ({ record, index }))
    .sort((a, b) => purposeRank(a.record.purpose) - purposeRank(b.record.purpose) || a.index - b.index)
    .map(({ record, index }) => ({
      key: `${record.purpose}-${record.type}-${record.name}-${index}`,
      purpose: record.purpose,
      type: record.type,
      host: record.host,
      fullName: record.name,
      status: record.status,
      value: record.value,
      priority: record.type.toUpperCase() === "MX" && record.priority > 0 ? record.priority : null,
    }));
}

export function recordProgress(records: readonly EmailDnsRecord[]): { verified: number; total: number } {
  return { verified: records.filter((record) => record.status === "verified").length, total: records.length };
}
