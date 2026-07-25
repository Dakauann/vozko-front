/**
 * Backward compatible wrappers. Prefer `@/lib/pricing/money` for new code.
 */
import {
  microsToUsdDisplay,
  parseUsdToMicros,
} from "@/lib/pricing/money";

export function microsToDollars(micros: number): string {
  return microsToUsdDisplay(micros);
}

export function dollarsToMicros(dollars: string): number {
  return parseUsdToMicros(dollars);
}
