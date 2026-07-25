import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function normalizeBrazilianPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");

  if (/^55\d{10,11}$/.test(digits)) {
    return digits;
  }

  if (/^\d{10,11}$/.test(digits)) {
    return `55${digits}`;
  }

  return null;
}
