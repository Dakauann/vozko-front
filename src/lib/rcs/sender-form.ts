import { RCS_LIMITS } from "@/lib/rcs/limits";
import type { RcsSender, RcsSenderInput } from "@/lib/rcs/types";

export const EMPTY_SENDER_INPUT: RcsSenderInput = {
  brand_name: "",
  description: "",
  logo_url: "",
  banner_url: "",
  color: "",
  use_case: "",
  sector: "",
  gambling_authorization_url: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  website_url: "",
  privacy_url: "",
  terms_url: "",
  cnpj: "",
  billing_category: "",
};

export function senderInputOf(sender: RcsSender): RcsSenderInput {
  const input = { ...EMPTY_SENDER_INPUT };
  for (const key of Object.keys(EMPTY_SENDER_INPUT) as (keyof RcsSenderInput)[]) {
    (input as Record<keyof RcsSenderInput, string>)[key] = sender[key];
  }
  return input;
}

function cnpjDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, RCS_LIMITS.cnpjDigits);
}

export function maskCnpj(value: string): string {
  const digits = cnpjDigits(value);
  const parts: [number, number, string][] = [
    [0, 2, ""],
    [2, 5, "."],
    [5, 8, "."],
    [8, 12, "/"],
    [12, 14, "-"],
  ];
  return parts
    .filter(([start]) => digits.length > start)
    .map(([start, end, glue]) => glue + digits.slice(start, end))
    .join("");
}

export function withSenderField<K extends keyof RcsSenderInput>(input: RcsSenderInput, field: K, value: RcsSenderInput[K]): RcsSenderInput {
  const next = field === "cnpj" ? cnpjDigits(String(value)) : value;
  return { ...input, [field]: next };
}
