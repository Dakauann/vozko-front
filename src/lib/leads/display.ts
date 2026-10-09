import { formatPhoneForDisplay } from "@/lib/phone/display";

export type LeadNameDetail =
  | { kind: "identity"; text: string }
  | { kind: "noName" }
  | { kind: "noWhatsApp" };

export interface LeadNameLines {
  title: string;
  titleMono: boolean;
  detail: LeadNameDetail;
}

const PHONE_TEXT = /^[\d\s()+.-]+$/;

function isOnlyTheNumber(name: string, number: string): boolean {
  if (!PHONE_TEXT.test(name)) return false;
  const digits = name.replace(/\D/g, "");
  return digits !== "" && digits === number.replace(/\D/g, "");
}

export function leadNameLines(lead: { realName?: string; number: string }): LeadNameLines {
  const typed = lead.realName?.trim() ?? "";
  const name = isOnlyTheNumber(typed, lead.number) ? "" : typed;
  const number = lead.number.trim() ? formatPhoneForDisplay(lead.number) : "";
  if (!number) return { title: name, titleMono: false, detail: { kind: "noWhatsApp" } };
  if (!name) return { title: number, titleMono: true, detail: { kind: "noName" } };
  return { title: name, titleMono: false, detail: { kind: "identity", text: number } };
}

export function leadFirstName(lines: LeadNameLines): string {
  if (lines.titleMono) return "";
  return lines.title.split(/\s+/).find((word) => word !== "") ?? "";
}
